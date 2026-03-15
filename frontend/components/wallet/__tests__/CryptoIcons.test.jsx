import * as Module from "../CryptoIcons";

describe("CryptoIcons smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has named exports", () => {
    const exportKeys = Object.keys(Module).filter((k) => k !== "__esModule");
    expect(exportKeys.length).toBeGreaterThan(0);
  });
});
