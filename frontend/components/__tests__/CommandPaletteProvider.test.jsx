jest.mock("next/dynamic", () => {
  return function mockDynamic() {
    return function MockDynamicComponent() {
      return null;
    };
  };
});

import * as Module from "../CommandPaletteProvider";

describe("CommandPaletteProvider smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has CommandPaletteProvider export", () => {
    expect(typeof Module.CommandPaletteProvider).toBe("function");
  });

  it("has useCommandPalette export", () => {
    expect(typeof Module.useCommandPalette).toBe("function");
  });
});
