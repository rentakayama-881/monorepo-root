import * as Module from "../useAccountProfile";

describe("useAccountProfile smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useAccountProfile export", () => {
    expect(typeof Module.useAccountProfile).toBe("function");
  });
});
