import {
  normalizeAccountPayload,
  normalizeTelegramAuth,
  generateIdempotencyKey,
} from "../accountUtils";

describe("accountUtils", () => {
  describe("normalizeAccountPayload", () => {
    it("returns default fields when called with no args", () => {
      const result = normalizeAccountPayload();
      expect(result).toEqual({
        full_name: "",
        bio: "",
        pronouns: "",
        company: "",
        social_accounts: [],
      });
    });

    it("normalizes form values to strings", () => {
      const result = normalizeAccountPayload(
        { full_name: "Alice", bio: "Hello", pronouns: "she/her", company: "Acme" },
        []
      );
      expect(result.full_name).toBe("Alice");
      expect(result.bio).toBe("Hello");
      expect(result.pronouns).toBe("she/her");
      expect(result.company).toBe("Acme");
    });

    it("trims and filters social accounts", () => {
      const socials = [
        { label: "GitHub", url: "https://github.com/a" },
        { label: "", url: "" },
        { label: "  Twitter  ", url: "  https://x.com  " },
      ];
      const result = normalizeAccountPayload({}, socials);
      expect(result.social_accounts).toHaveLength(2);
      expect(result.social_accounts[0]).toEqual({
        label: "GitHub",
        url: "https://github.com/a",
      });
      expect(result.social_accounts[1]).toEqual({
        label: "Twitter",
        url: "https://x.com",
      });
    });

    it("handles non-array socials gracefully", () => {
      const result = normalizeAccountPayload({}, null);
      expect(result.social_accounts).toEqual([]);
    });
  });

  describe("normalizeTelegramAuth", () => {
    it("returns default disconnected state when called with no args", () => {
      const result = normalizeTelegramAuth();
      expect(result.connected).toBe(false);
      expect(result.telegram_user_id).toBe("");
      expect(result.username).toBe("");
    });

    it("normalizes a connected telegram auth object", () => {
      const result = normalizeTelegramAuth({
        connected: true,
        telegram_user_id: "12345",
        username: "alice",
        deep_link: "https://t.me/bot?start=abc",
      });
      expect(result.connected).toBe(true);
      expect(result.telegram_user_id).toBe("12345");
      expect(result.username).toBe("alice");
      expect(result.deep_link).toBe("https://t.me/bot?start=abc");
    });

    it("handles null input", () => {
      const result = normalizeTelegramAuth(null);
      expect(result.connected).toBe(false);
    });
  });

  describe("generateIdempotencyKey", () => {
    it("returns a UUID string", () => {
      const key = generateIdempotencyKey();
      expect(typeof key).toBe("string");
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("generates unique keys on each call", () => {
      const a = generateIdempotencyKey();
      const b = generateIdempotencyKey();
      expect(a).not.toBe(b);
    });
  });
});
