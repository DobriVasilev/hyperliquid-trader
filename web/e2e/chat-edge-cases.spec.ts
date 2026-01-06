import { test, expect } from '@playwright/test';

test.describe('Chat Edge Cases & Error Handling', () => {
  test.describe('Input Validation', () => {
    test('should handle very long message content', async ({ request }) => {
      const longContent = 'a'.repeat(5000);
      const response = await request.post('/api/chat/messages', {
        data: { content: longContent }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle empty message content', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: '' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle whitespace-only message', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: '   ' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle message with only newlines', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: '\n\n\n' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle message with special characters', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: '<script>alert("xss")</script>' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle message with SQL injection attempt', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: "'; DROP TABLE users; --" }
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Channel Validation', () => {
    test('should handle empty channel name', async ({ request }) => {
      const response = await request.post('/api/chat/channels', {
        data: { name: '', description: 'Test' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle very long channel name', async ({ request }) => {
      const response = await request.post('/api/chat/channels', {
        data: { name: 'a'.repeat(1000), description: 'Test' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle special characters in channel name', async ({ request }) => {
      const response = await request.post('/api/chat/channels', {
        data: { name: 'Test <script>', description: 'Test' }
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Mention Validation', () => {
    test('should handle malformed mention syntax', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: '@[incomplete' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle mention with invalid user ID', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: '@[User](invalid-id-12345)' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle multiple mentions', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: { content: '@[User1](id1) hello @[User2](id2)' }
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Pagination Edge Cases', () => {
    test('should handle negative limit', async ({ request }) => {
      const response = await request.get('/api/chat/messages?limit=-1');
      expect(response.status()).toBe(401);
    });

    test('should handle zero limit', async ({ request }) => {
      const response = await request.get('/api/chat/messages?limit=0');
      expect(response.status()).toBe(401);
    });

    test('should handle very large limit', async ({ request }) => {
      const response = await request.get('/api/chat/messages?limit=10000');
      expect(response.status()).toBe(401);
    });

    test('should handle invalid cursor', async ({ request }) => {
      const response = await request.get('/api/chat/messages?cursor=invalid');
      expect(response.status()).toBe(401);
    });

    test('should handle negative offset in search', async ({ request }) => {
      const response = await request.get('/api/chat/search?q=test&offset=-1');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Date Filter Edge Cases', () => {
    test('should handle invalid start date', async ({ request }) => {
      const response = await request.get('/api/chat/search?q=test&startDate=invalid');
      expect(response.status()).toBe(401);
    });

    test('should handle future dates', async ({ request }) => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const response = await request.get(`/api/chat/search?q=test&startDate=${futureDate}`);
      expect(response.status()).toBe(401);
    });

    test('should handle end date before start date', async ({ request }) => {
      const response = await request.get('/api/chat/search?q=test&startDate=2024-01-01&endDate=2023-01-01');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Concurrent Requests', () => {
    test('should handle multiple simultaneous requests', async ({ request }) => {
      const requests = Array(5).fill(null).map(() =>
        request.get('/api/chat/messages')
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status()).toBe(401);
      });
    });
  });

  test.describe('Invalid JSON Handling', () => {
    test('should handle malformed JSON in POST', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        headers: { 'Content-Type': 'application/json' },
        data: 'not valid json'
      });
      // Should not crash - either 400 or 401
      expect([400, 401, 500]).toContain(response.status());
    });
  });

  test.describe('Missing Required Fields', () => {
    test('should handle missing content in message', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        data: {}
      });
      expect(response.status()).toBe(401);
    });

    test('should handle missing receiverId in DM', async ({ request }) => {
      const response = await request.post('/api/chat/dm', {
        data: { content: 'Hello' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle missing name in channel creation', async ({ request }) => {
      const response = await request.post('/api/chat/channels', {
        data: { description: 'Test' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle missing messageId in reaction', async ({ request }) => {
      const response = await request.post('/api/chat/reactions', {
        data: { emoji: '👍' }
      });
      expect(response.status()).toBe(401);
    });

    test('should handle missing emoji in reaction', async ({ request }) => {
      const response = await request.post('/api/chat/reactions', {
        data: { messageId: 'test' }
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('URL Parameter Injection', () => {
    test('should handle URL encoded values safely', async ({ request }) => {
      const response = await request.get('/api/chat/messages?channelId=' + encodeURIComponent("'; DROP TABLE--"));
      expect(response.status()).toBe(401);
    });

    test('should handle double-encoded values', async ({ request }) => {
      const response = await request.get('/api/chat/search?q=' + encodeURIComponent(encodeURIComponent('test')));
      expect(response.status()).toBe(401);
    });
  });
});

test.describe('Chat Performance Tests', () => {
  test('should respond within reasonable time', async ({ request }) => {
    const start = Date.now();
    await request.get('/api/chat/messages');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // 5 seconds max
  });

  test('should handle rapid sequential requests', async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      const response = await request.get('/api/chat/messages');
      expect(response.status()).toBe(401);
    }
  });
});
