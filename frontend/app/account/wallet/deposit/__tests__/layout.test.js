import Layout, { metadata } from "../layout";

describe("wallet/deposit layout", () => {
  it("exports metadata with Indonesian title", () => {
    expect(metadata.title).toBe("Deposit");
    expect(metadata.robots.index).toBe(false);
  });

  it("renders children", () => {
    const result = Layout({ children: "test" });
    expect(result).toBe("test");
  });
});
