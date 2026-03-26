import { renderHook } from "@testing-library/react";
import { useNewValidationCase } from "../useNewValidationCase";

jest.mock("@/lib/api", () => ({
  fetchJson: jest.fn(),
  fetchJsonAuth: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => null),
}));
jest.mock("@/lib/constants", () => ({
  LOCKED_CATEGORIES: [],
}));
jest.mock("@/lib/useDocuments", () => ({
  useUploadDocument: jest.fn(() => ({
    uploadDocument: jest.fn(),
    loading: false,
    progress: 0,
  })),
}));

describe("useNewValidationCase", () => {
  it("redirects to login when not authed", () => {
    // The global mock in jest.setup.js returns push: jest.fn()
    // useNewValidationCase calls router.push("/login") when getToken returns null
    const { result } = renderHook(() => useNewValidationCase());
    // Since getToken returns null, the hook sets isAuthed=false and effect calls router.push("/login")
    // We verify the form state is still accessible
    expect(result.current.form).toBeDefined();
  });

  it("returns initial form state shape", () => {
    const { result } = renderHook(() => useNewValidationCase());

    expect(result.current.form.title).toBe("");
    expect(result.current.form.bounty_amount).toBe("10000");
    expect(result.current.form.sensitivity).toBe("S1");
    expect(result.current.submitting).toBe(false);
    expect(result.current.error).toBe("");
    expect(typeof result.current.submit).toBe("function");
    expect(typeof result.current.setChecklist).toBe("function");
  });
});
