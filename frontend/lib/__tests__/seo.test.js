import {
  generateValidationCaseStructuredData,
  generateOrganizationStructuredData,
  generateWebsiteStructuredData,
  generateWebApplicationStructuredData,
  generateOpenGraphMetadata,
  generateTwitterMetadata,
  generateCanonicalUrl,
  generateFAQStructuredData,
  generateProfilePageStructuredData,
} from "../seo";

describe("seo.js", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_SITE_URL: "https://aivalid.id" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("generateValidationCaseStructuredData", () => {
    it("should return null for null input", () => {
      expect(generateValidationCaseStructuredData(null)).toBeNull();
    });

    it("should generate valid structured data", () => {
      const result = generateValidationCaseStructuredData({
        title: "Test Case",
        summary: "A test",
        owner: { username: "john" },
        created_at: 1741363200,
      });
      expect(result["@type"]).toBe("CreativeWork");
      expect(result.name).toBe("Test Case");
      expect(result.author.name).toBe("john");
    });

    it("should use Anonymous when no owner", () => {
      const result = generateValidationCaseStructuredData({ title: "Test" });
      expect(result.author.name).toBe("Anonymous");
    });
  });

  describe("generateOrganizationStructuredData", () => {
    it("should return valid organization schema", () => {
      const result = generateOrganizationStructuredData();
      expect(result["@type"]).toBe("Organization");
      expect(result.name).toBe("AIvalid");
      expect(result.url).toBe("https://aivalid.id");
    });
  });

  describe("generateWebsiteStructuredData", () => {
    it("should return valid website schema", () => {
      const result = generateWebsiteStructuredData();
      expect(result["@type"]).toBe("WebSite");
      expect(result.name).toBe("AIvalid");
      expect(result.potentialAction["@type"]).toBe("SearchAction");
    });
  });

  describe("generateWebApplicationStructuredData", () => {
    it("should return valid web application schema", () => {
      const result = generateWebApplicationStructuredData();
      expect(result["@type"]).toBe("WebApplication");
      expect(result.applicationCategory).toBe("BusinessApplication");
    });
  });

  describe("generateOpenGraphMetadata", () => {
    it("should generate OG metadata with defaults", () => {
      const result = generateOpenGraphMetadata({
        title: "Test",
        description: "Desc",
      });
      expect(result.title).toBe("Test");
      expect(result.type).toBe("website");
      expect(result.locale).toBe("id_ID");
      expect(result.siteName).toBe("AIvalid");
    });

    it("should use custom type and url", () => {
      const result = generateOpenGraphMetadata({
        title: "T",
        description: "D",
        type: "article",
        url: "/page",
      });
      expect(result.type).toBe("article");
      expect(result.url).toBe("https://aivalid.id/page");
    });
  });

  describe("generateTwitterMetadata", () => {
    it("should generate twitter card metadata", () => {
      const result = generateTwitterMetadata({
        title: "Test",
        description: "Desc",
      });
      expect(result.card).toBe("summary_large_image");
      expect(result.title).toBe("Test");
    });
  });

  describe("generateCanonicalUrl", () => {
    it("should generate canonical URL with path", () => {
      expect(generateCanonicalUrl("/about")).toBe("https://aivalid.id/about");
    });

    it("should generate canonical URL without path", () => {
      expect(generateCanonicalUrl()).toBe("https://aivalid.id");
    });
  });

  describe("generateFAQStructuredData", () => {
    it("should return null for empty array", () => {
      expect(generateFAQStructuredData([])).toBeNull();
    });

    it("should return null for null", () => {
      expect(generateFAQStructuredData(null)).toBeNull();
    });

    it("should generate FAQ schema", () => {
      const result = generateFAQStructuredData([{ question: "Q1", answer: "A1" }]);
      expect(result["@type"]).toBe("FAQPage");
      expect(result.mainEntity).toHaveLength(1);
      expect(result.mainEntity[0].name).toBe("Q1");
    });
  });

  describe("generateProfilePageStructuredData", () => {
    it("should return null for null user", () => {
      expect(generateProfilePageStructuredData(null)).toBeNull();
    });

    it("should generate profile page schema", () => {
      const result = generateProfilePageStructuredData({
        username: "john",
        display_name: "John Doe",
        bio: "Hello",
      });
      expect(result["@type"]).toBe("ProfilePage");
      expect(result.mainEntity.name).toBe("John Doe");
    });
  });
});
