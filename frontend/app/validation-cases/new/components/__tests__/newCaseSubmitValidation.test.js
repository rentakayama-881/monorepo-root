import { normalizeTagSlugs, validateNewCaseSubmit } from "../newCaseSubmitValidation";

jest.mock("../newCaseUtils", () => ({
  checklistItems: [
    { key: "scope_clearly_written", label: "Scope" },
    { key: "acceptance_criteria_defined", label: "Criteria" },
    { key: "sensitive_data_filtered", label: "Data" },
    { key: "no_contact_in_case_record", label: "Contact" },
  ],
  sensitivityOptions: ["S0", "S1", "S2", "S3"],
  titleMinLength: 3,
  titleMaxLength: 200,
  getTagDimensionFromSlug: jest.fn((slug) => {
    if (slug.startsWith("artifact-")) return "artifact";
    if (slug.startsWith("domain-")) return "domain";
    return "";
  }),
}));

describe("newCaseSubmitValidation", () => {
  describe("normalizeTagSlugs", () => {
    it("deduplicates and lowercases tags", () => {
      const tags = [{ slug: "Coding" }, { slug: "coding" }, { slug: "UI-UX" }];
      const result = normalizeTagSlugs(tags);
      expect(result).toEqual(["coding", "ui-ux"]);
    });

    it("filters out empty slugs", () => {
      const tags = [{ slug: "" }, { slug: null }, { slug: "valid" }];
      const result = normalizeTagSlugs(tags);
      expect(result).toEqual(["valid"]);
    });
  });

  describe("validateNewCaseSubmit", () => {
    const validParams = {
      caseType: { slug: "general" },
      locked: false,
      telegramGateLocked: false,
      title: "Valid Title",
      bounty: 50000,
      sensitivity: "S1",
      caseRecord: "A valid case record text",
      normalizedTagSlugs: ["artifact-code", "domain-coding"],
      checklist: {
        scope_clearly_written: true,
        acceptance_criteria_defined: true,
        sensitive_data_filtered: true,
        no_contact_in_case_record: true,
      },
    };

    it("returns null for valid input", () => {
      expect(validateNewCaseSubmit(validParams)).toBeNull();
    });

    it("returns error if title is too short", () => {
      const result = validateNewCaseSubmit({ ...validParams, title: "ab" });
      expect(result).toContain("minimal");
    });

    it("returns error if bounty is too low", () => {
      const result = validateNewCaseSubmit({ ...validParams, bounty: 5000 });
      expect(result).toContain("Bounty minimal");
    });

    it("returns error if case record has contact info", () => {
      const result = validateNewCaseSubmit({
        ...validParams,
        caseRecord: "contact me at t.me/user",
      });
      expect(result).toContain("kontak langsung");
    });

    it("returns error if tags count is invalid", () => {
      const result = validateNewCaseSubmit({
        ...validParams,
        normalizedTagSlugs: ["only-one"],
      });
      expect(result).toContain("Tags wajib minimal 2");
    });

    it("returns error if intake is locked", () => {
      const result = validateNewCaseSubmit({ ...validParams, locked: true });
      expect(result).toContain("ditutup");
    });
  });
});
