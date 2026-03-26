import robots from "../robots";

describe("robots()", () => {
  it("returns a valid robots config object", () => {
    const result = robots();
    expect(result).toHaveProperty("rules");
    expect(result).toHaveProperty("sitemap");
    expect(Array.isArray(result.rules)).toBe(true);
    expect(result.rules[0].userAgent).toBe("*");
    expect(result.rules[0].allow).toBe("/");
  });

  it("disallows admin and account routes", () => {
    const result = robots();
    const disallowed = result.rules[0].disallow;
    expect(disallowed).toContain("/admin/");
    expect(disallowed).toContain("/account/");
  });
});
