import * as Module from "../useAdminUsers";

describe("useAdminUsers smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has default export", () => {
    expect(typeof Module.default).toBe("function");
  });
});
