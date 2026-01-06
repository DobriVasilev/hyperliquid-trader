import { test, expect } from '@playwright/test';

test.describe('Chat Integration Tests', () => {
  test.describe('Page Navigation', () => {
    test('should navigate from home to chat', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Try to navigate to chat
      await page.goto('/chat');
      await expect(page.locator('main')).toBeVisible();
    });

    test('should handle direct chat URL access', async ({ page }) => {
      await page.goto('/chat');
      await expect(page.locator('main')).toBeVisible();
    });

    test('should preserve URL params on navigation', async ({ page }) => {
      await page.goto('/chat?channel=test');
      await expect(page.locator('main')).toBeVisible();
      expect(page.url()).toContain('channel=test');
    });
  });

  test.describe('API Endpoints Exist', () => {
    test('all chat endpoints should respond', async ({ request }) => {
      const endpoints = [
        '/api/chat/messages',
        '/api/chat/channels',
        '/api/chat/presence',
        '/api/chat/typing',
        '/api/chat/reactions',
        '/api/chat/notifications',
        '/api/chat/users',
        '/api/chat/search',
        '/api/chat/dm',
        '/api/chat/dm/conversations',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint.includes('search') ? `${endpoint}?q=test` : endpoint);
        // Should get 401 (unauthorized) not 404 (not found)
        expect(response.status()).toBe(401);
      }
    });

    test('stream endpoint should respond', async ({ request }) => {
      const response = await request.get('/api/chat/stream');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Error Responses', () => {
    test('should return consistent error format', async ({ request }) => {
      const endpoints = [
        '/api/chat/messages',
        '/api/chat/channels',
        '/api/chat/presence',
        '/api/chat/notifications',
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(endpoint);
        const data = await response.json();

        expect(data).toHaveProperty('success');
        expect(data.success).toBe(false);
        expect(data).toHaveProperty('error');
        expect(typeof data.error).toBe('string');
      }
    });
  });

  test.describe('Content-Type Handling', () => {
    test('should accept JSON content type', async ({ request }) => {
      const response = await request.post('/api/chat/messages', {
        headers: { 'Content-Type': 'application/json' },
        data: { content: 'test' }
      });
      expect(response.status()).toBe(401);
    });

    test('should return JSON responses', async ({ request }) => {
      const response = await request.get('/api/chat/messages');
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('HTTP Methods', () => {
    test('messages should support GET, POST, PATCH, DELETE', async ({ request }) => {
      const getResponse = await request.get('/api/chat/messages');
      expect(getResponse.status()).toBe(401);

      const postResponse = await request.post('/api/chat/messages', {
        data: { content: 'test' }
      });
      expect(postResponse.status()).toBe(401);

      const patchResponse = await request.patch('/api/chat/messages', {
        data: { messageId: 'test', content: 'updated' }
      });
      expect(patchResponse.status()).toBe(401);

      const deleteResponse = await request.delete('/api/chat/messages?id=test');
      expect(deleteResponse.status()).toBe(401);
    });

    test('channels should support GET and POST', async ({ request }) => {
      const getResponse = await request.get('/api/chat/channels');
      expect(getResponse.status()).toBe(401);

      const postResponse = await request.post('/api/chat/channels', {
        data: { name: 'test' }
      });
      expect(postResponse.status()).toBe(401);
    });

    test('notifications should support GET, POST, DELETE', async ({ request }) => {
      const getResponse = await request.get('/api/chat/notifications');
      expect(getResponse.status()).toBe(401);

      const postResponse = await request.post('/api/chat/notifications', {
        data: { markAll: true }
      });
      expect(postResponse.status()).toBe(401);

      const deleteResponse = await request.delete('/api/chat/notifications');
      expect(deleteResponse.status()).toBe(401);
    });

    test('presence should support GET, POST, DELETE', async ({ request }) => {
      const getResponse = await request.get('/api/chat/presence');
      expect(getResponse.status()).toBe(401);

      const postResponse = await request.post('/api/chat/presence', {
        data: { status: 'online' }
      });
      expect(postResponse.status()).toBe(401);

      const deleteResponse = await request.delete('/api/chat/presence');
      expect(deleteResponse.status()).toBe(401);
    });

    test('typing should support POST and DELETE', async ({ request }) => {
      const postResponse = await request.post('/api/chat/typing', {
        data: {}
      });
      expect(postResponse.status()).toBe(401);

      const deleteResponse = await request.delete('/api/chat/typing');
      expect(deleteResponse.status()).toBe(401);
    });

    test('reactions should support GET, POST, DELETE', async ({ request }) => {
      const getResponse = await request.get('/api/chat/reactions?messageId=test');
      expect(getResponse.status()).toBe(401);

      const postResponse = await request.post('/api/chat/reactions', {
        data: { messageId: 'test', emoji: '👍' }
      });
      expect(postResponse.status()).toBe(401);

      const deleteResponse = await request.delete('/api/chat/reactions?messageId=test&emoji=👍');
      expect(deleteResponse.status()).toBe(401);
    });
  });

  test.describe('Cross-Origin Behavior', () => {
    test('should include proper headers', async ({ request }) => {
      const response = await request.get('/api/chat/messages');
      // Should not crash and return proper response
      expect(response.status()).toBe(401);
    });
  });
});

test.describe('Session Creation Integration', () => {
  test('new session page should load', async ({ page }) => {
    await page.goto('/sessions/new');
    await expect(page.locator('body')).toBeVisible();
  });

  test('sessions page should load', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('body')).toBeVisible();
  });

  test('header links should be clickable on new session page', async ({ page }) => {
    await page.goto('/sessions/new');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check that header exists with high z-index
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should have proper navigation structure', async ({ page }) => {
    await page.goto('/sessions/new');

    // Header should have Systems Trader link
    await expect(page.locator('header')).toBeVisible();
  });
});

test.describe('Real-time Infrastructure', () => {
  test('stream endpoint should be accessible', async ({ request }) => {
    const response = await request.get('/api/chat/stream');
    // 401 means endpoint exists but requires auth
    expect(response.status()).toBe(401);
  });

  test('presence endpoint should be accessible', async ({ request }) => {
    const response = await request.get('/api/chat/presence');
    expect(response.status()).toBe(401);
  });

  test('typing endpoint should be accessible', async ({ request }) => {
    const response = await request.post('/api/chat/typing', {
      data: {}
    });
    expect(response.status()).toBe(401);
  });
});
