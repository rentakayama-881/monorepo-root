import {
  normalizeStatus,
  getStatusColor,
  getStatusLabel,
  getCategoryLabel,
  getPhaseInfo,
  getResolutionLabel,
} from "../helpers";

describe("dispute helpers", () => {
  describe("normalizeStatus", () => {
    it("lowercases and strips spaces", () => {
      expect(normalizeStatus("Under Review")).toBe("underreview");
    });
    it("handles empty", () => {
      expect(normalizeStatus("")).toBe("");
    });
  });

  describe("getStatusColor", () => {
    it("returns warning for open", () => {
      expect(getStatusColor("open")).toContain("warning");
    });
    it("returns primary for under review", () => {
      expect(getStatusColor("Under Review")).toContain("primary");
    });
    it("returns success for resolved", () => {
      expect(getStatusColor("resolved")).toContain("success");
    });
  });

  describe("getStatusLabel", () => {
    it("maps known statuses", () => {
      expect(getStatusLabel("open")).toBe("Menunggu Review");
      expect(getStatusLabel("resolved")).toBe("Selesai");
      expect(getStatusLabel("cancelled")).toBe("Dibatalkan");
    });
    it("returns raw for unknown", () => {
      expect(getStatusLabel("custom")).toBe("custom");
    });
  });

  describe("getCategoryLabel", () => {
    it("maps known categories", () => {
      expect(getCategoryLabel("ItemNotReceived")).toBe("Barang Tidak Diterima");
      expect(getCategoryLabel("fraud")).toBe("Dugaan Penipuan");
    });
  });

  describe("getPhaseInfo", () => {
    it("returns info for known phases", () => {
      expect(getPhaseInfo("negotiation").title).toBe("Negotiation Phase");
      expect(getPhaseInfo("evidence").title).toBe("Evidence Phase");
      expect(getPhaseInfo("admin_review").title).toBe("Admin Review");
    });
    it("defaults to negotiation for unknown", () => {
      expect(getPhaseInfo("xxx").title).toBe("Negotiation Phase");
    });
  });

  describe("getResolutionLabel", () => {
    it("maps known resolutions", () => {
      expect(getResolutionLabel("refund")).toBe("Refund to Sender");
      expect(getResolutionLabel("split")).toBe("Funds Split");
    });
    it("returns Completed for empty", () => {
      expect(getResolutionLabel("")).toBe("Completed");
    });
  });
});
