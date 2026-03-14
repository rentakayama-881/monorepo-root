import { swrConfig, authFetcher, publicFetcher, invalidateCache, invalidateUserData } from "../swr";

jest.mock("../api", () => ({
  getApiBase: () => "https://api.example.com",
}));

jest.mock("../auth", () => ({
  getToken: jest.fn(() => "test-token"),
  AUTH_CHANGED_EVENT: "auth-changed",
}));

jest.mock("../tokenRefresh", () => ({
  fetchWithAuth: jest.fn(),
}));

const { fetchWithAuth } = require("../tokenRefresh");

describe("swr.js", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("swrConfig", () => {
    it("should have revalidateOnFocus enabled", () => {
      expect(swrConfig.revalidateOnFocus).toBe(true);
    });

    it("should have revalidateOnReconnect enabled", () => {
      expect(swrConfig.revalidateOnReconnect).toBe(true);
    });

    it("should have errorRetryCount of 2", () => {
      expect(swrConfig.errorRetryCount).toBe(2);
    });

    it("should have dedupingInterval of 5000", () => {
      expect(swrConfig.dedupingInterval).toBe(5000);
    });

    it("should have keepPreviousData enabled", () => {
      expect(swrConfig.keepPreviousData).toBe(true);
    });

    describe("onErrorRetry", () => {
      it("should not retry on 404", () => {
        const revalidate = jest.fn();
        swrConfig.onErrorRetry({ status: 404 }, "key", {}, revalidate, { retryCount: 0 });
        expect(revalidate).not.toHaveBeenCalled();
      });

      it("should not retry on 401", () => {
        const revalidate = jest.fn();
        swrConfig.onErrorRetry({ status: 401 }, "key", {}, revalidate, { retryCount: 0 });
        expect(revalidate).not.toHaveBeenCalled();
      });

      it("should not retry on 403", () => {
        const revalidate = jest.fn();
        swrConfig.onErrorRetry({ status: 403 }, "key", {}, revalidate, { retryCount: 0 });
        expect(revalidate).not.toHaveBeenCalled();
      });

      it("should not retry on 400", () => {
        const revalidate = jest.fn();
        swrConfig.onErrorRetry({ status: 400 }, "key", {}, revalidate, { retryCount: 0 });
        expect(revalidate).not.toHaveBeenCalled();
      });

      it("should not retry when retryCount >= 2", () => {
        const revalidate = jest.fn();
        swrConfig.onErrorRetry({ status: 500 }, "key", {}, revalidate, { retryCount: 2 });
        expect(revalidate).not.toHaveBeenCalled();
      });
    });
  });

  describe("authFetcher", () => {
    it("should return JSON on successful auth request", async () => {
      fetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: "data" }),
      });

      const result = await authFetcher("https://api.example.com/me");
      expect(result).toEqual({ user: "data" });
    });

    it("should throw Unauthorized when fetchWithAuth returns null", async () => {
      fetchWithAuth.mockResolvedValue(null);
      await expect(authFetcher("url")).rejects.toThrow("Unauthorized");
    });

    it("should throw error with status on non-ok response", async () => {
      fetchWithAuth.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      });

      try {
        await authFetcher("url");
        expect(true).toBe(false); // should not reach
      } catch (err) {
        expect(err.message).toBe("Server error");
        expect(err.status).toBe(500);
      }
    });
  });

  describe("publicFetcher", () => {
    it("should return JSON on successful public request", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const result = await publicFetcher("https://api.example.com/public");
      expect(result).toEqual({ items: [] });
    });

    it("should throw error on non-ok response", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found" }),
      });

      try {
        await publicFetcher("url");
        expect(true).toBe(false);
      } catch (err) {
        expect(err.message).toBe("Not found");
        expect(err.status).toBe(404);
      }
    });

    it("should handle non-JSON error response", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("not json")),
      });

      try {
        await publicFetcher("url");
        expect(true).toBe(false);
      } catch (err) {
        expect(err.message).toContain("502");
        expect(err.status).toBe(502);
      }
    });
  });

  describe("invalidateCache", () => {
    it("should not throw for single key", () => {
      expect(() => invalidateCache("some-key")).not.toThrow();
    });

    it("should not throw for array of keys", () => {
      expect(() => invalidateCache(["key1", "key2"])).not.toThrow();
    });
  });

  describe("invalidateUserData", () => {
    it("should not throw", () => {
      expect(() => invalidateUserData()).not.toThrow();
    });
  });
});
