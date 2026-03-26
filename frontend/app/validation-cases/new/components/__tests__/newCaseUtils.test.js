import {
  checklistItems,
  sensitivityOptions,
  titleMinLength,
  titleMaxLength,
  sanitizeNumericInput,
  hasConnectedTelegramAuth,
  getTagDimensionFromSlug,
  formatCreateCaseError,
  extractDocumentId,
  pickDefaultCategory,
} from "../newCaseUtils";

describe("newCaseUtils", () => {
  describe("constants", () => {
    it("exports checklistItems as array of 4", () => {
      expect(Array.isArray(checklistItems)).toBe(true);
      expect(checklistItems.length).toBe(4);
      expect(checklistItems[0]).toHaveProperty("key");
      expect(checklistItems[0]).toHaveProperty("label");
    });

    it("exports sensitivity options", () => {
      expect(sensitivityOptions).toEqual(["S0", "S1", "S2", "S3"]);
    });

    it("exports title length bounds", () => {
      expect(titleMinLength).toBe(3);
      expect(titleMaxLength).toBe(200);
    });
  });

  describe("sanitizeNumericInput", () => {
    it("strips non-numeric characters", () => {
      expect(sanitizeNumericInput("abc123def")).toBe("123");
      expect(sanitizeNumericInput("00123")).toBe("123");
    });

    it("handles empty/null input", () => {
      expect(sanitizeNumericInput("")).toBe("");
      expect(sanitizeNumericInput(null)).toBe("");
    });
  });

  describe("hasConnectedTelegramAuth", () => {
    it("returns true when connected", () => {
      expect(hasConnectedTelegramAuth({ connected: true })).toBe(true);
    });

    it("returns false for invalid input", () => {
      expect(hasConnectedTelegramAuth(null)).toBe(false);
      expect(hasConnectedTelegramAuth({})).toBe(false);
    });
  });

  describe("getTagDimensionFromSlug", () => {
    it("returns correct dimension for known prefixes", () => {
      expect(getTagDimensionFromSlug("artifact-code")).toBe("artifact");
      expect(getTagDimensionFromSlug("stage-review")).toBe("stage");
      expect(getTagDimensionFromSlug("domain-science")).toBe("domain");
      expect(getTagDimensionFromSlug("evidence-doc")).toBe("evidence");
    });

    it("returns empty for unknown prefixes", () => {
      expect(getTagDimensionFromSlug("random-tag")).toBe("");
    });
  });

  describe("formatCreateCaseError", () => {
    it("formats error with details", () => {
      expect(formatCreateCaseError({ message: "Error", details: "more info" })).toBe(
        "Error: more info"
      );
    });

    it("uses fallback when no message", () => {
      expect(formatCreateCaseError({})).toBe("Gagal membuat Validation Case");
    });

    it("returns details for generic messages", () => {
      expect(formatCreateCaseError({ message: "Input tidak valid", details: "title wajib" })).toBe(
        "title wajib"
      );
    });
  });

  describe("extractDocumentId", () => {
    it("extracts from various key patterns", () => {
      expect(extractDocumentId({ document_id: "abc" })).toBe("abc");
      expect(extractDocumentId({ data: { documentId: "xyz" } })).toBe("xyz");
    });

    it("returns empty for invalid input", () => {
      expect(extractDocumentId(null)).toBe("");
    });
  });

  describe("pickDefaultCategory", () => {
    it("returns null for empty list", () => {
      expect(pickDefaultCategory([])).toBeNull();
    });

    it("returns single item", () => {
      const item = { slug: "coding", name: "Coding" };
      expect(pickDefaultCategory([item])).toBe(item);
    });

    it("prefers general slug", () => {
      const items = [
        { slug: "coding", name: "Coding" },
        { slug: "general", name: "General" },
      ];
      expect(pickDefaultCategory(items).slug).toBe("general");
    });
  });
});
