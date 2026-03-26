import {
  TELEGRAM_WIDGET_SRC,
  TELEGRAM_WIDGET_HANDLER,
  normalizeBotUsername,
  isTelegramWidgetIframe,
  iframeMatchesBot,
  cleanupTelegramWidgetArtifacts,
  formatVerifiedAt,
  normalizeTelegramAuth,
} from "../telegramAuthUtils";

describe("telegramAuthUtils", () => {
  describe("constants", () => {
    it("exports expected constant values", () => {
      expect(TELEGRAM_WIDGET_SRC).toBe("https://telegram.org/js/telegram-widget.js?22");
      expect(TELEGRAM_WIDGET_HANDLER).toBe("__aivalidTelegramLoginHandler");
    });
  });

  describe("normalizeBotUsername", () => {
    it("trims, lowercases, and strips leading @", () => {
      expect(normalizeBotUsername("@MyBot ")).toBe("mybot");
      expect(normalizeBotUsername("  SomeBot")).toBe("somebot");
    });

    it("returns empty string for falsy input", () => {
      expect(normalizeBotUsername(null)).toBe("");
      expect(normalizeBotUsername(undefined)).toBe("");
      expect(normalizeBotUsername("")).toBe("");
    });
  });

  describe("isTelegramWidgetIframe", () => {
    it("returns false for falsy input", () => {
      expect(isTelegramWidgetIframe(null)).toBe(false);
      expect(isTelegramWidgetIframe(undefined)).toBe(false);
    });

    it("detects iframe by src containing oauth.telegram.org/embed", () => {
      const iframe = {
        getAttribute: () => "https://oauth.telegram.org/embed/mybot",
        src: "",
        id: "",
        className: "",
      };
      expect(isTelegramWidgetIframe(iframe)).toBe(true);
    });

    it("detects iframe by id containing telegram-login", () => {
      const iframe = {
        getAttribute: () => "",
        src: "",
        id: "telegram-login-mybot",
        className: "",
      };
      expect(isTelegramWidgetIframe(iframe)).toBe(true);
    });

    it("returns false for unrelated iframe", () => {
      const iframe = {
        getAttribute: () => "https://example.com",
        src: "",
        id: "something-else",
        className: "regular",
      };
      expect(isTelegramWidgetIframe(iframe)).toBe(false);
    });
  });

  describe("iframeMatchesBot", () => {
    it("returns true if botUsername is empty (matches all)", () => {
      const iframe = { getAttribute: () => "", src: "", id: "", className: "" };
      expect(iframeMatchesBot(iframe, "")).toBe(true);
      expect(iframeMatchesBot(iframe, null)).toBe(true);
    });

    it("matches by src embed path", () => {
      const iframe = {
        getAttribute: () => "https://oauth.telegram.org/embed/testbot",
        src: "",
        id: "",
        className: "",
      };
      expect(iframeMatchesBot(iframe, "testbot")).toBe(true);
      expect(iframeMatchesBot(iframe, "otherbot")).toBe(false);
    });
  });

  describe("cleanupTelegramWidgetArtifacts", () => {
    it("clears container innerHTML", () => {
      const container = { innerHTML: "<div>stuff</div>" };
      cleanupTelegramWidgetArtifacts({ container, sectionRoot: null, botUsername: "" });
      expect(container.innerHTML).toBe("");
    });

    it("handles missing sectionRoot gracefully", () => {
      expect(() =>
        cleanupTelegramWidgetArtifacts({ container: null, sectionRoot: null, botUsername: "" })
      ).not.toThrow();
    });
  });

  describe("formatVerifiedAt", () => {
    it('returns "-" for empty/falsy input', () => {
      expect(formatVerifiedAt("")).toBe("-");
      expect(formatVerifiedAt(null)).toBe("-");
      expect(formatVerifiedAt(undefined)).toBe("-");
    });

    it("returns raw value for unparseable date", () => {
      expect(formatVerifiedAt("not-a-date")).toBe("not-a-date");
    });

    it("formats valid ISO date with id-ID locale", () => {
      const result = formatVerifiedAt("2024-01-15T10:30:00Z");
      expect(typeof result).toBe("string");
      expect(result).not.toBe("-");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("normalizeTelegramAuth", () => {
    it("returns default structure for falsy input", () => {
      const result = normalizeTelegramAuth(null);
      expect(result).toEqual({
        connected: false,
        telegram_user_id: "",
        username: "",
        display_username: "",
        deep_link: "",
        verified_at: "",
        first_name: "",
        last_name: "",
        photo_url: "",
      });
    });

    it("normalizes a valid object", () => {
      const result = normalizeTelegramAuth({
        connected: true,
        telegram_user_id: "12345",
        username: "testuser",
        first_name: "Test",
      });
      expect(result.connected).toBe(true);
      expect(result.telegram_user_id).toBe("12345");
      expect(result.username).toBe("testuser");
      expect(result.first_name).toBe("Test");
      expect(result.last_name).toBe("");
    });
  });
});
