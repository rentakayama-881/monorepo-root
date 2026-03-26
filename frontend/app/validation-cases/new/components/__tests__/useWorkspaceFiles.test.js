import { renderHook, act } from "@testing-library/react";
import { useWorkspaceFiles } from "../useWorkspaceFiles";

describe("useWorkspaceFiles", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useWorkspaceFiles());

    expect(result.current.workspaceUploadDraft).toEqual({
      file: null,
      kind: "task_input",
      label: "",
      visibility: "public",
    });
    expect(result.current.workspaceBootstrapFiles).toEqual([]);
    expect(result.current.workspaceFileInputKey).toBe(0);
  });

  it("onWorkspaceFilePicked sets file and label fallback", () => {
    const { result } = renderHook(() => useWorkspaceFiles());

    const mockFile = new File(["content"], "test-doc.pdf", { type: "application/pdf" });

    act(() => {
      result.current.onWorkspaceFilePicked(mockFile);
    });

    expect(result.current.workspaceUploadDraft.file).toBe(mockFile);
    expect(result.current.workspaceUploadDraft.label).toBe("test-doc");
  });

  it("addWorkspaceBootstrapFile returns error if no file selected", () => {
    const { result } = renderHook(() => useWorkspaceFiles());

    let err;
    act(() => {
      err = result.current.addWorkspaceBootstrapFile();
    });

    expect(err).toContain("Pilih file");
  });

  it("addWorkspaceBootstrapFile adds file and resets draft", () => {
    // Mock crypto.randomUUID via jest.spyOn
    const mockRandomUUID = jest.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid-123");

    const { result } = renderHook(() => useWorkspaceFiles());
    const mockFile = new File(["content"], "test.pdf");

    act(() => {
      result.current.onWorkspaceFilePicked(mockFile);
    });

    let err;
    act(() => {
      err = result.current.addWorkspaceBootstrapFile();
    });

    expect(err).toBeNull();
    expect(result.current.workspaceBootstrapFiles).toHaveLength(1);
    expect(result.current.workspaceBootstrapFiles[0].label).toBe("test");
    expect(result.current.workspaceUploadDraft.file).toBeNull();

    mockRandomUUID.mockRestore();
  });

  it("removeWorkspaceBootstrapFile removes by localId", () => {
    const mockRandomUUID = jest.spyOn(crypto, "randomUUID").mockReturnValue("uuid-remove-test");

    const { result } = renderHook(() => useWorkspaceFiles());
    const mockFile = new File(["content"], "file.pdf");

    act(() => {
      result.current.onWorkspaceFilePicked(mockFile);
    });
    act(() => {
      result.current.addWorkspaceBootstrapFile();
    });

    expect(result.current.workspaceBootstrapFiles).toHaveLength(1);

    act(() => {
      result.current.removeWorkspaceBootstrapFile("uuid-remove-test");
    });

    expect(result.current.workspaceBootstrapFiles).toHaveLength(0);

    mockRandomUUID.mockRestore();
  });
});
