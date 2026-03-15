import * as Module from "../useSendTransfer";

describe("useSendTransfer smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has default export", () => {
    expect(typeof Module.default).toBe("function");
  });

  it("has formatCurrency export", () => {
    expect(typeof Module.formatCurrency).toBe("function");
  });
});
