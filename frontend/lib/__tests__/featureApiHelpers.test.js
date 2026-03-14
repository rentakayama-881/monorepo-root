import { unwrapFeatureData, extractFeatureItems, extractTotalCount } from "../featureApiHelpers";

describe("featureApiHelpers.js", () => {
  describe("unwrapFeatureData", () => {
    it("should return payload.data when present", () => {
      expect(unwrapFeatureData({ data: "value" })).toBe("value");
    });

    it("should return payload.Data when present", () => {
      expect(unwrapFeatureData({ Data: "value" })).toBe("value");
    });

    it("should return payload.result when present", () => {
      expect(unwrapFeatureData({ result: "value" })).toBe("value");
    });

    it("should return payload.Result when present", () => {
      expect(unwrapFeatureData({ Result: "value" })).toBe("value");
    });

    it("should return raw payload when no wrapper key", () => {
      const payload = { foo: "bar" };
      expect(unwrapFeatureData(payload)).toEqual(payload);
    });

    it("should return null for null", () => {
      expect(unwrapFeatureData(null)).toBeNull();
    });

    it("should return primitive as-is", () => {
      expect(unwrapFeatureData(42)).toBe(42);
    });
  });

  describe("extractFeatureItems", () => {
    it("should return array payload directly", () => {
      expect(extractFeatureItems([1, 2])).toEqual([1, 2]);
    });

    it("should extract items array", () => {
      expect(extractFeatureItems({ items: [1] })).toEqual([1]);
    });

    it("should extract Items array", () => {
      expect(extractFeatureItems({ Items: [1] })).toEqual([1]);
    });

    it("should extract bans array", () => {
      expect(extractFeatureItems({ bans: [{ id: 1 }] })).toEqual([{ id: 1 }]);
    });

    it("should extract transfers array", () => {
      expect(extractFeatureItems({ transfers: [{ id: "t1" }] })).toEqual([{ id: "t1" }]);
    });

    it("should extract disputes array", () => {
      expect(extractFeatureItems({ disputes: [{ id: "d1" }] })).toEqual([{ id: "d1" }]);
    });

    it("should extract messages array", () => {
      expect(extractFeatureItems({ messages: ["msg"] })).toEqual(["msg"]);
    });

    it("should extract evidence array", () => {
      expect(extractFeatureItems({ evidence: ["e1"] })).toEqual(["e1"]);
    });

    it("should return empty array for null", () => {
      expect(extractFeatureItems(null)).toEqual([]);
    });

    it("should return empty array for non-object", () => {
      expect(extractFeatureItems("string")).toEqual([]);
    });

    it("should return empty array for unknown shape", () => {
      expect(extractFeatureItems({ unknown: "value" })).toEqual([]);
    });
  });

  describe("extractTotalCount", () => {
    it("should return totalCount", () => {
      expect(extractTotalCount({ totalCount: 42 }, 0)).toBe(42);
    });

    it("should return TotalCount", () => {
      expect(extractTotalCount({ TotalCount: 10 }, 0)).toBe(10);
    });

    it("should return total", () => {
      expect(extractTotalCount({ total: 5 }, 0)).toBe(5);
    });

    it("should return Total", () => {
      expect(extractTotalCount({ Total: 7 }, 0)).toBe(7);
    });

    it("should return fallback when no count key present", () => {
      expect(extractTotalCount({ items: [] }, 99)).toBe(99);
    });

    it("should return fallback for null payload", () => {
      expect(extractTotalCount(null, 0)).toBe(0);
    });
  });
});
