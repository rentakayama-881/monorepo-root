import * as Module from "../AuthPageLoading";

describe("AuthPageLoading smoke test", () => {
  it("module can be imported", () => {
    expect(Module).toBeDefined();
  });

  it("has expected exports", () => {
    const main = Module.default || Object.values(Module)[0];
    expect(main).toBeDefined();
  });
});
