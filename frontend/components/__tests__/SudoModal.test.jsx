import * as Module from "../SudoModal";

describe("SudoModal smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has expected exports", () => {
    const exportKeys = Object.keys(Module).filter((k) => k !== "__esModule");
    expect(exportKeys.length).toBeGreaterThan(0);
  });
});
