import { setTokens } from "@/lib/auth";
import { finalizeAuthSession, normalizeAuthResponse } from "../authResponse";

jest.mock("@/lib/auth", () => ({
  setTokens: jest.fn(),
}));

describe("authResponse", () => {
  beforeEach(() => {
    setTokens.mockReset();
  });

  it("normalizes mixed response key formats", () => {
    const normalized = normalizeAuthResponse({
      AccessToken: "access-A",
      RefreshToken: "refresh-A",
      ExpiresIn: 3600,
      Username: "alice",
    });

    expect(normalized).toEqual({
      accessToken: "access-A",
      refreshToken: "refresh-A",
      expiresIn: 3600,
      username: "alice",
    });
  });

  it("stores tokens and redirects to root when username is present", () => {
    const redirectPath = finalizeAuthSession({
      access_token: "access-B",
      refresh_token: "refresh-B",
      expires_in: 900,
      user: { username: "bob" },
    });

    expect(setTokens).toHaveBeenCalledWith("access-B", "refresh-B", 900);
    expect(redirectPath).toBe("/");
  });

  it("redirects to set-username when username is missing", () => {
    const redirectPath = finalizeAuthSession({
      access_token: "access-C",
      refresh_token: "refresh-C",
      expires_in: 1200,
    });

    expect(setTokens).toHaveBeenCalledWith("access-C", "refresh-C", 1200);
    expect(redirectPath).toBe("/set-username");
  });
});
