import * as Module from "../disputeHelpers";

describe("disputeHelpers smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has formatDate export", () => {
    expect(typeof Module.formatDate).toBe("function");
  });

  it("has formatAmount export", () => {
    expect(typeof Module.formatAmount).toBe("function");
  });

  it("has normalizeStatus export", () => {
    expect(typeof Module.normalizeStatus).toBe("function");
  });

  it("has getStatusColor export", () => {
    expect(typeof Module.getStatusColor).toBe("function");
  });

  it("has getStatusLabel export", () => {
    expect(typeof Module.getStatusLabel).toBe("function");
  });

  it("has getCategoryLabel export", () => {
    expect(typeof Module.getCategoryLabel).toBe("function");
  });
});
