import * as Module from "../useMarketChatGPTListing";

describe("useMarketChatGPTListing smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has default export", () => {
    expect(typeof Module.default).toBe("function");
  });
});
