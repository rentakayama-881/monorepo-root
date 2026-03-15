import * as Module from "../useAccountPage";

describe("useAccountPage smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useAccountPage export", () => {
    expect(typeof Module.useAccountPage).toBe("function");
  });
});
