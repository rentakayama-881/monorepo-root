import {
  resolveValidationCaseIdFromPathname,
  resolveValidationCaseSkeletonVariant,
  unwrapValidationCase,
} from "../casePublicData";

describe("casePublicData helpers", () => {
  it("unwraps validation_case payloads", () => {
    const wrapped = {
      validation_case: {
        id: 42,
        title: "Wrapped Case",
      },
    };

    expect(unwrapValidationCase(wrapped)).toEqual(wrapped.validation_case);
  });

  it("resolves workspace, standard, and generic skeleton variants", () => {
    expect(
      resolveValidationCaseSkeletonVariant({
        meta: { workflow_family: "evidence_validation_workspace" },
      })
    ).toBe("workspace");

    expect(
      resolveValidationCaseSkeletonVariant({
        meta: { protocol_mode: "workflow_v1" },
      })
    ).toBe("standard");

    expect(resolveValidationCaseSkeletonVariant(null)).toBe("generic");
  });

  it("extracts validation case ids from canonical and nested paths", () => {
    expect(resolveValidationCaseIdFromPathname("/validation-cases/123")).toBe("123");
    expect(resolveValidationCaseIdFromPathname("/validation-cases/case%20123/workspace")).toBe(
      "case 123"
    );
    expect(resolveValidationCaseIdFromPathname("/other-route")).toBe("");
  });
});
