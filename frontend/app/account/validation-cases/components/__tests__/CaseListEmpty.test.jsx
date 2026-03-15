import * as Module from "../CaseListEmpty";

describe("CaseListEmpty", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(Module.default).toBeDefined();
    expect(typeof Module.default).toBe("function");
  });
});
