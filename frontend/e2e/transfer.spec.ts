import { existsSync } from "node:fs";

import { test, expect } from "@playwright/test";

const hasSenderState = existsSync("playwright/.auth/sender.json");
const hasReceiverState = existsSync("playwright/.auth/receiver.json");

const receiverIdentifier = process.env.E2E_RECEIVER_IDENTIFIER ?? "";
const transferAmount = process.env.E2E_TRANSFER_AMOUNT ?? "10000";

test.describe("Transfer flows", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: "playwright/.auth/sender.json" });

  test("Create transfer -> receiver sees pending transfer", async ({ browser }) => {
    test.skip(!hasSenderState || !hasReceiverState, "Missing sender/receiver storage state files.");
    test.skip(!receiverIdentifier, "Set E2E_RECEIVER_IDENTIFIER to run this test.");

    const senderContext = await browser.newContext({
      storageState: "playwright/.auth/sender.json",
    });
    const receiverContext = await browser.newContext({
      storageState: "playwright/.auth/receiver.json",
    });

    try {
      const senderPage = await senderContext.newPage();
      const receiverPage = await receiverContext.newPage();

      await senderPage.goto("/account/wallet/send");

      // TODO: replace with stable transfer form selectors (data-testid).
      await senderPage
        .locator('input[name="recipient"], input[name="receiver"], input[type="text"]')
        .first()
        .fill(receiverIdentifier);
      await senderPage
        .locator('input[name="amount"], input[type="number"]')
        .first()
        .fill(transferAmount);
      await senderPage.locator('button[type="submit"]').first().click();

      await expect(senderPage.getByText(/pending|menunggu|berhasil dibuat/i)).toBeVisible();

      await receiverPage.goto("/account/wallet/transactions");
      await expect(receiverPage.getByText(/pending|menunggu/i)).toBeVisible();
    } finally {
      await senderContext.close();
      await receiverContext.close();
    }
  });

  test("Release transfer -> balance updates", async ({ page }) => {
    const transferID = process.env.E2E_PENDING_TRANSFER_ID ?? "";
    test.skip(!transferID, "Set E2E_PENDING_TRANSFER_ID to run this test.");

    await page.goto(`/account/wallet/transactions/${transferID}`);

    // TODO: replace with stable release action selector.
    await page
      .getByRole("button", { name: /release|lepaskan|selesaikan/i })
      .first()
      .click();

    await expect(page.getByText(/saldo|balance|berhasil/i)).toBeVisible();
  });

  test("Cancel transfer -> funds returned", async ({ page }) => {
    const transferID = process.env.E2E_CANCEL_TRANSFER_ID ?? "";
    test.skip(!transferID, "Set E2E_CANCEL_TRANSFER_ID to run this test.");

    await page.goto(`/account/wallet/transactions/${transferID}`);

    // TODO: replace with stable cancel action selector.
    await page
      .getByRole("button", { name: /cancel|batalkan/i })
      .first()
      .click();

    await expect(page.getByText(/dana dikembalikan|refunded|saldo/i)).toBeVisible();
  });
});
