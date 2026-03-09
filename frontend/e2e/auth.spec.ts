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

    await page.getByTestId("register-email-input").fill(registerEmail);
    await page.getByTestId("register-password-input").fill(registerPassword);
    await page.getByTestId("register-submit-button").click();

    await expect(page.getByText(/verifikasi|verification|cek email/i)).toBeVisible();

    await page.goto(registerVerifyURL);
    await expect(page.getByText(/verified|terverifikasi|berhasil/i)).toBeVisible();

    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(registerEmail);
    await page.getByTestId("login-password-input").fill(registerPassword);
    await page.getByTestId("login-submit-button").click();

    await expect(page).not.toHaveURL(/\/login$/);

    const logoutButton = page.getByTestId("logout-button");
    if (await logoutButton.count()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login|\/$/);
    }
  });

  test("Login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("login-email-input").fill("not-registered@example.com");
    await page.getByTestId("login-password-input").fill("WrongPassword123");
    await page.getByTestId("login-submit-button").click();

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

    await page.getByTestId("login-email-input").fill(login2FAEmail);
    await page.getByTestId("login-password-input").fill(login2FAPassword);
    await page.getByTestId("login-submit-button").click();

    await expect(page.getByTestId("totp-code-input")).toBeVisible();
  });
});
