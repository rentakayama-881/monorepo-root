import * as Module from "../Hero";

describe("Hero smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export that is a function", () => {
    expect(typeof Module.default).toBe("function");
  });
});
