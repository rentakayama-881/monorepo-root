import { fetchAdminApi, fetchAdminFeature, fetchAdminFeatureList } from "../adminApi";

jest.mock("@/lib/adminAuth", () => ({
  getAdminToken: jest.fn(() => "test-token"),
}));
jest.mock("@/lib/api", () => ({
  getApiBase: () => "http://localhost:8080",
}));
jest.mock("@/lib/featureApi", () => ({
  getFeatureApiBase: () => "http://localhost:5000",
  unwrapFeatureData: (d) => d?.data ?? d,
  extractFeatureItems: (d) => (Array.isArray(d) ? d : (d?.items ?? [])),
}));

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("fetchAdminApi", () => {
  it("sends auth header and returns JSON", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [] }),
    });
    const data = await fetchAdminApi("/admin/users");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/admin/users",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
    expect(data).toEqual({ users: [] });
  });

  it("throws on error response", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    });
    await expect(fetchAdminApi("/admin/users")).rejects.toThrow("Forbidden");
  });
});

describe("fetchAdminFeature", () => {
  it("uses feature base URL", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });
    await fetchAdminFeature("/api/v1/admin/moderation/dashboard");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/v1/admin/moderation/dashboard",
      expect.any(Object)
    );
  });
});

describe("fetchAdminFeatureList", () => {
  it("unwraps and normalizes items", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { items: [{ id: "1" }, { id: "2" }] } }),
    });
    const items = await fetchAdminFeatureList("/api/v1/test", (i) => ({ ...i, normalized: true }));
    expect(items).toEqual([
      { id: "1", normalized: true },
      { id: "2", normalized: true },
    ]);
  });
});
