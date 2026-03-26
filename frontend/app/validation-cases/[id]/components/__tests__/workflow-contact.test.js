import { renderHook, act } from "@testing-library/react";
import { useWorkflowContact } from "../workflow-contact";

jest.mock("@/lib/api", () => ({
  fetchJsonAuth: jest.fn(),
}));

describe("useWorkflowContact", () => {
  const defaultProps = {
    id: "case-1",
    isAuthed: true,
    router: { push: jest.fn() },
  };

  it("returns initial state with empty contact", () => {
    const { result } = renderHook(() => useWorkflowContact(defaultProps));

    expect(result.current.contactTelegram).toBe("");
    expect(result.current.contactMsg).toBe("");
    expect(result.current.contactLoading).toBe(false);
    expect(result.current.contactTelegramHref).toBe("");
    expect(result.current.contactTelegramLabel).toBe("");
    expect(typeof result.current.revealContact).toBe("function");
  });

  it("redirects to login if not authed on revealContact", async () => {
    const router = { push: jest.fn() };
    const { result } = renderHook(() =>
      useWorkflowContact({ ...defaultProps, isAuthed: false, router })
    );

    await act(async () => {
      await result.current.revealContact();
    });

    expect(router.push).toHaveBeenCalledWith("/login");
  });
});
