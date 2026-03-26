import { renderHook } from "@testing-library/react";
import { useRepoWorkflow } from "../useRepoWorkflow";

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => null),
}));
jest.mock("@/lib/useDocuments", () => ({
  useUploadDocument: jest.fn(() => ({
    uploadDocument: jest.fn(),
    loading: false,
    progress: 0,
  })),
}));

describe("useRepoWorkflow", () => {
  const mockRouter = { push: jest.fn(), back: jest.fn(), refresh: jest.fn() };

  it("redirects to login when not authed", () => {
    renderHook(() => useRepoWorkflow({ id: "case-1", router: mockRouter }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining("/login?redirect="));
  });

  it("returns initial state shape", () => {
    const { result } = renderHook(() => useRepoWorkflow({ id: "case-1", router: mockRouter }));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe("");
    expect(result.current.repoTree).toBeNull();
    expect(result.current.files).toEqual([]);
    expect(typeof result.current.onAttachFile).toBe("function");
    expect(typeof result.current.onApply).toBe("function");
    expect(typeof result.current.onFinalize).toBe("function");
  });
});
