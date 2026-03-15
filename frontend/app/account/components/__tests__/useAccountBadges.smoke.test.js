import * as Module from "../useAccountBadges";

describe("useAccountBadges smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useAccountBadges export", () => {
    expect(typeof Module.useAccountBadges).toBe("function");
  });
});
