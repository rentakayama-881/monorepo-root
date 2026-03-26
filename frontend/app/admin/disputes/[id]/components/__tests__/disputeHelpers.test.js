import {
  formatDate,
  formatAmount,
  normalizeStatus,
  getStatusColor,
  getStatusLabel,
  getCategoryLabel,
} from "../disputeHelpers";

jest.mock("@/lib/format", () => ({
  formatDateShortTime: jest.fn((d) => `formatted:${d}`),
  formatCurrency: jest.fn((v) => `Rp ${v}`),
}));

describe("disputeHelpers", () => {
  describe("formatDate", () => {
    it("re-exports formatDateShortTime", () => {
      expect(formatDate("2024-01-01")).toBe("formatted:2024-01-01");
    });
  });

  describe("formatAmount", () => {
    it("re-exports formatCurrency", () => {
      expect(formatAmount(50000)).toBe("Rp 50000");
    });
  });

  describe("normalizeStatus", () => {
    it("lowercases and strips whitespace", () => {
      expect(normalizeStatus("Under Review")).toBe("underreview");
      expect(normalizeStatus("Open")).toBe("open");
      expect(normalizeStatus("")).toBe("");
    });
  });

  describe("getStatusColor", () => {
    it("returns warning color for open", () => {
      expect(getStatusColor("open")).toContain("warning");
    });

    it("returns primary color for underreview", () => {
      expect(getStatusColor("Under Review")).toContain("primary");
    });

    it("returns success color for resolved", () => {
      expect(getStatusColor("resolved")).toContain("success");
    });

    it("returns muted for unknown status", () => {
      expect(getStatusColor("xyz")).toContain("muted");
    });
  });

  describe("getStatusLabel", () => {
    it("returns Menunggu Review for open", () => {
      expect(getStatusLabel("open")).toBe("Menunggu Review");
    });

    it("returns Sedang Ditinjau for underreview", () => {
      expect(getStatusLabel("Under Review")).toBe("Sedang Ditinjau");
    });

    it("returns Selesai for resolved", () => {
      expect(getStatusLabel("resolved")).toBe("Selesai");
    });

    it("returns Dibatalkan for cancelled", () => {
      expect(getStatusLabel("cancelled")).toBe("Dibatalkan");
    });

    it("returns raw status for unknown", () => {
      expect(getStatusLabel("custom")).toBe("custom");
    });
  });

  describe("getCategoryLabel", () => {
    it("maps ItemNotReceived", () => {
      expect(getCategoryLabel("ItemNotReceived")).toBe("Barang Tidak Diterima");
    });

    it("maps ItemNotAsDescribed", () => {
      expect(getCategoryLabel("ItemNotAsDescribed")).toBe("Tidak Sesuai Deskripsi");
    });

    it("maps Fraud", () => {
      expect(getCategoryLabel("Fraud")).toBe("Dugaan Penipuan");
    });

    it("maps SellerNotResponding", () => {
      expect(getCategoryLabel("SellerNotResponding")).toBe("Penjual Tidak Merespons");
    });

    it("maps Other", () => {
      expect(getCategoryLabel("Other")).toBe("Lainnya");
    });

    it("returns raw for unknown category", () => {
      expect(getCategoryLabel("CustomCat")).toBe("CustomCat");
    });
  });
});
