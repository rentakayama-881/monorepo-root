import { formatRepoFileKindLabel, formatRepoFileVisibilityLabel } from "../repoFileLabels";

describe("repoFileLabels.js", () => {
  describe("formatRepoFileKindLabel", () => {
    it("should return known label for task_input", () => {
      expect(formatRepoFileKindLabel("task_input")).toBe("Task Input");
    });

    it("should return known label for case_readme", () => {
      expect(formatRepoFileKindLabel("case_readme")).toBe("Case README");
    });

    it("should return known label for validator_output", () => {
      expect(formatRepoFileKindLabel("validator_output")).toBe("Validator Output");
    });

    it("should return known label for sensitive_context", () => {
      expect(formatRepoFileKindLabel("sensitive_context")).toBe("Sensitive Context");
    });

    it("should humanize unknown slug", () => {
      expect(formatRepoFileKindLabel("some_custom_kind")).toBe("Some Custom Kind");
    });

    it('should return "-" for null', () => {
      expect(formatRepoFileKindLabel(null)).toBe("-");
    });

    it('should return "-" for empty string', () => {
      expect(formatRepoFileKindLabel("")).toBe("-");
    });

    it("should be case-insensitive", () => {
      expect(formatRepoFileKindLabel("TASK_INPUT")).toBe("Task Input");
    });
  });

  describe("formatRepoFileVisibilityLabel", () => {
    it("should return Public for public", () => {
      expect(formatRepoFileVisibilityLabel("public")).toBe("Public");
    });

    it("should return Assigned Validators for assigned_validators", () => {
      expect(formatRepoFileVisibilityLabel("assigned_validators")).toBe("Assigned Validators");
    });

    it("should humanize unknown value", () => {
      expect(formatRepoFileVisibilityLabel("team_only")).toBe("Team Only");
    });

    it('should return "-" for null', () => {
      expect(formatRepoFileVisibilityLabel(null)).toBe("-");
    });

    it('should return "-" for empty string', () => {
      expect(formatRepoFileVisibilityLabel("")).toBe("-");
    });
  });
});
