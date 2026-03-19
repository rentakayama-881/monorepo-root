import {
  quickAmounts,
  minDeposit,
  normalizeNetworkName,
  normalizeWallet,
  normalizeDeposit,
  getStatusLabel,
} from "../deposit-utils";

describe("deposit-utils", () => {
  describe("constants", () => {
    it("quickAmounts should be sorted ascending", () => {
      for (let i = 1; i < quickAmounts.length; i++) {
        expect(quickAmounts[i]).toBeGreaterThan(quickAmounts[i - 1]);
      }
    });

    it("minDeposit matches first quickAmount", () => {
      expect(minDeposit).toBe(quickAmounts[0]);
    });
  });

  describe("normalizeNetworkName", () => {
    it("returns network name as-is for known networks", () => {
      expect(normalizeNetworkName("TRC20")).toBe("TRC20");
      expect(normalizeNetworkName("trc20")).toBe("trc20");
    });

    it("returns original for unknown networks", () => {
      expect(normalizeNetworkName("SomeNetwork")).toBe("SomeNetwork");
    });

    it("handles empty/null", () => {
      expect(normalizeNetworkName("")).toBe("");
      expect(normalizeNetworkName(null)).toBe("");
    });
  });

  describe("normalizeWallet", () => {
    it("extracts balance and pin status", () => {
      const result = normalizeWallet({ balance: 50000, hasPin: true });
      expect(result.balance).toBe(50000);
      expect(result.has_pin).toBe(true);
    });

    it("handles null/undefined", () => {
      const result = normalizeWallet(null);
      expect(result.balance).toBe(0);
    });
  });

  describe("normalizeDeposit", () => {
    it("normalizes deposit data", () => {
      const result = normalizeDeposit({ Id: "abc", Amount: 1000, Status: "approved" });
      expect(result.id).toBe("abc");
      expect(result.amount).toBe(1000);
    });
  });

  describe("getStatusLabel", () => {
    it("returns correct label for known statuses", () => {
      expect(getStatusLabel("approved").label).toBe("Berhasil");
      expect(getStatusLabel("expired").label).toBe("Kedaluwarsa");
      expect(getStatusLabel("failed").label).toBe("Gagal");
      expect(getStatusLabel("cancelled").label).toBe("Dibatalkan");
    });

    it("uses semantic color tokens", () => {
      const approved = getStatusLabel("approved");
      expect(approved.color).toContain("status-success");
    });

    it("returns input as label for unknown status", () => {
      expect(getStatusLabel("xyz").label).toBe("xyz");
    });
  });
});
