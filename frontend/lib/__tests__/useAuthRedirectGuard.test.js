import { render, waitFor } from "@testing-library/react";
import useAuthRedirectGuard from "../useAuthRedirectGuard";
import { AUTH_CHANGED_EVENT, getToken, TOKEN_KEY } from "@/lib/auth";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

jest.mock("@/lib/auth", () => ({
  getToken: jest.fn(),
  TOKEN_KEY: "token",
  AUTH_CHANGED_EVENT: "auth:changed",
}));

function HookHarness({ redirectTo = "/" }) {
  useAuthRedirectGuard({ redirectTo });
  return null;
}

describe("useAuthRedirectGuard", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    getToken.mockReset();
  });

  it("redirects immediately when token already exists", async () => {
    getToken.mockReturnValue("active-token");

    render(<HookHarness redirectTo="/account" />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/account");
    });
  });

  it("redirects on storage token updates from another tab", async () => {
    getToken.mockReturnValueOnce(null).mockReturnValueOnce("new-token");

    render(<HookHarness redirectTo="/" />);

    window.dispatchEvent(new StorageEvent("storage", { key: TOKEN_KEY, newValue: "new-token" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("redirects on auth changed event in same tab", async () => {
    getToken.mockReturnValueOnce(null).mockReturnValueOnce("same-tab-token");

    render(<HookHarness redirectTo="/" />);

    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });
});
