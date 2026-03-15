import * as Module from "../AuthPrimitives";

describe("AuthPrimitives smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has named exports", () => {
    const exportKeys = Object.keys(Module).filter((k) => k !== "__esModule");
    expect(exportKeys.length).toBeGreaterThan(0);
  });
});
