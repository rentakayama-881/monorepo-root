import { formatDate, getPhaseInfo, getResolutionLabel } from "../utils";

describe("wallet dispute utils re-exports", () => {
  it("formatDate is a function", () => {
    expect(typeof formatDate).toBe("function");
  });

  it("getPhaseInfo returns object with title", () => {
    const info = getPhaseInfo("negotiation");
    expect(info).toHaveProperty("title");
  });

  it("getResolutionLabel returns string", () => {
    const label = getResolutionLabel("refund_full");
    expect(typeof label).toBe("string");
  });
});
