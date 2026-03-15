import * as Module from "../useWorkspaceFiles";

describe("useWorkspaceFiles smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useWorkspaceFiles export", () => {
    expect(typeof Module.useWorkspaceFiles).toBe("function");
  });
});
