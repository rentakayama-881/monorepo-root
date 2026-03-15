import * as Module from "../normalizers";

describe("normalizers smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has normalizeCurrentUser export", () => {
    expect(typeof Module.normalizeCurrentUser).toBe("function");
  });

  it("has normalizeDisputeMessage export", () => {
    expect(typeof Module.normalizeDisputeMessage).toBe("function");
  });

  it("has normalizeDisputeEvidence export", () => {
    expect(typeof Module.normalizeDisputeEvidence).toBe("function");
  });

  it("has normalizeDispute export", () => {
    expect(typeof Module.normalizeDispute).toBe("function");
  });
});
