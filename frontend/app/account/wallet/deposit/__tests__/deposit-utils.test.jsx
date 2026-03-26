import {
  normalizeNetworkName,
  normalizeWallet,
  normalizeDeposit,
  getStatusLabel,
  quickAmounts,
  minDeposit,
  CRYPTO_OPTIONS,
} from "../deposit-utils";

jest.mock("@/components/wallet/CryptoIcons", () => ({
  TonIcon: () => "TonIcon",
  UsdtIcon: () => "UsdtIcon",
}));

jest.mock("@/lib/featureApi", () => ({
  unwrapFeatureData: jest.fn((d) => d),
}));

describe("deposit-utils", () => {
  describe("constants", () => {
    it("CRYPTO_OPTIONS has USDT and TON", () => {
      expect(CRYPTO_OPTIONS).toHaveLength(2);
      expect(CRYPTO_OPTIONS[0].value).toBe("USDT");
      expect(CRYPTO_OPTIONS[1].value).toBe("TON");
    });

    it("quickAmounts is defined", () => {
      expect(quickAmounts).toEqual([2000, 5000, 10000, 50000, 100000]);
    });

    it("minDeposit is 2000", () => {
      expect(minDeposit).toBe(2000);
    });
  });

  describe("normalizeNetworkName", () => {
    it("maps known OxaPay network names", () => {
      expect(normalizeNetworkName("Tron Network")).toBe("TRC20");
      expect(normalizeNetworkName("TON Network")).toBe("TON");
      expect(normalizeNetworkName("BSC Mainnet")).toBe("BEP20");
      expect(normalizeNetworkName("Ethereum Mainnet")).toBe("ERC20");
      expect(normalizeNetworkName("Polygon Mainnet")).toBe("Polygon");
      expect(normalizeNetworkName("Solana Mainnet")).toBe("SOL");
    });

    it("returns original name for unknown networks", () => {
      expect(normalizeNetworkName("Custom Network")).toBe("Custom Network");
    });

    it("returns empty string for falsy input", () => {
      expect(normalizeNetworkName("")).toBe("");
      expect(normalizeNetworkName(null)).toBe("");
      expect(normalizeNetworkName(undefined)).toBe("");
    });
  });

  describe("normalizeWallet", () => {
    it("extracts balance and has_pin", () => {
      const result = normalizeWallet({ balance: 50000, pinSet: true });
      expect(result.balance).toBe(50000);
      expect(result.has_pin).toBe(true);
    });

    it("defaults to 0 balance and false pin", () => {
      const result = normalizeWallet({});
      expect(result.balance).toBe(0);
      expect(result.has_pin).toBe(false);
    });

    it("handles PascalCase fields", () => {
      const result = normalizeWallet({ Balance: 30000, PinSet: true });
      expect(result.balance).toBe(30000);
      expect(result.has_pin).toBe(true);
    });
  });

  describe("normalizeDeposit", () => {
    it("normalizes deposit item fields", () => {
      const result = normalizeDeposit({
        id: "dep-1",
        amount: 10000,
        payCurrency: "USDT",
        payAmount: "6.5",
        network: "TRC20",
        status: "Paid",
        createdAt: "2024-01-01",
        platformFee: 500,
      });
      expect(result.id).toBe("dep-1");
      expect(result.amount).toBe(10000);
      expect(result.payCurrency).toBe("USDT");
      expect(result.status).toBe("Paid");
      expect(result.platformFee).toBe(500);
    });

    it("handles null input", () => {
      const result = normalizeDeposit(null);
      expect(result.id).toBe("");
      expect(result.amount).toBe(0);
      expect(result.status).toBe("WaitingPayment");
    });
  });

  describe("getStatusLabel", () => {
    it("returns correct label for waitingpayment", () => {
      const { label } = getStatusLabel("WaitingPayment");
      expect(label).toBe("Menunggu Pembayaran");
    });

    it("returns correct label for confirming", () => {
      const { label } = getStatusLabel("confirming");
      expect(label).toBe("Mengonfirmasi");
    });

    it("returns correct label for paid", () => {
      const { label } = getStatusLabel("paid");
      expect(label).toBe("Terbayar");
    });

    it("returns correct label for approved", () => {
      const { label } = getStatusLabel("approved");
      expect(label).toBe("Berhasil");
    });

    it("returns correct label for expired", () => {
      const { label } = getStatusLabel("expired");
      expect(label).toBe("Kedaluwarsa");
    });

    it("returns correct label for failed", () => {
      const { label } = getStatusLabel("failed");
      expect(label).toBe("Gagal");
    });

    it("returns correct label for cancelled", () => {
      const { label } = getStatusLabel("cancelled");
      expect(label).toBe("Dibatalkan");
    });

    it("returns raw status for unknown status", () => {
      const { label } = getStatusLabel("custom");
      expect(label).toBe("custom");
    });
  });
});
