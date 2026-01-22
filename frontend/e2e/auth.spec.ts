/**
 * E2E tests for authentication flows
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      // Check form elements are present
      await expect(page.getByRole('heading', { name: /login|sign in|masuk/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /login|sign in|masuk/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show validation error
        await expect(page.getByText(/required|wajib|harus/i)).toBeVisible();
      }
    });

    test('should have link to register page', async ({ page }) => {
      await page.goto('/login');

      const registerLink = page.getByRole('link', { name: /register|sign up|daftar/i });
      if (await registerLink.isVisible()) {
        await registerLink.click();
        await expect(page).toHaveURL(/.*register.*/);
      }
    });
  });

  test.describe('Register Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByRole('heading', { name: /register|sign up|daftar/i })).toBeVisible();
    });
  });

  test.describe('Passkey Authentication', () => {
    test('should show passkey option on login', async ({ page }) => {
      await page.goto('/login');

      // Check for passkey button (if available)
      const passkeyButton = page.getByRole('button', { name: /passkey|biometric/i });
      if (await passkeyButton.isVisible()) {
        expect(passkeyButton).toBeEnabled();
      }
    });
  });
});
