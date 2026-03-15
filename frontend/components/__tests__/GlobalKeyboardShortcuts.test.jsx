jest.mock("next/dynamic", () => {
  return function mockDynamic() {
    return function MockDynamicComponent() {
      return null;
    };
  };
});

import * as Module from "../GlobalKeyboardShortcuts";

describe("GlobalKeyboardShortcuts smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export that is a function", () => {
    expect(typeof Module.default).toBe("function");
  });
});
