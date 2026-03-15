jest.mock("@/components/ui/MarkdownPreview", () => {
  return function MockMarkdownPreview({ content }) {
    return content || null;
  };
});

import * as Module from "../ContentTable";

describe("ContentTable", () => {
  it("exports the module correctly", () => {
    expect(Module).toBeDefined();
  });

  it("has a default export", () => {
    expect(typeof Module.default).toBe("function");
  });

  it("exports extractCaseRecordText as a function", () => {
    expect(typeof Module.extractCaseRecordText).toBe("function");
  });

  it("exports hasOverviewContent as a function", () => {
    expect(typeof Module.hasOverviewContent).toBe("function");
  });
});
