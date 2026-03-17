import * as Module from "../selectUtils";

describe("selectUtils smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has normalizeOptions export", () => {
    expect(typeof Module.normalizeOptions).toBe("function");
  });

  it("has groupOptions export", () => {
    expect(typeof Module.groupOptions).toBe("function");
  });

  it("has filterOptions export", () => {
    expect(typeof Module.filterOptions).toBe("function");
  });

  it("has getDisplayText export", () => {
    expect(typeof Module.getDisplayText).toBe("function");
  });

  it("has selectPropTypes export", () => {
    expect(Module.selectPropTypes).toBeDefined();
  });
});
