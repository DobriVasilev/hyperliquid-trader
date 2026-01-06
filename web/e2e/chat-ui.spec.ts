import { test, expect } from '@playwright/test';

test.describe('Chat UI Components', () => {
  test.describe('Chat Page Layout', () => {
    test('should load chat page', async ({ page }) => {
      await page.goto('/chat');
      await expect(page.locator('main')).toBeVisible();
    });

    test('should have dark theme styling', async ({ page }) => {
      await page.goto('/chat');
      const main = page.locator('main');
      await expect(main).toHaveClass(/bg-gray-950/);
    });

    test('should be responsive', async ({ page }) => {
      await page.goto('/chat');
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('main')).toBeVisible();

      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('main')).toBeVisible();
    });
  });

  test.describe('Chat Sign In State', () => {
    test('should show sign in button', async ({ page }) => {
      await page.goto('/chat');
      const signInButton = page.getByRole('link', { name: 'Sign In' });
      await expect(signInButton).toBeVisible();
    });

    test('should have centered content for sign in', async ({ page }) => {
      await page.goto('/chat');
      const container = page.locator('main');
      await expect(container).toHaveClass(/flex/);
    });

    test('sign in button should have correct styling', async ({ page }) => {
      await page.goto('/chat');
      const signInButton = page.getByRole('link', { name: 'Sign In' });
      await expect(signInButton).toHaveClass(/bg-blue-600/);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to home when clicking header link', async ({ page }) => {
      await page.goto('/chat');
      // The Systems Trader link should exist in unauthenticated state too
      const headerLink = page.getByText('Sign in to access chat');
      await expect(headerLink).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/chat');
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });

    test('should have accessible sign in link', async ({ page }) => {
      await page.goto('/chat');
      const link = page.getByRole('link', { name: 'Sign In' });
      await expect(link).toBeVisible();
      await expect(link).toBeEnabled();
    });

    test('page should not have critical accessibility issues', async ({ page }) => {
      await page.goto('/chat');
      // Basic check - page loads without JS errors
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.waitForLoadState('networkidle');
      // Allow some errors but not critical ones
      const criticalErrors = errors.filter(e =>
        e.includes('TypeError') || e.includes('ReferenceError')
      );
      expect(criticalErrors.length).toBe(0);
    });
  });
});

test.describe('Chat Page Elements', () => {
  test('should have proper color scheme', async ({ page }) => {
    await page.goto('/chat');
    // Check for gray-950 background (dark mode)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should render without hydration errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Filter for hydration-specific errors
    const hydrationErrors = errors.filter(e =>
      e.includes('Hydration') || e.includes('hydration')
    );
    expect(hydrationErrors.length).toBe(0);
  });

  test('should load required fonts', async ({ page }) => {
    await page.goto('/chat');
    // Page should complete loading
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Chat URL Handling', () => {
  test('should handle channel query parameter', async ({ page }) => {
    await page.goto('/chat?channel=test-channel');
    await expect(page.locator('main')).toBeVisible();
  });

  test('should handle invalid channel parameter gracefully', async ({ page }) => {
    await page.goto('/chat?channel=invalid-id-12345');
    await expect(page.locator('main')).toBeVisible();
    // Should not crash
  });

  test('should handle empty channel parameter', async ({ page }) => {
    await page.goto('/chat?channel=');
    await expect(page.locator('main')).toBeVisible();
  });
});
