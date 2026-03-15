import * as Module from "../useAccountGuarantee";

describe("useAccountGuarantee smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useAccountGuarantee export", () => {
    expect(typeof Module.useAccountGuarantee).toBe("function");
  });
});
