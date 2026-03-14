import { KEYBOARD_SHORTCUTS, isMac } from "../useKeyboardShortcuts";

describe("useKeyboardShortcuts.js", () => {
  describe("KEYBOARD_SHORTCUTS", () => {
    it("should have general shortcuts", () => {
      expect(KEYBOARD_SHORTCUTS.general).toBeDefined();
      expect(Array.isArray(KEYBOARD_SHORTCUTS.general)).toBe(true);
      expect(KEYBOARD_SHORTCUTS.general.length).toBeGreaterThan(0);
    });

    it("should have navigation shortcuts", () => {
      expect(KEYBOARD_SHORTCUTS.navigation).toBeDefined();
      expect(Array.isArray(KEYBOARD_SHORTCUTS.navigation)).toBe(true);
    });

    it("should have action shortcuts", () => {
      expect(KEYBOARD_SHORTCUTS.actions).toBeDefined();
      expect(Array.isArray(KEYBOARD_SHORTCUTS.actions)).toBe(true);
    });

    it("each shortcut should have keys and description", () => {
      const allShortcuts = [
        ...KEYBOARD_SHORTCUTS.general,
        ...KEYBOARD_SHORTCUTS.navigation,
        ...KEYBOARD_SHORTCUTS.actions,
      ];
      allShortcuts.forEach((shortcut) => {
        expect(shortcut).toHaveProperty("keys");
        expect(shortcut).toHaveProperty("description");
        expect(Array.isArray(shortcut.keys)).toBe(true);
        expect(typeof shortcut.description).toBe("string");
      });
    });

    it("should have Go to Home shortcut", () => {
      const goHome = KEYBOARD_SHORTCUTS.navigation.find((s) => s.description.includes("Home"));
      expect(goHome).toBeDefined();
      expect(goHome.keys).toEqual(["G", "H"]);
    });
  });

  describe("isMac", () => {
    it("should return a boolean", () => {
      expect(typeof isMac()).toBe("boolean");
    });
  });
});
