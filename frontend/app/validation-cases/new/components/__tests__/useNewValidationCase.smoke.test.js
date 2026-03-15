import * as Module from "../useNewValidationCase";

describe("useNewValidationCase smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useNewValidationCase export", () => {
    expect(typeof Module.useNewValidationCase).toBe("function");
  });
});
