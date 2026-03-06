import { test, expect } from "@playwright/test";

const registerEmail = process.env.E2E_REGISTER_EMAIL ?? "";
const registerPassword = process.env.E2E_REGISTER_PASSWORD ?? "";
const registerVerifyURL = process.env.E2E_REGISTER_VERIFY_URL ?? "";

const login2FAEmail = process.env.E2E_2FA_EMAIL ?? "";
const login2FAPassword = process.env.E2E_2FA_PASSWORD ?? "";

test.describe("Auth flows", () => {
  test("Register -> Verify email -> Login -> Logout", async ({ page }) => {
    test.skip(
      !registerEmail || !registerPassword || !registerVerifyURL,
      "Set E2E_REGISTER_EMAIL, E2E_REGISTER_PASSWORD, and E2E_REGISTER_VERIFY_URL to run this test."
    );

    await page.goto("/register");

    // TODO: switch to stable data-testid selectors if available.
    await page.locator('input[name="email"], input[type="email"]').first().fill(registerEmail);
    await page
      .locator('input[name="password"], input[type="password"]')
      .first()
      .fill(registerPassword);
    await page.locator('button[type="submit"]').first().click();

    await expect(page.getByText(/verifikasi|verification|cek email/i)).toBeVisible();

    await page.goto(registerVerifyURL);
    await expect(page.getByText(/verified|terverifikasi|berhasil/i)).toBeVisible();

    await page.goto("/login");
    await page.locator('input[name="email"], input[type="email"]').first().fill(registerEmail);
    await page
      .locator('input[name="password"], input[type="password"]')
      .first()
      .fill(registerPassword);
    await page.locator('button[type="submit"]').first().click();

    await expect(page).not.toHaveURL(/\/login$/);

    // TODO: replace fallback selector with deterministic logout button selector.
    const logoutButton = page.getByRole("button", { name: /logout|keluar|sign out/i }).first();
    if (await logoutButton.count()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login|\/$/);
    }
  });

  test("Login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page
      .locator('input[name="email"], input[type="email"]')
      .first()
      .fill("not-registered@example.com");
    await page
      .locator('input[name="password"], input[type="password"]')
      .first()
      .fill("WrongPassword123");
    await page.locator('button[type="submit"]').first().click();

    await expect(
      page.getByText(/email atau password salah|invalid credentials|login gagal/i)
    ).toBeVisible();
  });

  test("Login with 2FA enabled shows TOTP prompt", async ({ page }) => {
    test.skip(
      !login2FAEmail || !login2FAPassword,
      "Set E2E_2FA_EMAIL and E2E_2FA_PASSWORD to run this test."
    );

    await page.goto("/login");

    await page.locator('input[name="email"], input[type="email"]').first().fill(login2FAEmail);
    await page
      .locator('input[name="password"], input[type="password"]')
      .first()
      .fill(login2FAPassword);
    await page.locator('button[type="submit"]').first().click();

    // TODO: replace text-based check with explicit TOTP form selector.
    await expect(page.getByText(/totp|otp|authenticator|kode verifikasi/i)).toBeVisible();
  });
});
