import * as Module from "../BadgeList";

describe("BadgeList", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(Module.default).toBeDefined();
    expect(typeof Module.default).toBe("function");
  });

  it("exports BadgeIconPreview as a named export", () => {
    expect(Module.BadgeIconPreview).toBeDefined();
    expect(typeof Module.BadgeIconPreview).toBe("function");
  });
});
