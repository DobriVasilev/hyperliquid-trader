/**
 * Redis client for production-scale real-time features
 * Uses Upstash Redis for serverless-compatible pub/sub
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
export const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null;

// Check if Redis is configured
export function isRedisConfigured(): boolean {
  return redis !== null;
}

// Keys
const PRESENCE_KEY = 'chat:presence';
const TYPING_KEY = 'chat:typing';
const ONLINE_USERS_KEY = 'chat:online';
const MESSAGE_QUEUE_KEY = 'chat:messages';

// Presence management with sorted sets
export async function setUserOnline(userId: string, userData: {
  userName: string;
  userAvatar: string | null;
  status: string;
}): Promise<void> {
  if (!redis) return;

  const now = Date.now();
  const key = `${PRESENCE_KEY}:${userId}`;

  await Promise.all([
    // Store user data with TTL
    redis.set(key, JSON.stringify({ ...userData, lastSeen: now }), { ex: 120 }), // 2 min TTL
    // Add to online users sorted set (score = timestamp)
    redis.zadd(ONLINE_USERS_KEY, { score: now, member: userId }),
  ]);
}

export async function setUserOffline(userId: string): Promise<void> {
  if (!redis) return;

  await Promise.all([
    redis.del(`${PRESENCE_KEY}:${userId}`),
    redis.zrem(ONLINE_USERS_KEY, userId),
  ]);
}

export async function getOnlineUsers(): Promise<Array<{
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  status: string;
  lastSeen: string;
}>> {
  if (!redis) return [];

  // Get users active in last 2 minutes
  const cutoff = Date.now() - 2 * 60 * 1000;
  const userIds = await redis.zrange(ONLINE_USERS_KEY, cutoff, '+inf', { byScore: true });

  if (!userIds.length) return [];

  // Get user data for each online user
  const pipeline = redis.pipeline();
  userIds.forEach((userId) => {
    pipeline.get(`${PRESENCE_KEY}:${userId}`);
  });

  const results = await pipeline.exec();

  return userIds
    .map((userId, i) => {
      const data = results[i] as string | null;
      if (!data) return null;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return {
        id: `presence-${userId}`,
        userId,
        userName: parsed.userName || 'Anonymous',
        userAvatar: parsed.userAvatar || null,
        status: parsed.status || 'online',
        lastSeen: new Date(parsed.lastSeen).toISOString(),
        isVip: false,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      userId: string;
      userName: string;
      userAvatar: string | null;
      status: string;
      lastSeen: string;
    }>;
}

// Clean up stale users
export async function cleanupStaleUsers(): Promise<void> {
  if (!redis) return;

  const cutoff = Date.now() - 2 * 60 * 1000;
  await redis.zremrangebyscore(ONLINE_USERS_KEY, '-inf', cutoff);
}

// Typing indicators with efficient TTL
export async function setUserTyping(
  userId: string,
  userName: string,
  channelId: string | null
): Promise<void> {
  if (!redis) return;

  const key = `${TYPING_KEY}:${channelId || 'global'}`;
  const data = JSON.stringify({ userId, userName, timestamp: Date.now() });

  await redis.hset(key, { [userId]: data });
  // Set expiration on the hash
  await redis.expire(key, 5); // 5 second TTL
}

export async function clearUserTyping(
  userId: string,
  channelId: string | null
): Promise<void> {
  if (!redis) return;

  const key = `${TYPING_KEY}:${channelId || 'global'}`;
  await redis.hdel(key, userId);
}

export async function getTypingUsers(
  channelId: string | null
): Promise<Array<{ userId: string; userName: string }>> {
  if (!redis) return [];

  const key = `${TYPING_KEY}:${channelId || 'global'}`;
  const data = await redis.hgetall(key);

  if (!data) return [];

  const now = Date.now();
  const users: Array<{ userId: string; userName: string }> = [];

  for (const [userId, value] of Object.entries(data)) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    // Only include if typing started within last 3 seconds
    if (now - parsed.timestamp < 3000) {
      users.push({ userId, userName: parsed.userName });
    }
  }

  return users;
}

// Pub/Sub for real-time messages
export async function publishMessage(
  channel: string,
  message: object
): Promise<void> {
  if (!redis) return;

  await redis.publish(channel, JSON.stringify(message));
}

// Message channels
export const CHANNELS = {
  CHAT_MESSAGES: 'chat:messages',
  PRESENCE_UPDATES: 'chat:presence:updates',
  TYPING_UPDATES: 'chat:typing:updates',
  NOTIFICATIONS: 'chat:notifications',
} as const;

// Publish helpers
export async function publishChatMessage(message: object, channelId: string | null): Promise<void> {
  await publishMessage(CHANNELS.CHAT_MESSAGES, { ...message, channelId });
}

export async function publishPresenceUpdate(userId: string, status: string, user?: object): Promise<void> {
  await publishMessage(CHANNELS.PRESENCE_UPDATES, { userId, status, user });
}

export async function publishTypingUpdate(
  userId: string,
  userName: string,
  channelId: string | null,
  isTyping: boolean
): Promise<void> {
  await publishMessage(CHANNELS.TYPING_UPDATES, {
    type: isTyping ? 'typing_start' : 'typing_stop',
    userId,
    userName,
    channelId,
  });
}

export async function publishNotification(userId: string, notification: object): Promise<void> {
  await publishMessage(CHANNELS.NOTIFICATIONS, { userId, notification });
}

// Rate limiting
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (!redis) return { allowed: true, remaining: limit, resetIn: 0 };

  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, windowSeconds);
  }

  const ttl = await redis.ttl(windowKey);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetIn: ttl > 0 ? ttl : windowSeconds,
  };
}

// Message rate limiting (10 messages per 10 seconds)
export async function checkMessageRateLimit(userId: string): Promise<boolean> {
  const result = await checkRateLimit(`msg:${userId}`, 10, 10);
  return result.allowed;
}

// Upload rate limiting (5 uploads per minute)
export async function checkUploadRateLimit(userId: string): Promise<boolean> {
  const result = await checkRateLimit(`upload:${userId}`, 5, 60);
  return result.allowed;
}
