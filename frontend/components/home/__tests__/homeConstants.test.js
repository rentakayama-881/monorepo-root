import { STEPS } from "../homeConstants";

describe("homeConstants", () => {
  describe("STEPS", () => {
    it("exports an array with 3 steps", () => {
      expect(Array.isArray(STEPS)).toBe(true);
      expect(STEPS).toHaveLength(3);
    });

    it("each step has required properties: num, title, fullTitle, desc, description", () => {
      for (const step of STEPS) {
        expect(step).toHaveProperty("num");
        expect(step).toHaveProperty("title");
        expect(step).toHaveProperty("fullTitle");
        expect(step).toHaveProperty("desc");
        expect(step).toHaveProperty("description");
        expect(typeof step.num).toBe("string");
        expect(typeof step.title).toBe("string");
      }
    });

    it("steps are numbered sequentially from 01", () => {
      expect(STEPS[0].num).toBe("01");
      expect(STEPS[1].num).toBe("02");
      expect(STEPS[2].num).toBe("03");
    });
  });
});
