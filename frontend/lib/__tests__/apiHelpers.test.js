import { unwrapApiData, extractList } from "../apiHelpers";

describe("apiHelpers.js", () => {
  describe("unwrapApiData", () => {
    it("should return payload.data when present", () => {
      expect(unwrapApiData({ data: "value" })).toBe("value");
    });

    it("should return payload.Data when present", () => {
      expect(unwrapApiData({ Data: "value" })).toBe("value");
    });

    it("should return payload.result when present", () => {
      expect(unwrapApiData({ result: "value" })).toBe("value");
    });

    it("should return payload.Result when present", () => {
      expect(unwrapApiData({ Result: "value" })).toBe("value");
    });

    it("should return raw payload when no wrapper key exists", () => {
      const payload = { foo: "bar" };
      expect(unwrapApiData(payload)).toEqual(payload);
    });

    it("should return null for null input", () => {
      expect(unwrapApiData(null)).toBeNull();
    });

    it("should return undefined for undefined input", () => {
      expect(unwrapApiData(undefined)).toBeUndefined();
    });

    it("should return primitive values as-is", () => {
      expect(unwrapApiData("hello")).toBe("hello");
      expect(unwrapApiData(42)).toBe(42);
    });
  });

  describe("extractList", () => {
    it("should return the array directly if payload is an array", () => {
      const arr = [1, 2, 3];
      expect(extractList(arr)).toEqual(arr);
    });

    it("should extract items array", () => {
      expect(extractList({ items: [1, 2] })).toEqual([1, 2]);
    });

    it("should extract accounts array", () => {
      expect(extractList({ accounts: ["a"] })).toEqual(["a"]);
    });

    it("should extract data array", () => {
      expect(extractList({ data: [1] })).toEqual([1]);
    });

    it("should extract result array", () => {
      expect(extractList({ result: [1] })).toEqual([1]);
    });

    it("should return empty array for null", () => {
      expect(extractList(null)).toEqual([]);
    });

    it("should return empty array for undefined", () => {
      expect(extractList(undefined)).toEqual([]);
    });

    it("should return empty array when no known key has an array", () => {
      expect(extractList({ foo: "bar" })).toEqual([]);
    });

    it("should handle nested items inside a candidate", () => {
      expect(extractList({ data: { items: [1, 2] } })).toEqual([1, 2]);
    });
  });
});
