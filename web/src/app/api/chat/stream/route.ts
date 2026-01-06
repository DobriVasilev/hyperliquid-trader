import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  redis,
  isRedisConfigured,
  setUserOnline,
  setUserOffline,
  getOnlineUsers,
  publishPresenceUpdate,
} from "@/lib/redis";

// Store connected clients for this server instance
// In production with multiple servers, Redis pub/sub handles cross-server messaging
const clients = new Map<
  string,
  { controller: ReadableStreamDefaultController; userId: string; channelId?: string | null }
>();

// Broadcast a message to all connected clients on this server
export function broadcastMessage(message: object, excludeUserId?: string, channelId?: string | null) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  const encoder = new TextEncoder();

  clients.forEach((client, id) => {
    // Filter by channel if specified
    if (channelId !== undefined && client.channelId !== channelId) {
      return;
    }

    if (client.userId !== excludeUserId) {
      try {
        client.controller.enqueue(encoder.encode(data));
      } catch {
        clients.delete(id);
      }
    }
  });
}

// Broadcast to a specific user (for DMs and notifications)
export function broadcastToUser(userId: string, message: object) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  const encoder = new TextEncoder();

  clients.forEach((client) => {
    if (client.userId === userId) {
      try {
        client.controller.enqueue(encoder.encode(data));
      } catch {
        // Ignore errors - client may have disconnected
      }
    }
  });
}

// Broadcast to all clients (used for global events)
export function broadcastToAll(message: object) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  const encoder = new TextEncoder();

  clients.forEach((client, id) => {
    try {
      client.controller.enqueue(encoder.encode(data));
    } catch {
      clients.delete(id);
    }
  });
}

// Get connection count (for debugging/monitoring)
export function getConnectionCount(): number {
  return clients.size;
}

// Subscribe to Redis pub/sub channels (for production multi-server)
async function setupRedisSubscription() {
  if (!isRedisConfigured() || !redis) return;

  // Note: Upstash Redis doesn't support traditional pub/sub subscriptions
  // in serverless environments. For production at scale, you would use:
  // 1. Upstash Qstash for message queuing
  // 2. A dedicated Redis instance with persistent connections
  // 3. Ably, Pusher, or similar managed real-time service
  //
  // For now, we use Redis for state (presence, typing) and rely on
  // SSE polling for real-time updates across servers.
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  const clientId = `${session.user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = session.user.id;

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true },
  });

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Register client
      clients.set(clientId, {
        controller,
        userId,
        channelId,
      });

      // Send initial connection message
      const connectedData = `data: ${JSON.stringify({
        type: "connected",
        clientId,
        userId,
        channelId,
        serverTime: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(encoder.encode(connectedData));

      // Set user online in Redis (if configured) or database
      if (isRedisConfigured()) {
        await setUserOnline(userId, {
          userName: user?.name || "Anonymous",
          userAvatar: user?.image || null,
          status: "online",
        });

        // Get online users from Redis
        const onlineUsers = await getOnlineUsers();
        const usersData = `data: ${JSON.stringify({
          type: "presence_list",
          users: onlineUsers,
          source: "redis",
        })}\n\n`;
        try {
          controller.enqueue(encoder.encode(usersData));
        } catch {
          // Stream may be closed
        }

        // Publish presence update to Redis
        await publishPresenceUpdate(userId, "online", {
          id: `presence-${userId}`,
          userId,
          userName: user?.name || "Anonymous",
          userAvatar: user?.image || null,
          status: "online",
        });
      } else {
        // Fallback to database presence
        const dbUsers = await prisma.chatPresence
          .findMany({
            where: {
              lastSeen: { gte: new Date(Date.now() - 2 * 60 * 1000) },
            },
          })
          .catch(() => []);

        const usersData = `data: ${JSON.stringify({
          type: "presence_list",
          users: dbUsers,
          source: "database",
        })}\n\n`;
        try {
          controller.enqueue(encoder.encode(usersData));
        } catch {
          // Stream may be closed
        }
      }

      // Broadcast presence update to other clients on this server
      broadcastMessage(
        {
          type: "presence_update",
          userId,
          user: {
            id: `presence-${userId}`,
            userId,
            userName: user?.name || "Anonymous",
            userAvatar: user?.image || null,
            status: "online",
          },
          status: "online",
        },
        userId
      );

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          const pingData = `data: ${JSON.stringify({
            type: "ping",
            timestamp: Date.now(),
            connections: clients.size,
          })}\n\n`;
          controller.enqueue(encoder.encode(pingData));

          // Refresh Redis presence TTL
          if (isRedisConfigured()) {
            setUserOnline(userId, {
              userName: user?.name || "Anonymous",
              userAvatar: user?.image || null,
              status: "online",
            }).catch(() => {});
          }
        } catch {
          clearInterval(pingInterval);
          clients.delete(clientId);
        }
      }, 30000);

      // Presence refresh every 60 seconds
      const presenceInterval = setInterval(async () => {
        try {
          if (isRedisConfigured()) {
            const onlineUsers = await getOnlineUsers();
            const usersData = `data: ${JSON.stringify({
              type: "presence_list",
              users: onlineUsers,
              source: "redis",
            })}\n\n`;
            controller.enqueue(encoder.encode(usersData));
          }
        } catch {
          // Ignore errors
        }
      }, 60000);

      // Handle client disconnect
      request.signal.addEventListener("abort", async () => {
        clearInterval(pingInterval);
        clearInterval(presenceInterval);
        clients.delete(clientId);

        // Set user offline
        if (isRedisConfigured()) {
          await setUserOffline(userId).catch(() => {});
          await publishPresenceUpdate(userId, "offline").catch(() => {});
        }

        // Broadcast user offline to other clients
        broadcastMessage(
          {
            type: "presence_update",
            userId,
            status: "offline",
          },
          userId
        );
      });
    },
    cancel() {
      clients.delete(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

// Initialize Redis subscription on module load
setupRedisSubscription();
