import sitemap, { revalidate } from "../sitemap";

describe("sitemap()", () => {
  beforeEach(() => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ validation_cases: [] }),
    });
  });

  it("returns an array of sitemap entries", async () => {
    const result = await sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("url");
    expect(result[0]).toHaveProperty("lastModified");
  });

  it("exports revalidate as 3600", () => {
    expect(revalidate).toBe(3600);
  });
});
