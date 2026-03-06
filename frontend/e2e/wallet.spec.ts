import { existsSync } from "node:fs";

import { test, expect } from "@playwright/test";

const hasUserAuthState = existsSync("playwright/.auth/user.json");
const testPin = process.env.E2E_TEST_PIN ?? "";

test.describe("Wallet flows", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("View wallet balance (authenticated)", async ({ page }) => {
    test.skip(!hasUserAuthState, "Missing playwright/.auth/user.json storage state.");

    await page.goto("/account/wallet");
    await expect(page.getByText(/saldo|balance/i)).toBeVisible();
  });

  test("Set PIN -> transfer flow requires PIN", async ({ page }) => {
    test.skip(!hasUserAuthState, "Missing playwright/.auth/user.json storage state.");
    test.skip(!testPin, "Set E2E_TEST_PIN to run this test.");

    await page.goto("/account/wallet/set-pin");

    // TODO: replace with exact selectors for PIN set form if available.
    const pinInputs = page.locator('input[name="pin"], input[inputmode="numeric"]');
    await pinInputs.first().fill(testPin);
    if ((await pinInputs.count()) > 1) {
      await pinInputs.nth(1).fill(testPin);
    }
    await page.locator('button[type="submit"]').first().click();

    await page.goto("/account/wallet/send");

    // TODO: replace with dedicated transfer PIN gate selector.
    await expect(page.getByText(/pin|masukkan pin|verifikasi pin/i)).toBeVisible();
  });

  test("PIN lockout after 4 failed attempts", async ({ page }) => {
    test.skip(!hasUserAuthState, "Missing playwright/.auth/user.json storage state.");
    test.skip(
      process.env.E2E_RUN_PIN_LOCKOUT !== "true",
      "Set E2E_RUN_PIN_LOCKOUT=true to run destructive lockout test."
    );

    await page.goto("/account/wallet/send");

    for (let i = 0; i < 4; i += 1) {
      // TODO: replace with stable selector for transfer PIN verification input.
      await page.locator('input[name="pin"], input[inputmode="numeric"]').first().fill("0000");
      await page.locator('button[type="submit"]').first().click();
    }

    await expect(page.getByText(/terkunci|locked|coba lagi/i)).toBeVisible();
  });
});
