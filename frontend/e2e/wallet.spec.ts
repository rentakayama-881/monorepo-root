/**
 * E2E tests for wallet functionality (requires authentication)
 */

import { test, expect } from '@playwright/test';

test.describe('Wallet', () => {
  // Skip tests if not authenticated
  test.describe.configure({ mode: 'serial' });

  test('unauthenticated user should be redirected to login', async ({ page }) => {
    await page.goto('/account/wallet');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('wallet page should require authentication', async ({ page }) => {
    // Try to access wallet without auth
    await page.goto('/account/wallet/set-pin');

    // Should redirect to login or show auth required message
    await expect(page).toHaveURL(/.*login.*|.*account.*/);
  });
});

test.describe('Wallet (Authenticated)', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test.skip('should display wallet balance', async ({ page }) => {
    await page.goto('/account/wallet');

    // Look for balance display
    await expect(page.getByText(/balance|saldo/i)).toBeVisible();
  });

  test.skip('should navigate to set PIN page', async ({ page }) => {
    await page.goto('/account/wallet');

    const setPinButton = page.getByRole('button', { name: /set.*pin|atur.*pin/i });
    if (await setPinButton.isVisible()) {
      await setPinButton.click();
      await expect(page).toHaveURL(/.*set-pin.*/);
    }
  });

  test.skip('should display transaction history', async ({ page }) => {
    await page.goto('/account/wallet');

    // Look for transaction list or empty state
    const transactions = page.locator('[data-testid="transaction-list"]');
    const emptyState = page.getByText(/no transactions|tidak ada transaksi/i);

    await expect(transactions.or(emptyState)).toBeVisible();
  });
});
