import { renderHook } from "@testing-library/react";
import { useValidationCaseWorkflow } from "../useValidationCaseWorkflow";

jest.mock("@/lib/api", () => ({
  fetchJson: jest.fn(),
  fetchJsonAuth: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(() => null),
}));
jest.mock("@/lib/validationCaseWorkflow", () => ({
  isWorkspaceValidationCase: jest.fn(() => false),
}));

describe("useValidationCaseWorkflow", () => {
  const defaultProps = {
    id: "case-1",
    initialCaseData: { id: "case-1", owner: { id: 1 }, status: "open" },
    router: { push: jest.fn(), back: jest.fn(), refresh: jest.fn() },
  };

  it("returns initial state with case data from initialCaseData", () => {
    const { result } = renderHook(() => useValidationCaseWorkflow(defaultProps));

    expect(result.current.vc).toEqual(defaultProps.initialCaseData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
    expect(result.current.isAuthed).toBe(false);
    expect(result.current.isOwner).toBe(false);
  });

  it("exposes all sub-hook properties", () => {
    const { result } = renderHook(() => useValidationCaseWorkflow(defaultProps));

    // Consultation
    expect(result.current.consultationRequests).toEqual([]);
    // Contact
    expect(result.current.contactTelegram).toBe("");
    // Escrow
    expect(result.current.finalOffers).toEqual([]);
    // Case log
    expect(result.current.caseLog).toEqual([]);
  });
});
