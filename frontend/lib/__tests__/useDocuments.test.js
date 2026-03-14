import { formatFileSize, DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITY } from "../useDocuments";

// We only test the pure utility and constants from useDocuments.
// The hooks themselves require full React/fetch mocking which is better suited for integration tests.

describe("useDocuments.js", () => {
  describe("DOCUMENT_CATEGORIES", () => {
    it("should have categories with value and label", () => {
      expect(DOCUMENT_CATEGORIES.length).toBeGreaterThan(0);
      DOCUMENT_CATEGORIES.forEach((cat) => {
        expect(cat).toHaveProperty("value");
        expect(cat).toHaveProperty("label");
      });
    });

    it("should include whitepaper category", () => {
      expect(DOCUMENT_CATEGORIES.find((c) => c.value === "whitepaper")).toBeDefined();
    });

    it("should include other category", () => {
      expect(DOCUMENT_CATEGORIES.find((c) => c.value === "other")).toBeDefined();
    });
  });

  describe("DOCUMENT_VISIBILITY", () => {
    it("should have visibility options", () => {
      expect(DOCUMENT_VISIBILITY.length).toBeGreaterThan(0);
      expect(DOCUMENT_VISIBILITY.find((v) => v.value === "public")).toBeDefined();
      expect(DOCUMENT_VISIBILITY.find((v) => v.value === "private")).toBeDefined();
    });
  });

  describe("formatFileSize", () => {
    it("should format 0 bytes", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("should format bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1048576)).toBe("1 MB");
    });

    it("should format gigabytes", () => {
      expect(formatFileSize(1073741824)).toBe("1 GB");
    });

    it("should format fractional sizes", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });
  });
});
