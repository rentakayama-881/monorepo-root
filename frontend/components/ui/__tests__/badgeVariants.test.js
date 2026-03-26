import {
  BadgeIcons,
  BadgePresets,
  sizeConfig,
  pickFirst,
  normalizeIconType,
  hexToRgba,
  getBadgeTone,
  getBadgeConfig,
} from "../badgeVariants";

describe("badgeVariants", () => {
  describe("BadgeIcons", () => {
    it("exports icon functions for known types", () => {
      const expectedKeys = [
        "verified",
        "admin",
        "moderator",
        "contributor",
        "premium",
        "checkmark",
        "trusted",
        "default",
      ];
      for (const key of expectedKeys) {
        expect(typeof BadgeIcons[key]).toBe("function");
      }
    });
  });

  describe("BadgePresets", () => {
    it("contains preset definitions with color, icon, label", () => {
      expect(BadgePresets.verified).toEqual({
        color: "#3b82f6",
        icon: "checkmark",
        label: "Verified",
      });
      expect(BadgePresets.admin).toHaveProperty("color");
      expect(BadgePresets.admin).toHaveProperty("icon");
      expect(BadgePresets.admin).toHaveProperty("label");
    });
  });

  describe("sizeConfig", () => {
    it("has xs, sm, md, lg sizes", () => {
      expect(Object.keys(sizeConfig)).toEqual(["xs", "sm", "md", "lg"]);
      for (const size of Object.values(sizeConfig)) {
        expect(size).toHaveProperty("icon");
        expect(size).toHaveProperty("text");
        expect(size).toHaveProperty("gap");
        expect(size).toHaveProperty("padding");
      }
    });
  });

  describe("pickFirst", () => {
    it("returns the first non-null, non-undefined, non-empty-string value", () => {
      expect(pickFirst(null, undefined, "", "hello", "world")).toBe("hello");
      expect(pickFirst("first")).toBe("first");
    });

    it("returns undefined when all values are empty", () => {
      expect(pickFirst(null, undefined, "", "  ")).toBeUndefined();
    });

    it("returns 0 as a valid value", () => {
      expect(pickFirst(null, 0, "fallback")).toBe(0);
    });
  });

  describe("normalizeIconType", () => {
    it("trims and lowercases string", () => {
      expect(normalizeIconType("  Admin ")).toBe("admin");
      expect(normalizeIconType("VERIFIED")).toBe("verified");
    });

    it("returns empty string for falsy input", () => {
      expect(normalizeIconType(null)).toBe("");
      expect(normalizeIconType(undefined)).toBe("");
    });
  });

  describe("hexToRgba", () => {
    it("converts 6-digit hex to rgba", () => {
      expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
      expect(hexToRgba("#3b82f6", 0.3)).toBe("rgba(59, 130, 246, 0.3)");
    });

    it("converts 3-digit hex to rgba", () => {
      expect(hexToRgba("#f00", 1)).toBe("rgba(255, 0, 0, 1)");
    });

    it("returns null for invalid hex", () => {
      expect(hexToRgba("not-a-hex", 0.5)).toBeNull();
      expect(hexToRgba("", 0.5)).toBeNull();
      expect(hexToRgba(null, 0.5)).toBeNull();
    });
  });

  describe("getBadgeTone", () => {
    it("returns tone with color, borderColor, backgroundColor", () => {
      const tone = getBadgeTone({ color: "#3b82f6" });
      expect(tone.color).toBe("#3b82f6");
      expect(tone.borderColor).toContain("rgba");
      expect(tone.backgroundColor).toContain("rgba");
    });

    it("uses default color when config.color is missing", () => {
      const tone = getBadgeTone({});
      expect(tone.color).toBe("#6366f1");
    });
  });

  describe("getBadgeConfig", () => {
    it("returns preset config when type matches a preset", () => {
      const config = getBadgeConfig(null, "verified");
      expect(config.color).toBe("#3b82f6");
      expect(config.icon).toBe("checkmark");
      expect(config.label).toBe("Verified");
      expect(config.iconUrl).toBeUndefined();
    });

    it("builds config from badge object when no type match", () => {
      const badge = {
        icon_type: "contributor",
        name: "My Badge",
        color: "#123456",
      };
      const config = getBadgeConfig(badge, null);
      expect(config.icon).toBe("contributor");
      expect(config.label).toBe("My Badge");
      expect(config.color).toBe("#123456");
    });

    it("returns default config when neither badge nor type provided", () => {
      const config = getBadgeConfig(null, null);
      expect(config).toEqual({
        color: "#6366f1",
        icon: "default",
        label: "Badge",
        iconUrl: undefined,
      });
    });
  });
});
