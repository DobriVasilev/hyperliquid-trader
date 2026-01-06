import { test, expect } from '@playwright/test';

test.describe('Chat Features - API Response Formats', () => {
  test.describe('Messages API Response', () => {
    test('should return proper error format for unauthorized', async ({ request }) => {
      const response = await request.get('/api/chat/messages');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    });

    test('should return proper error format for POST without auth', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: 'test message' }
      });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should return proper error format for PATCH without auth', async ({ request }) => {
      const response = await request.patch('/api/chat/messages', {
        data: { messageId: 'test', content: 'updated' }
      });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should return proper error format for DELETE without auth', async ({ request }) => {
      const response = await request.delete('/api/chat/messages?id=test');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });
  });

  test.describe('Channels API Response', () => {
    test('should return proper error format for unauthorized', async ({ request }) => {
      const response = await request.get('/api/chat/channels');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('error');
    });

    test('should return proper error format for POST without auth', async ({ request }) => {
      const response = await request.post('/api/chat/channels', {
        data: { name: 'Test Channel', description: 'Test', icon: '💬' }
      });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });
  });

  test.describe('Search API Response', () => {
    test('should return proper error for unauthorized search', async ({ request }) => {
      const response = await request.get('/api/chat/search?q=hello');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should handle special characters in search query', async ({ request }) => {
      const response = await request.get('/api/chat/search?q=' + encodeURIComponent('test @user #channel'));
      expect(response.status()).toBe(401);
    });

    test('should handle unicode in search query', async ({ request }) => {
      const response = await request.get('/api/chat/search?q=' + encodeURIComponent('hello 👋 world'));
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Reactions API Response', () => {
    test('should return proper error for unauthorized GET', async ({ request }) => {
      const response = await request.get('/api/chat/reactions?messageId=test123');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should handle emoji in reaction endpoints', async ({ request }) => {
      const response = await request.post('/api/chat/reactions', {
        data: { messageId: 'test', emoji: '👍' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle all allowed emojis', async ({ request }) => {
      const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🚀', '💯'];

      for (const emoji of emojis) {
        const response = await request.post('/api/chat/reactions', {
          data: { messageId: 'test', emoji }
        });
        expect(response.status()).toBe(401);
      }
    });
  });

  test.describe('Notifications API Response', () => {
    test('should return proper error for unauthorized GET', async ({ request }) => {
      const response = await request.get('/api/chat/notifications');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should handle unreadOnly parameter', async ({ request }) => {
      const response = await request.get('/api/chat/notifications?unreadOnly=true');
      expect(response.status()).toBe(401);
    });

    test('should handle limit parameter', async ({ request }) => {
      const response = await request.get('/api/chat/notifications?limit=10');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Users API Response', () => {
    test('should return proper error for unauthorized', async ({ request }) => {
      const response = await request.get('/api/chat/users?q=test');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should handle limit parameter', async ({ request }) => {
      const response = await request.get('/api/chat/users?q=test&limit=5');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('DM API Response', () => {
    test('should return proper error for unauthorized GET', async ({ request }) => {
      const response = await request.get('/api/chat/dm?userId=test');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should return proper error for unauthorized POST', async ({ request }) => {
      const response = await request.post('/api/chat/dm', {
        data: { receiverId: 'test', content: 'Hello!' }
      });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should return proper error for conversations list', async ({ request }) => {
      const response = await request.get('/api/chat/dm/conversations');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });
  });

  test.describe('Typing Indicator API Response', () => {
    test('should return proper error for unauthorized POST', async ({ request }) => {
      const response = await request.post('/api/chat/typing', {
        data: { channelId: null }
      });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should return proper error for unauthorized DELETE', async ({ request }) => {
      const response = await request.delete('/api/chat/typing');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });
  });

  test.describe('Presence API Response', () => {
    test('should return proper error for unauthorized GET', async ({ request }) => {
      const response = await request.get('/api/chat/presence');
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should return proper error for unauthorized POST', async ({ request }) => {
      const response = await request.post('/api/chat/presence', {
        data: { status: 'online' }
      });
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
    });

    test('should handle different status values', async ({ request }) => {
      const statuses = ['online', 'away', 'busy', 'offline'];

      for (const status of statuses) {
        const response = await request.post('/api/chat/presence', {
          data: { status }
        });
        expect(response.status()).toBe(401);
      }
    });
  });
});
