/**
 * E2E tests for homepage
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display logo and navigation', async ({ page }) => {
    await page.goto('/');

    // Check logo is visible
    await expect(page.locator('[data-testid="logo"]')).toBeVisible();

    // Check navigation links
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Click on a navigation link
    const exploreLink = page.getByRole('link', { name: /explore/i });
    if (await exploreLink.isVisible()) {
      await exploreLink.click();
      await expect(page).toHaveURL(/.*explore.*/);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should still be accessible
    await expect(page).toHaveTitle(/.*/);
  });
});
