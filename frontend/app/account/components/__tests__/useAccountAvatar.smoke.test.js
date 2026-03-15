import * as Module from "../useAccountAvatar";

describe("useAccountAvatar smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useAccountAvatar export", () => {
    expect(typeof Module.useAccountAvatar).toBe("function");
  });
});
