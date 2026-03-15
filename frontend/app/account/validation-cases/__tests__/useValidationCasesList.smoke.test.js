import * as Module from "../useValidationCasesList";

describe("useValidationCasesList smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has default export", () => {
    expect(typeof Module.default).toBe("function");
  });
});
