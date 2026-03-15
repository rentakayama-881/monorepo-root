import * as Module from "../CaseSharedComponents";

describe("CaseSharedComponents", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("exports StatusBadge as a function", () => {
    expect(typeof Module.StatusBadge).toBe("function");
  });

  it("exports CaseSection as a function", () => {
    expect(typeof Module.CaseSection).toBe("function");
  });
});
