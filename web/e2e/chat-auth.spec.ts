import { test, expect } from '@playwright/test';

test.describe('Chat Authentication & Access', () => {
  test('should show sign in prompt for unauthenticated users', async ({ page }) => {
    await page.goto('/chat');

    // Should show sign in message
    await expect(page.getByText('Sign in to access chat')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  test('should have working sign in link', async ({ page }) => {
    await page.goto('/chat');

    const signInLink = page.getByRole('link', { name: 'Sign In' });
    await expect(signInLink).toHaveAttribute('href', '/api/auth/signin');
  });

  test('should load chat page structure', async ({ page }) => {
    await page.goto('/chat');

    // Basic page structure should exist
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have proper page title area', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Chat API Routes - Unauthenticated', () => {
  test('should return 401 for messages endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/messages');
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  test('should return 401 for channels endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/channels');
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should return 401 for presence endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/presence');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for notifications endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/notifications');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for search endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/search?q=test');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for users endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/users');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for DM conversations endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/dm/conversations');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for reactions endpoint without auth', async ({ request }) => {
    const response = await request.get('/api/chat/reactions?messageId=test');
    expect(response.status()).toBe(401);
  });

  test('should return 401 for POST to messages without auth', async ({ request }) => {
    const response = await request.post('/api/chat/messages', {
      data: { content: 'test' }
    });
    expect(response.status()).toBe(401);
  });

  test('should return 401 for POST to channels without auth', async ({ request }) => {
    const response = await request.post('/api/chat/channels', {
      data: { name: 'test' }
    });
    expect(response.status()).toBe(401);
  });
});
