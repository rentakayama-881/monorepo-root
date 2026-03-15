import * as Module from "../CommandPalette";

describe("CommandPalette smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export that is a function", () => {
    expect(typeof Module.default).toBe("function");
  });
});
