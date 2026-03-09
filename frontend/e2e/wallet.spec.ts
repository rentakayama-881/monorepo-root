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

    await page.getByTestId("setpin-pin-input").fill(testPin);
    await page.getByTestId("setpin-confirm-input").fill(testPin);
    await page.getByTestId("setpin-save-button").click();

    await page.goto("/account/wallet/send");

    await expect(page.getByTestId("transfer-pin-input")).toBeVisible();
  });

  test("PIN lockout after 4 failed attempts", async ({ page }) => {
    test.skip(!hasUserAuthState, "Missing playwright/.auth/user.json storage state.");
    test.skip(
      process.env.E2E_RUN_PIN_LOCKOUT !== "true",
      "Set E2E_RUN_PIN_LOCKOUT=true to run destructive lockout test."
    );

    await page.goto("/account/wallet/send");

    for (let i = 0; i < 4; i += 1) {
      await page.getByTestId("transfer-pin-input").fill("0000");
      await page.getByTestId("transfer-submit-button").click();
    }

    await expect(page.getByText(/terkunci|locked|coba lagi/i)).toBeVisible();
  });
});
