import { maskEmail } from "../email";

describe("email.js", () => {
  describe("maskEmail", () => {
    it("should mask email with long local part", () => {
      expect(maskEmail("john@example.com")).toBe("john***@example.com");
    });

    it("should mask email with short local part (<=3 chars)", () => {
      expect(maskEmail("a@test.com")).toBe("a***@test.com");
      expect(maskEmail("abc@test.com")).toBe("a***@test.com");
    });

    it("should mask 4-char local part", () => {
      expect(maskEmail("abcd@test.com")).toBe("abcd***@test.com");
    });

    it("should return empty string for null", () => {
      expect(maskEmail(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(maskEmail(undefined)).toBe("");
    });

    it("should return empty string for empty string", () => {
      expect(maskEmail("")).toBe("");
    });

    it("should return input as-is when no @ symbol", () => {
      expect(maskEmail("noemail")).toBe("noemail");
    });

    it("should return empty string for non-string input", () => {
      expect(maskEmail(123)).toBe("");
    });
  });
});
