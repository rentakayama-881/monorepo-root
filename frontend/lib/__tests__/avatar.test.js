import { resolveAvatarSrc, getInitials, getAvatarColor } from "../avatar";

jest.mock("../api", () => ({
  getApiBase: () => "https://api.example.com",
}));

describe("avatar.js", () => {
  describe("resolveAvatarSrc", () => {
    it("should return null for falsy input", () => {
      expect(resolveAvatarSrc(null)).toBeNull();
      expect(resolveAvatarSrc(undefined)).toBeNull();
      expect(resolveAvatarSrc("")).toBeNull();
    });

    it("should return http URL as-is", () => {
      expect(resolveAvatarSrc("http://example.com/avatar.png")).toBe(
        "http://example.com/avatar.png"
      );
    });

    it("should return https URL as-is", () => {
      expect(resolveAvatarSrc("https://cdn.example.com/img.jpg")).toBe(
        "https://cdn.example.com/img.jpg"
      );
    });

    it("should prefix absolute path with API base", () => {
      expect(resolveAvatarSrc("/static/avatars/123.png")).toBe(
        "https://api.example.com/static/avatars/123.png"
      );
    });

    it("should construct full URL for plain filename", () => {
      expect(resolveAvatarSrc("avatar123.png")).toBe(
        "https://api.example.com/static/avatars/avatar123.png"
      );
    });
  });

  describe("getInitials", () => {
    it("should return empty string for null", () => {
      expect(getInitials(null)).toBe("");
    });

    it("should return empty string for empty string", () => {
      expect(getInitials("")).toBe("");
    });

    it("should return first letters of two words", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("should return first 2 chars for single word", () => {
      expect(getInitials("john")).toBe("JO");
    });

    it("should handle single character", () => {
      expect(getInitials("j")).toBe("J");
    });
  });

  describe("getAvatarColor", () => {
    it("should return default color for falsy input", () => {
      expect(getAvatarColor(null)).toBe("hsl(220, 50%, 50%)");
      expect(getAvatarColor("")).toBe("hsl(220, 50%, 50%)");
    });

    it("should return a valid HSL color string", () => {
      const result = getAvatarColor("test-user");
      expect(result).toMatch(/^hsl\(\d+, 55%, 50%\)$/);
    });

    it("should return consistent color for same input", () => {
      expect(getAvatarColor("user1")).toBe(getAvatarColor("user1"));
    });

    it("should return different colors for different inputs", () => {
      expect(getAvatarColor("alice")).not.toBe(getAvatarColor("bob"));
    });
  });
});
