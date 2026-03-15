import * as Module from "../DemoFormElements";

describe("DemoFormElements", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(typeof Module.default).toBe("function");
  });
});
