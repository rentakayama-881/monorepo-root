import * as Module from "../accountUtils";

describe("accountUtils smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has normalizeAccountPayload export", () => {
    expect(typeof Module.normalizeAccountPayload).toBe("function");
  });

  it("has normalizeTelegramAuth export", () => {
    expect(typeof Module.normalizeTelegramAuth).toBe("function");
  });

  it("has generateIdempotencyKey export", () => {
    expect(typeof Module.generateIdempotencyKey).toBe("function");
  });
});
