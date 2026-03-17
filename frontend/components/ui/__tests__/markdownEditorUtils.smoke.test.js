import * as Module from "../markdownEditorUtils";

describe("markdownEditorUtils smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has ToolbarBtn export", () => {
    expect(typeof Module.ToolbarBtn).toBe("function");
  });

  it("has Sep export", () => {
    expect(typeof Module.Sep).toBe("function");
  });

  it("has I export", () => {
    expect(Module.I).toBeDefined();
  });

  it("has MarkdownEditorPreview export", () => {
    expect(typeof Module.MarkdownEditorPreview).toBe("function");
  });
});
