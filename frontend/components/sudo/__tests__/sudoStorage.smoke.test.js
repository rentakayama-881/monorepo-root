import * as Module from "../sudoStorage";

describe("sudoStorage smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has safeStorageGet export", () => {
    expect(typeof Module.safeStorageGet).toBe("function");
  });

  it("has safeStorageSet export", () => {
    expect(typeof Module.safeStorageSet).toBe("function");
  });

  it("has safeStorageRemove export", () => {
    expect(typeof Module.safeStorageRemove).toBe("function");
  });

  it("has loadStoredSudoState export", () => {
    expect(typeof Module.loadStoredSudoState).toBe("function");
  });

  it("has saveSudoToken export", () => {
    expect(typeof Module.saveSudoToken).toBe("function");
  });

  it("has clearSudoStorage export", () => {
    expect(typeof Module.clearSudoStorage).toBe("function");
  });
});
