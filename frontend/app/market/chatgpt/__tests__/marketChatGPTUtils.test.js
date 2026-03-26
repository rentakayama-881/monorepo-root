import {
  JAKARTA_TIMEZONE,
  getCheckoutConfirmSeconds,
  formatUnixDateTime,
  formatUnixDate,
  boolText,
  toDisplayAccount,
  parseApiResponseSafe,
  toCheckoutFeedback,
} from "../marketChatGPTUtils";

describe("marketChatGPTUtils", () => {
  describe("JAKARTA_TIMEZONE", () => {
    it("is Asia/Jakarta", () => {
      expect(JAKARTA_TIMEZONE).toBe("Asia/Jakarta");
    });
  });

  describe("getCheckoutConfirmSeconds", () => {
    it("returns 60 by default when env not set", () => {
      const original = process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS;
      delete process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS;
      expect(getCheckoutConfirmSeconds()).toBe(60);
      process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS = original;
    });

    it("returns configured value when valid", () => {
      const original = process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS;
      process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS = "30";
      expect(getCheckoutConfirmSeconds()).toBe(30);
      process.env.NEXT_PUBLIC_MARKET_BUY_CONFIRM_SECONDS = original;
    });
  });

  describe("formatUnixDateTime", () => {
    it("returns dash for zero/null", () => {
      expect(formatUnixDateTime(0)).toBe("-");
      expect(formatUnixDateTime(null)).toBe("-");
      expect(formatUnixDateTime(undefined)).toBe("-");
    });

    it("formats valid unix timestamp", () => {
      // 2024-01-15 12:00:00 UTC = 1705320000
      const result = formatUnixDateTime(1705320000);
      expect(result).toContain("WIB");
      expect(typeof result).toBe("string");
    });
  });

  describe("formatUnixDate", () => {
    it("returns empty for zero/null", () => {
      expect(formatUnixDate(0)).toBe("");
      expect(formatUnixDate(null)).toBe("");
    });

    it("formats valid unix timestamp", () => {
      const result = formatUnixDate(1705320000);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("boolText", () => {
    it("returns Ya for truthy values", () => {
      expect(boolText(true)).toBe("Ya");
      expect(boolText(1)).toBe("Ya");
      expect(boolText("1")).toBe("Ya");
      expect(boolText("true")).toBe("Ya");
    });

    it("returns Tidak for falsy values", () => {
      expect(boolText(false)).toBe("Tidak");
      expect(boolText(0)).toBe("Tidak");
      expect(boolText("0")).toBe("Tidak");
      expect(boolText("false")).toBe("Tidak");
    });

    it("returns empty for undefined/null", () => {
      expect(boolText(undefined)).toBe("");
      expect(boolText(null)).toBe("");
    });
  });

  describe("toDisplayAccount", () => {
    it("normalizes a full account item", () => {
      const item = {
        chatgpt_item_id: "abc123",
        title: "Pro Account",
        price_idr: 250000,
        chatgpt_subscription: "Plus",
        chatgpt_country: "US",
        seller: { username: "seller1" },
        canBuyItem: true,
        published_date: 1705320000,
      };
      const result = toDisplayAccount(item, 0);

      expect(result.id).toBe("abc123");
      expect(result.title).toBe("Pro Account");
      expect(result.priceIDR).toBe(250000);
      expect(result.seller).toBe("seller1");
      expect(result.canBuy).toBe(true);
      expect(result.subscription).toBe("Plus");
    });

    it("uses fallback title when all have Cyrillic", () => {
      const item = {
        title: "Аккаунт",
        chatgpt_subscription: "Team",
      };
      const result = toDisplayAccount(item, 2);
      expect(result.title).toBe("Team Account");
    });

    it("marks canBuy false for fallback IDs", () => {
      const result = toDisplayAccount({}, 5);
      expect(result.id).toBe("row-5");
      expect(result.canBuy).toBe(false);
      expect(result.idValid).toBe(false);
    });

    it("formats IDR price correctly", () => {
      const result = toDisplayAccount({ price_idr: 100000 }, 0);
      expect(result.displayPriceIDR).toContain("100");
    });
  });

  describe("parseApiResponseSafe", () => {
    it("parses JSON response", async () => {
      const res = {
        headers: { get: () => "application/json" },
        json: jest.fn().mockResolvedValue({ data: "ok" }),
      };
      const result = await parseApiResponseSafe(res);
      expect(result).toEqual({ data: "ok" });
    });

    it("returns text as error for non-JSON response", async () => {
      const res = {
        status: 500,
        headers: { get: () => "text/plain" },
        text: jest.fn().mockResolvedValue("Internal Server Error"),
      };
      const result = await parseApiResponseSafe(res);
      expect(result.error).toBe("Internal Server Error");
    });
  });

  describe("toCheckoutFeedback", () => {
    it("normalizes timeout errors", () => {
      const result = toCheckoutFeedback("request timed out");
      expect(result.message).toContain("batas waktu");
      expect(result.variant).toBe("error");
    });

    it("normalizes insufficient balance errors", () => {
      const result = toCheckoutFeedback("Saldo kamu tidak mencukupi");
      expect(result.message).toContain("Saldo wallet");
      expect(result.variant).toBe("error");
    });

    it("marks unavailable items as warning", () => {
      const result = toCheckoutFeedback("Akun sudah terjual");
      expect(result.variant).toBe("warning");
    });

    it("returns generic error for unknown messages", () => {
      const result = toCheckoutFeedback("xyz random");
      expect(result.message).toContain("belum dapat diproses");
      expect(result.variant).toBe("error");
    });
  });
});
