import { getFeatureApiBase, fetchFeature, fetchFeatureAuth } from "../featureApi";

jest.mock("../tokenRefresh", () => ({
  getValidToken: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

jest.mock("../auth", () => ({
  clearToken: jest.fn(),
}));

jest.mock("../featureEndpoints", () => ({
  FEATURE_ENDPOINTS: {},
}));

jest.mock("../featureApiHelpers", () => ({
  unwrapFeatureData: jest.fn((d) => d),
  extractFeatureItems: jest.fn(() => []),
  extractTotalCount: jest.fn(() => 0),
}));

const { getValidToken, refreshAccessToken } = require("../tokenRefresh");
const { clearToken } = require("../auth");

describe("featureApi.js", () => {
  const originalEnv = process.env;
  let originalFetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("getFeatureApiBase", () => {
    it("should return env variable when set", () => {
      process.env.NEXT_PUBLIC_FEATURE_API_URL = "https://custom.example.com";
      expect(getFeatureApiBase()).toBe("https://custom.example.com");
    });

    it("should return default when env not set", () => {
      delete process.env.NEXT_PUBLIC_FEATURE_API_URL;
      expect(getFeatureApiBase()).toBe("https://feature.aivalid.id");
    });
  });

  describe("fetchFeature", () => {
    it("should make request to feature service", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        clone: () => ({
          json: () => Promise.resolve({ data: "test" }),
        }),
      });

      const result = await fetchFeature("/api/v1/health");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/health"),
        expect.objectContaining({
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        })
      );
      expect(result).toEqual({ data: "test" });
    });

    it("should throw on non-ok response", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        clone: () => ({
          json: () => Promise.resolve({ error: { message: "Server error" } }),
        }),
      });

      await expect(fetchFeature("/api/v1/health")).rejects.toThrow("Server error");
    });

    it("should throw timeout error when request times out", async () => {
      global.fetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            const err = new Error("aborted");
            err.name = "AbortError";
            setTimeout(() => reject(err), 50);
          })
      );

      await expect(fetchFeature("/api/v1/health", { timeout: 10 })).rejects.toThrow();
    });

    it("should throw connection error on TypeError", async () => {
      global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(fetchFeature("/api/v1/health")).rejects.toThrow("Unable to connect");
    });
  });

  describe("fetchFeatureAuth", () => {
    it("should throw session expired when no token", async () => {
      getValidToken.mockResolvedValue(null);

      await expect(fetchFeatureAuth("/api/v1/wallets/me")).rejects.toMatchObject({
        status: 401,
        code: "session_expired",
      });
    });

    it("should make authenticated request with Bearer token", async () => {
      getValidToken.mockResolvedValue("test-token");
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        clone: () => ({
          json: () => Promise.resolve({ success: true }),
        }),
      });

      await fetchFeatureAuth("/api/v1/wallets/me");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should retry with refreshed token on 401", async () => {
      getValidToken.mockResolvedValue("old-token");
      refreshAccessToken.mockResolvedValue("new-token");

      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          clone: () => ({ json: () => Promise.resolve({}) }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          clone: () => ({ json: () => Promise.resolve({ data: "ok" }) }),
        });

      const result = await fetchFeatureAuth("/api/v1/wallets/me");
      expect(refreshAccessToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: "ok" });
    });

    it("should clear token and throw on persistent 401", async () => {
      getValidToken.mockResolvedValue("old-token");
      refreshAccessToken.mockResolvedValue(null);

      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        clone: () => ({ json: () => Promise.resolve({ error: { message: "Invalid" } }) }),
      });

      await expect(fetchFeatureAuth("/path")).rejects.toMatchObject({ status: 401 });
      expect(clearToken).toHaveBeenCalled();
    });

    it("should throw 403 error with forbidden code", async () => {
      getValidToken.mockResolvedValue("token");
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        clone: () => ({ json: () => Promise.resolve({}) }),
      });

      await expect(fetchFeatureAuth("/path")).rejects.toMatchObject({
        status: 403,
      });
    });
  });
});
