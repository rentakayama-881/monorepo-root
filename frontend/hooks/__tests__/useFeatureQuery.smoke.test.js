import * as Module from "../useFeatureQuery";

describe("useFeatureQuery smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has useFeatureQuery export", () => {
    expect(typeof Module.useFeatureQuery).toBe("function");
  });
});
