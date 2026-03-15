import * as Module from "../BadgeForm";

describe("BadgeForm", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(Module.default).toBeDefined();
    expect(typeof Module.default).toBe("function");
  });
});
