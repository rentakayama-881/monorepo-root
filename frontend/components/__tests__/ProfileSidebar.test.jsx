jest.mock("next/link", () => {
  return function MockLink({ children }) {
    return children;
  };
});

import * as Module from "../ProfileSidebar";

describe("ProfileSidebar smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export that is a function", () => {
    expect(typeof Module.default).toBe("function");
  });
});
