import {
  normalizeOptions,
  groupOptions,
  filterOptions,
  getDisplayText,
  selectPropTypes,
} from "../selectUtils";

describe("selectUtils", () => {
  describe("normalizeOptions", () => {
    it("converts string options to { value, label } objects", () => {
      const result = normalizeOptions(["a", "b"]);
      expect(result).toEqual([
        { value: "a", label: "a" },
        { value: "b", label: "b" },
      ]);
    });

    it("passes through object options unchanged", () => {
      const opts = [{ value: "x", label: "X Label", group: "G1" }];
      expect(normalizeOptions(opts)).toEqual(opts);
    });

    it("handles mixed string and object options", () => {
      const opts = ["plain", { value: "obj", label: "Object" }];
      const result = normalizeOptions(opts);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ value: "plain", label: "plain" });
      expect(result[1]).toEqual({ value: "obj", label: "Object" });
    });
  });

  describe("groupOptions", () => {
    it("groups options by group property", () => {
      const opts = [
        { value: "a", label: "A", group: "Group1" },
        { value: "b", label: "B", group: "Group2" },
        { value: "c", label: "C", group: "Group1" },
      ];
      const grouped = groupOptions(opts);
      expect(grouped["Group1"]).toHaveLength(2);
      expect(grouped["Group2"]).toHaveLength(1);
    });

    it('uses "_default" for options without group', () => {
      const opts = [{ value: "a", label: "A" }];
      const grouped = groupOptions(opts);
      expect(grouped["_default"]).toHaveLength(1);
    });
  });

  describe("filterOptions", () => {
    const opts = [
      { value: "apple", label: "Apple" },
      { value: "banana", label: "Banana" },
      { value: "cherry", label: "Cherry" },
    ];

    it("returns all options when query is empty", () => {
      expect(filterOptions(opts, "")).toEqual(opts);
      expect(filterOptions(opts, null)).toEqual(opts);
    });

    it("filters by label case-insensitively", () => {
      const result = filterOptions(opts, "ban");
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe("banana");
    });

    it("returns empty array when nothing matches", () => {
      expect(filterOptions(opts, "zzz")).toHaveLength(0);
    });
  });

  describe("getDisplayText", () => {
    const opts = [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
    ];

    it("returns selected label for single-select", () => {
      expect(getDisplayText(opts, "a", false, "Pick one")).toBe("Alpha");
    });

    it("returns placeholder when no selection in single-select", () => {
      expect(getDisplayText(opts, "nonexistent", false, "Pick one")).toBe("Pick one");
    });

    it("returns count string for multi-select with selections", () => {
      expect(getDisplayText(opts, ["a", "b"], true, "Pick")).toBe("2 selected");
    });

    it("returns placeholder for multi-select with empty selection", () => {
      expect(getDisplayText(opts, [], true, "Pick many")).toBe("Pick many");
    });

    it("uses default placeholder when not provided", () => {
      expect(getDisplayText(opts, "nonexistent", false)).toBe("Select option...");
      expect(getDisplayText(opts, [], true)).toBe("Select options...");
    });
  });

  describe("selectPropTypes", () => {
    it("exports a propTypes definition object", () => {
      expect(selectPropTypes).toBeDefined();
      expect(selectPropTypes).toHaveProperty("label");
      expect(selectPropTypes).toHaveProperty("options");
      expect(selectPropTypes).toHaveProperty("value");
      expect(selectPropTypes).toHaveProperty("onChange");
    });
  });
});
