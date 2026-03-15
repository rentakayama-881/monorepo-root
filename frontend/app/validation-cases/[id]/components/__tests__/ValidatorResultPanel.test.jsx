import * as Module from "../ValidatorResultPanel";

describe("ValidatorResultPanel", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(typeof Module.default).toBe("function");
  });
});
