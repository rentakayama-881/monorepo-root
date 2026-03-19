import { DATE_FORMATS, STORAGE_KEYS, LOCKED_CATEGORIES } from "../constants";

describe("constants.js", () => {
  describe("DATE_FORMATS", () => {
    it("should expose display and short presets", () => {
      expect(DATE_FORMATS.DISPLAY).toEqual({
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      expect(DATE_FORMATS.SHORT).toEqual({
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    });

    it("should include time variants with hour and minute", () => {
      expect(DATE_FORMATS.DISPLAY_WITH_TIME).toMatchObject({
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(DATE_FORMATS.SHORT_WITH_TIME).toMatchObject({
        hour: "2-digit",
        minute: "2-digit",
      });
    });
  });

  describe("STORAGE_KEYS", () => {
    it("should keep stable theme and recent search keys", () => {
      expect(STORAGE_KEYS.THEME).toBe("theme");
      expect(STORAGE_KEYS.RECENT_SEARCHES).toBe("recentSearches");
    });
  });

  describe("LOCKED_CATEGORIES", () => {
    it("should remain a stable array of intake-disabled slugs", () => {
      expect(LOCKED_CATEGORIES).toEqual(["kolaborator-phd", "drama-korea"]);
    });
  });
});
