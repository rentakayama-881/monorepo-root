import {
  resolveValidationCaseWorkflow,
  isWorkspaceValidationCase,
  getWorkspaceDisplayName,
  WORKFLOW_FAMILY_WORKSPACE,
  LEGACY_PROTOCOL_REPO,
  LEGACY_PROTOCOL_V1,
} from "../validationCaseWorkflow";

describe("validationCaseWorkflow.js", () => {
  describe("constants", () => {
    it("should export workflow family workspace constant", () => {
      expect(WORKFLOW_FAMILY_WORKSPACE).toBe("evidence_validation_workspace");
    });

    it("should export legacy protocol repo constant", () => {
      expect(LEGACY_PROTOCOL_REPO).toBe("repo_validation_v2");
    });

    it("should export legacy protocol v1 constant", () => {
      expect(LEGACY_PROTOCOL_V1).toBe("workflow_v1");
    });
  });

  describe("resolveValidationCaseWorkflow", () => {
    it("should return workspace family when workflow_family matches", () => {
      expect(
        resolveValidationCaseWorkflow({ workflow_family: "evidence_validation_workspace" })
      ).toBe(WORKFLOW_FAMILY_WORKSPACE);
    });

    it("should be case-insensitive for workflow_family", () => {
      expect(
        resolveValidationCaseWorkflow({ workflow_family: "Evidence_Validation_Workspace" })
      ).toBe(WORKFLOW_FAMILY_WORKSPACE);
    });

    it("should map legacy protocol_mode repo_validation_v2 to workspace", () => {
      expect(resolveValidationCaseWorkflow({ protocol_mode: "repo_validation_v2" })).toBe(
        WORKFLOW_FAMILY_WORKSPACE
      );
    });

    it("should map legacy protocol_mode workflow_v1", () => {
      expect(resolveValidationCaseWorkflow({ protocol_mode: "workflow_v1" })).toBe(
        LEGACY_PROTOCOL_V1
      );
    });

    it("should default to legacy v1 for no markers", () => {
      expect(resolveValidationCaseWorkflow({})).toBe(LEGACY_PROTOCOL_V1);
    });

    it("should default to legacy v1 for null", () => {
      expect(resolveValidationCaseWorkflow(null)).toBe(LEGACY_PROTOCOL_V1);
    });
  });

  describe("isWorkspaceValidationCase", () => {
    it("should return true for workspace workflow", () => {
      expect(isWorkspaceValidationCase({ workflow_family: "evidence_validation_workspace" })).toBe(
        true
      );
    });

    it("should return false for legacy workflow", () => {
      expect(isWorkspaceValidationCase({ protocol_mode: "workflow_v1" })).toBe(false);
    });

    it("should return false for null", () => {
      expect(isWorkspaceValidationCase(null)).toBe(false);
    });
  });

  describe("getWorkspaceDisplayName", () => {
    it("should return custom workflow_name when present", () => {
      expect(getWorkspaceDisplayName({ workflow_name: "Custom Workspace" })).toBe(
        "Custom Workspace"
      );
    });

    it("should return default name when no custom name", () => {
      expect(getWorkspaceDisplayName({})).toBe("Evidence Validation Workspace");
    });

    it("should return default name for null", () => {
      expect(getWorkspaceDisplayName(null)).toBe("Evidence Validation Workspace");
    });

    it("should trim whitespace from custom name", () => {
      expect(getWorkspaceDisplayName({ workflow_name: "  Trimmed  " })).toBe("Trimmed");
    });
  });
});
