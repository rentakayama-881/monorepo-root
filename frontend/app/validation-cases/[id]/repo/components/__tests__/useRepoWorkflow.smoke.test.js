import * as Module from "../useRepoWorkflow";

describe("useRepoWorkflow smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useRepoWorkflow export", () => {
    expect(typeof Module.useRepoWorkflow).toBe("function");
  });
});
