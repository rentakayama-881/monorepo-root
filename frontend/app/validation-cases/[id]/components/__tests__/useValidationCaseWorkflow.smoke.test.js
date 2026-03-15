import * as Module from "../useValidationCaseWorkflow";

describe("useValidationCaseWorkflow smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useValidationCaseWorkflow export", () => {
    expect(typeof Module.useValidationCaseWorkflow).toBe("function");
  });
});
