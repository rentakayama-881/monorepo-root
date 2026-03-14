import {
  requireValidTokenOrThrow,
  readJsonSafe,
  createApiErrorFromData,
  throwApiError,
} from "../authRequest";

jest.mock("../tokenRefresh", () => ({
  getValidToken: jest.fn(),
}));

const { getValidToken } = require("../tokenRefresh");

describe("authRequest.js", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("requireValidTokenOrThrow", () => {
    it("should return token when valid", async () => {
      getValidToken.mockResolvedValue("valid-token");
      const token = await requireValidTokenOrThrow();
      expect(token).toBe("valid-token");
    });

    it("should throw with status 401 when no token", async () => {
      getValidToken.mockResolvedValue(null);
      await expect(requireValidTokenOrThrow()).rejects.toMatchObject({
        message: expect.stringContaining("session has expired"),
        status: 401,
        code: "session_expired",
      });
    });

    it("should use custom message when provided", async () => {
      getValidToken.mockResolvedValue(null);
      await expect(requireValidTokenOrThrow("Custom msg")).rejects.toMatchObject({
        message: "Custom msg",
      });
    });
  });

  describe("readJsonSafe", () => {
    it("should parse JSON response successfully", async () => {
      const response = { json: () => Promise.resolve({ key: "value" }) };
      const result = await readJsonSafe(response);
      expect(result).toEqual({ key: "value" });
    });

    it("should return null when JSON parsing fails", async () => {
      const response = { json: () => Promise.reject(new Error("bad json")) };
      const result = await readJsonSafe(response);
      expect(result).toBeNull();
    });
  });

  describe("createApiErrorFromData", () => {
    it("should create error from data.message", () => {
      const err = createApiErrorFromData({ message: "Not found" }, "fallback");
      expect(err.message).toBe("Not found");
    });

    it("should create error from data.error string", () => {
      const err = createApiErrorFromData({ error: "Server error" }, "fallback");
      expect(err.message).toBe("Server error");
    });

    it("should use fallback when no message in data", () => {
      const err = createApiErrorFromData({}, "fallback msg");
      expect(err.message).toBe("fallback msg");
    });

    it("should use fallback when data is null", () => {
      const err = createApiErrorFromData(null, "fallback");
      expect(err.message).toBe("fallback");
    });

    it("should attach code and details", () => {
      const err = createApiErrorFromData({ message: "err", code: "E001", details: "info" }, "fb");
      expect(err.code).toBe("E001");
      expect(err.details).toBe("info");
    });
  });

  describe("throwApiError", () => {
    it("should throw error with message from response body", async () => {
      const response = { json: () => Promise.resolve({ message: "Bad request" }) };
      await expect(throwApiError(response, "fallback")).rejects.toThrow("Bad request");
    });

    it("should use fallback when response body has no message", async () => {
      const response = { json: () => Promise.resolve({}) };
      await expect(throwApiError(response, "fallback msg")).rejects.toThrow("fallback msg");
    });
  });
});
