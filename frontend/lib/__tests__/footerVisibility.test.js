import { shouldHideFooter } from "../footerVisibility";

describe("footerVisibility.js", () => {
  describe("shouldHideFooter", () => {
    it("should return false for null", () => {
      expect(shouldHideFooter(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(shouldHideFooter(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(shouldHideFooter("")).toBe(false);
    });

    it("should hide footer on /login", () => {
      expect(shouldHideFooter("/login")).toBe(true);
    });

    it("should hide footer on /register", () => {
      expect(shouldHideFooter("/register")).toBe(true);
    });

    it("should hide footer on /forgot-password", () => {
      expect(shouldHideFooter("/forgot-password")).toBe(true);
    });

    it("should hide footer on /verify-email", () => {
      expect(shouldHideFooter("/verify-email")).toBe(true);
    });

    it("should hide footer on /admin", () => {
      expect(shouldHideFooter("/admin")).toBe(true);
    });

    it("should hide footer on /admin/dashboard", () => {
      expect(shouldHideFooter("/admin/dashboard")).toBe(true);
    });

    it("should hide footer on /account", () => {
      expect(shouldHideFooter("/account")).toBe(true);
    });

    it("should hide footer on /account/settings", () => {
      expect(shouldHideFooter("/account/settings")).toBe(true);
    });

    it("should show footer on /", () => {
      expect(shouldHideFooter("/")).toBe(false);
    });

    it("should show footer on /validation-cases", () => {
      expect(shouldHideFooter("/validation-cases")).toBe(false);
    });

    it("should normalize trailing slash", () => {
      expect(shouldHideFooter("/login/")).toBe(true);
    });
  });
});
