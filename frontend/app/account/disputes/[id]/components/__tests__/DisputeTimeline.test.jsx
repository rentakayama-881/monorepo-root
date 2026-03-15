import * as Module from "../DisputeTimeline";

describe("DisputeTimeline", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(Module.default).toBeDefined();
    expect(typeof Module.default).toBe("function");
  });
});
