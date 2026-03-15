import * as Module from "../useWithdraw";

describe("useWithdraw smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has default export", () => {
    expect(typeof Module.default).toBe("function");
  });

  it("has quickAmounts export", () => {
    expect(Module.quickAmounts).toBeDefined();
  });

  it("has minWithdraw export", () => {
    expect(Module.minWithdraw).toBeDefined();
  });

  it("has feePercent export", () => {
    expect(Module.feePercent).toBeDefined();
  });
});
