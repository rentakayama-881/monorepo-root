import * as Module from "../marketChatGPTUtils";

describe("marketChatGPTUtils smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has JAKARTA_TIMEZONE export", () => {
    expect(Module.JAKARTA_TIMEZONE).toBeDefined();
  });

  it("has getCheckoutConfirmSeconds export", () => {
    expect(typeof Module.getCheckoutConfirmSeconds).toBe("function");
  });

  it("has formatUnixDateTime export", () => {
    expect(typeof Module.formatUnixDateTime).toBe("function");
  });

  it("has formatUnixDate export", () => {
    expect(typeof Module.formatUnixDate).toBe("function");
  });

  it("has boolText export", () => {
    expect(typeof Module.boolText).toBe("function");
  });

  it("has toDisplayAccount export", () => {
    expect(typeof Module.toDisplayAccount).toBe("function");
  });

  it("has parseApiResponseSafe export", () => {
    expect(typeof Module.parseApiResponseSafe).toBe("function");
  });

  it("has toCheckoutFeedback export", () => {
    expect(typeof Module.toCheckoutFeedback).toBe("function");
  });
});
