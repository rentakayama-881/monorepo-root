import {
  API_ENDPOINTS,
  STATUS_STYLES,
  STATUS_LABELS,
  VALIDATION,
  QUICK_AMOUNTS,
  BANKS,
  PAGINATION,
  STORAGE_KEYS,
  LOCKED_CATEGORIES,
} from "../constants";

describe("constants.js", () => {
  describe("API_ENDPOINTS", () => {
    it("should have auth endpoints", () => {
      expect(API_ENDPOINTS.AUTH.LOGIN).toBe("/api/auth/login");
      expect(API_ENDPOINTS.AUTH.REGISTER).toBe("/api/auth/register");
      expect(API_ENDPOINTS.AUTH.ME).toBe("/api/user/me");
    });

    it("should have wallet endpoints", () => {
      expect(API_ENDPOINTS.WALLET.BALANCE).toBe("/api/wallet/balance");
    });

    it("should have dynamic transfer endpoints", () => {
      expect(API_ENDPOINTS.TRANSFERS.ACCEPT("123")).toBe("/api/transfers/123/accept");
      expect(API_ENDPOINTS.TRANSFERS.DISPUTE("456")).toBe("/api/transfers/456/dispute");
    });

    it("should have dynamic dispute endpoints", () => {
      expect(API_ENDPOINTS.DISPUTES.DETAIL("abc")).toBe("/api/disputes/abc");
      expect(API_ENDPOINTS.DISPUTES.MESSAGE("abc")).toBe("/api/disputes/abc/message");
    });

    it("should have dynamic validation case endpoint", () => {
      expect(API_ENDPOINTS.VALIDATION_CASES.DETAIL("vc1")).toBe("/api/validation-cases/vc1");
    });
  });

  describe("STATUS_STYLES", () => {
    it("should have transfer styles", () => {
      expect(STATUS_STYLES.transfer.held).toBeDefined();
      expect(STATUS_STYLES.transfer.released).toBeDefined();
    });

    it("should have dispute styles", () => {
      expect(STATUS_STYLES.dispute.negotiation).toBeDefined();
    });
  });

  describe("STATUS_LABELS", () => {
    it("should have transfer labels", () => {
      expect(STATUS_LABELS.transfer.held).toBe("Held");
      expect(STATUS_LABELS.transfer.released).toBe("Released");
    });

    it("should have dispute labels", () => {
      expect(STATUS_LABELS.dispute.open).toBe("Active");
    });
  });

  describe("VALIDATION", () => {
    it("should have username constraints", () => {
      expect(VALIDATION.USERNAME.MIN_LENGTH).toBe(7);
      expect(VALIDATION.USERNAME.MAX_LENGTH).toBe(30);
      expect(VALIDATION.USERNAME.PATTERN).toBeInstanceOf(RegExp);
    });

    it("should have transfer amount constraints", () => {
      expect(VALIDATION.TRANSFER.MIN_AMOUNT).toBe(10000);
      expect(VALIDATION.TRANSFER.MAX_AMOUNT).toBe(100000000);
    });

    it("should have PIN length", () => {
      expect(VALIDATION.PIN.LENGTH).toBe(6);
    });
  });

  describe("QUICK_AMOUNTS", () => {
    it("should have deposit amounts as sorted numbers", () => {
      expect(QUICK_AMOUNTS.deposit.length).toBeGreaterThan(0);
      expect(QUICK_AMOUNTS.deposit).toEqual(expect.arrayContaining([50000, 100000]));
    });

    it("should have withdraw amounts", () => {
      expect(QUICK_AMOUNTS.withdraw.length).toBeGreaterThan(0);
    });
  });

  describe("BANKS", () => {
    it("should have bank entries with code and name", () => {
      expect(BANKS.length).toBeGreaterThan(0);
      expect(BANKS[0]).toHaveProperty("code");
      expect(BANKS[0]).toHaveProperty("name");
    });

    it("should include BCA", () => {
      expect(BANKS.find((b) => b.code === "bca")).toBeDefined();
    });
  });

  describe("PAGINATION", () => {
    it("should have default page size", () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(20);
    });
  });

  describe("STORAGE_KEYS", () => {
    it("should have token key", () => {
      expect(STORAGE_KEYS.TOKEN).toBe("token");
    });

    it("should have theme key", () => {
      expect(STORAGE_KEYS.THEME).toBe("theme");
    });
  });

  describe("LOCKED_CATEGORIES", () => {
    it("should be an array", () => {
      expect(Array.isArray(LOCKED_CATEGORIES)).toBe(true);
    });
  });
});
