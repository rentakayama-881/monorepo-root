import * as Module from "../newCaseUtils";

describe("newCaseUtils smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has checklistItems export", () => {
    expect(Module.checklistItems).toBeDefined();
  });

  it("has createNavigationSections export", () => {
    expect(Module.createNavigationSections).toBeDefined();
  });

  it("has sensitivityOptions export", () => {
    expect(Module.sensitivityOptions).toBeDefined();
  });

  it("has titleMinLength export", () => {
    expect(Module.titleMinLength).toBeDefined();
  });

  it("has titleMaxLength export", () => {
    expect(Module.titleMaxLength).toBeDefined();
  });

  it("has sanitizeNumericInput export", () => {
    expect(typeof Module.sanitizeNumericInput).toBe("function");
  });

  it("has hasConnectedTelegramAuth export", () => {
    expect(typeof Module.hasConnectedTelegramAuth).toBe("function");
  });

  it("has getTagDimensionFromSlug export", () => {
    expect(typeof Module.getTagDimensionFromSlug).toBe("function");
  });

  it("has formatCreateCaseError export", () => {
    expect(typeof Module.formatCreateCaseError).toBe("function");
  });

  it("has extractDocumentId export", () => {
    expect(typeof Module.extractDocumentId).toBe("function");
  });

  it("has pickDefaultCategory export", () => {
    expect(typeof Module.pickDefaultCategory).toBe("function");
  });
});
