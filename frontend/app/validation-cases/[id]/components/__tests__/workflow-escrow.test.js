import { renderHook, act } from "@testing-library/react";
import { useWorkflowEscrow } from "../workflow-escrow";

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));
jest.mock("@/lib/featureApi", () => ({
  fetchFeatureAuth: jest.fn(),
  FEATURE_ENDPOINTS: {
    TRANSFERS: { CREATE: "/transfers", RELEASE: (id) => `/transfers/${id}/release` },
    DISPUTES: { CREATE: "/disputes" },
  },
  unwrapFeatureData: jest.fn((d) => d),
}));

describe("useWorkflowEscrow", () => {
  const defaultProps = {
    id: "case-1",
    isAuthed: true,
    router: { push: jest.fn() },
    vc: { bounty_amount: 50000, status: "open" },
    reloadCase: jest.fn(),
    loadOwnerWorkflow: jest.fn(),
    loadNonOwnerWorkflow: jest.fn(),
  };

  it("returns initial state", () => {
    const { result } = renderHook(() => useWorkflowEscrow(defaultProps));

    expect(result.current.finalOffers).toEqual([]);
    expect(result.current.offersLoading).toBe(false);
    expect(result.current.escrowDraft).toBeNull();
    expect(result.current.lockFundsPin).toBe("");
    expect(typeof result.current.submitFinalOffer).toBe("function");
    expect(typeof result.current.lockFunds).toBe("function");
  });

  it("redirects to login if not authed on submitFinalOffer", async () => {
    const router = { push: jest.fn() };
    const { result } = renderHook(() =>
      useWorkflowEscrow({ ...defaultProps, isAuthed: false, router })
    );

    await act(async () => {
      await result.current.submitFinalOffer();
    });

    expect(router.push).toHaveBeenCalledWith("/login");
  });
});
