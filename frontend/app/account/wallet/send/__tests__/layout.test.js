import Layout, { metadata } from "../layout";

describe("wallet/send layout", () => {
  it("exports metadata with Indonesian title", () => {
    expect(metadata.title).toBe("Kirim Dana");
    expect(metadata.robots.index).toBe(false);
  });

  it("renders children", () => {
    const result = Layout({ children: "test" });
    expect(result).toBe("test");
  });
});
