import * as Module from "../useAdminBadges";

describe("useAdminBadges smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has default export", () => {
    expect(typeof Module.default).toBe("function");
  });
});
