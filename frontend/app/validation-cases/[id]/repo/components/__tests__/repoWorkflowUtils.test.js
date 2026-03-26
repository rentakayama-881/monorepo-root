import {
  normalizeErr,
  parseFilenameFromContentDisposition,
  fallbackDownloadFileName,
  fileExtensionFromName,
  inferMimeTypeFromFilename,
  extractDocumentId,
  legacyWorkspacePath,
  extractRepoTree,
} from "../repoWorkflowUtils";

describe("repoWorkflowUtils", () => {
  describe("normalizeErr", () => {
    it("returns message from error object", () => {
      expect(normalizeErr({ message: "bad" })).toBe("bad");
    });

    it("uses fallback when no message", () => {
      expect(normalizeErr({}, "fallback msg")).toBe("fallback msg");
    });

    it("appends details when present", () => {
      expect(normalizeErr({ message: "err", details: "detail" })).toBe("err: detail");
    });
  });

  describe("parseFilenameFromContentDisposition", () => {
    it("parses UTF-8 filename", () => {
      expect(
        parseFilenameFromContentDisposition("attachment; filename*=UTF-8''test%20file.pdf")
      ).toBe("test file.pdf");
    });

    it("parses ASCII filename", () => {
      expect(parseFilenameFromContentDisposition('attachment; filename="report.pdf"')).toBe(
        "report.pdf"
      );
    });

    it("returns empty for null/empty", () => {
      expect(parseFilenameFromContentDisposition("")).toBe("");
      expect(parseFilenameFromContentDisposition(null)).toBe("");
    });
  });

  describe("fallbackDownloadFileName", () => {
    it("returns sanitized label if available", () => {
      expect(fallbackDownloadFileName({ label: "my file.pdf" })).toBe("my file.pdf");
    });

    it("falls back to document_id", () => {
      expect(fallbackDownloadFileName({ document_id: "abc-123" })).toBe("workspace-file-abc-123");
    });

    it("returns generic fallback", () => {
      expect(fallbackDownloadFileName({})).toBe("workspace-file");
    });
  });

  describe("fileExtensionFromName", () => {
    it("extracts extension", () => {
      expect(fileExtensionFromName("report.pdf")).toBe("pdf");
      expect(fileExtensionFromName("photo.JPG")).toBe("jpg");
    });

    it("returns empty for no extension", () => {
      expect(fileExtensionFromName("noext")).toBe("");
      expect(fileExtensionFromName("")).toBe("");
    });
  });

  describe("inferMimeTypeFromFilename", () => {
    it("infers common MIME types", () => {
      expect(inferMimeTypeFromFilename("file.pdf")).toBe("application/pdf");
      expect(inferMimeTypeFromFilename("image.png")).toBe("image/png");
      expect(inferMimeTypeFromFilename("data.json")).toBe("application/json");
    });

    it("returns empty for unknown extension", () => {
      expect(inferMimeTypeFromFilename("file.xyz")).toBe("");
    });
  });

  describe("extractDocumentId", () => {
    it("extracts from various key patterns", () => {
      expect(extractDocumentId({ document_id: "d1" })).toBe("d1");
      expect(extractDocumentId({ documentId: "d2" })).toBe("d2");
      expect(extractDocumentId({ data: { id: "d3" } })).toBe("d3");
    });

    it("returns empty for invalid input", () => {
      expect(extractDocumentId(null)).toBe("");
      expect(extractDocumentId({})).toBe("");
    });
  });

  describe("legacyWorkspacePath", () => {
    it("maps known legacy paths", () => {
      expect(legacyWorkspacePath("files")).toBe("repo/files");
      expect(legacyWorkspacePath("validators/assign")).toBe("validators/assign");
    });

    it("returns as-is for unknown paths", () => {
      expect(legacyWorkspacePath("custom/path")).toBe("custom/path");
    });
  });

  describe("extractRepoTree", () => {
    it("extracts repo_tree from payload", () => {
      const payload = { repo_tree: { case_id: "c1", files: [] } };
      expect(extractRepoTree(payload)).toEqual({ case_id: "c1", files: [] });
    });

    it("returns payload itself if it has case_id and files", () => {
      const payload = { case_id: "c1", files: [] };
      expect(extractRepoTree(payload)).toEqual(payload);
    });

    it("returns null for invalid payload", () => {
      expect(extractRepoTree(null)).toBeNull();
      expect(extractRepoTree("string")).toBeNull();
    });
  });
});
