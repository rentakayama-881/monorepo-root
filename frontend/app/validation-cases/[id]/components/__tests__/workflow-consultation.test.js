import { renderHook, act } from "@testing-library/react";
import { useWorkflowConsultation } from "../workflow-consultation";

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));

describe("useWorkflowConsultation", () => {
  const defaultProps = {
    id: "case-1",
    isAuthed: true,
    isOwner: false,
    router: { push: jest.fn() },
    loadOwnerWorkflow: jest.fn(),
  };

  it("returns initial state", () => {
    const { result } = renderHook(() => useWorkflowConsultation(defaultProps));

    expect(result.current.consultationRequests).toEqual([]);
    expect(result.current.consultationLoading).toBe(false);
    expect(result.current.consultationMsg).toBe("");
    expect(result.current.myConsultationRequest).toBeNull();
    expect(typeof result.current.requestConsultation).toBe("function");
    expect(typeof result.current.approveConsultation).toBe("function");
  });

  it("redirects to login if not authed on requestConsultation", async () => {
    const router = { push: jest.fn() };
    const { result } = renderHook(() =>
      useWorkflowConsultation({ ...defaultProps, isAuthed: false, router })
    );

    await act(async () => {
      await result.current.requestConsultation();
    });

    expect(router.push).toHaveBeenCalledWith("/login");
  });
});
