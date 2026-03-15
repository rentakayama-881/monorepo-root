import * as Module from "../repoWorkflowUtils";

describe("repoWorkflowUtils smoke", () => {
  it("exports the module", () => {
    expect(Module).toBeDefined();
  });

  it("has normalizeErr export", () => {
    expect(typeof Module.normalizeErr).toBe("function");
  });

  it("has parseFilenameFromContentDisposition export", () => {
    expect(typeof Module.parseFilenameFromContentDisposition).toBe("function");
  });

  it("has fallbackDownloadFileName export", () => {
    expect(typeof Module.fallbackDownloadFileName).toBe("function");
  });

  it("has fileExtensionFromName export", () => {
    expect(typeof Module.fileExtensionFromName).toBe("function");
  });

  it("has inferMimeTypeFromFilename export", () => {
    expect(typeof Module.inferMimeTypeFromFilename).toBe("function");
  });

  it("has extractDocumentId export", () => {
    expect(typeof Module.extractDocumentId).toBe("function");
  });

  it("has legacyWorkspacePath export", () => {
    expect(typeof Module.legacyWorkspacePath).toBe("function");
  });

  it("has extractRepoTree export", () => {
    expect(typeof Module.extractRepoTree).toBe("function");
  });
});
