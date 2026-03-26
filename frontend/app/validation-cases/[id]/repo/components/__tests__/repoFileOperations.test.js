import { performOpenWorkspaceFile } from "../repoFileOperations";

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => "test-token"),
}));
jest.mock("@/lib/featureApi", () => ({
  FEATURE_ENDPOINTS: {
    DOCUMENTS: {
      VIEW: (id) => `/documents/${id}/view`,
      DOWNLOAD: (id) => `/documents/${id}/download`,
    },
  },
  getFeatureApiBase: jest.fn(() => "https://feature.test"),
}));

describe("performOpenWorkspaceFile", () => {
  it("throws if document_id is empty", async () => {
    await expect(performOpenWorkspaceFile({})).rejects.toThrow("Document ID tidak ditemukan.");
  });

  it("returns redirectToLogin if no token", async () => {
    const { getToken } = require("@/lib/auth");
    getToken.mockReturnValueOnce(null);

    const result = await performOpenWorkspaceFile({ document_id: "doc-1" });
    expect(result).toEqual({ ok: false, redirectToLogin: true });
  });

  it("handles successful download", async () => {
    const mockBlob = new Blob(["content"], { type: "application/pdf" });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
      headers: new Headers({
        "content-disposition": 'attachment; filename="test.pdf"',
        "content-type": "application/pdf",
      }),
    });

    // Mock DOM APIs for download using a real anchor element
    window.URL.createObjectURL = jest.fn(() => "blob:test");
    window.URL.revokeObjectURL = jest.fn();
    const mockAnchor = document.createElement("a");
    mockAnchor.click = jest.fn();
    const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(mockAnchor);

    const result = await performOpenWorkspaceFile({ document_id: "doc-1" }, { download: true });
    expect(result.ok).toBe(true);
    expect(mockAnchor.click).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});
