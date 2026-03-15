import * as Module from "../CaseMetadataSidebar";

describe("CaseMetadataSidebar", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(typeof Module.default).toBe("function");
  });
});
