import { getErrorMessage } from "../errorMessage";

describe("errorMessage.js", () => {
  describe("getErrorMessage", () => {
    it("should return fallback for null", () => {
      expect(getErrorMessage(null)).toBe("An error occurred. Please try again.");
    });

    it("should return fallback for undefined", () => {
      expect(getErrorMessage(undefined)).toBe("An error occurred. Please try again.");
    });

    it("should return string error as-is", () => {
      expect(getErrorMessage("Something broke")).toBe("Something broke");
    });

    it("should return error.message when present", () => {
      expect(getErrorMessage(new Error("Test error"))).toBe("Test error");
    });

    it("should extract data.error.message", () => {
      const err = { data: { error: { message: "nested error" } } };
      expect(getErrorMessage(err)).toBe("nested error");
    });

    it("should extract data.message", () => {
      const err = { data: { message: "data msg" } };
      expect(getErrorMessage(err)).toBe("data msg");
    });

    it("should extract data.error string", () => {
      const err = { data: { error: "string error" } };
      expect(getErrorMessage(err)).toBe("string error");
    });

    it("should return error.code when no message available", () => {
      const err = { code: "ERR_NETWORK" };
      expect(getErrorMessage(err)).toBe("ERR_NETWORK");
    });

    it("should use custom fallback", () => {
      expect(getErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
    });

    it("should stringify object error when no known keys", () => {
      const err = { foo: "bar" };
      const result = getErrorMessage(err);
      expect(result).toContain("foo");
    });

    it('should ignore "[object Object]" message', () => {
      const err = { message: "[object Object]", code: "ERR001" };
      expect(getErrorMessage(err)).toBe("ERR001");
    });
  });
});
