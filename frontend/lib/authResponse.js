import { setTokens } from "@/lib/auth";

export function normalizeAuthResponse(data = {}) {
  return {
    accessToken: data.access_token || data.AccessToken || "",
    refreshToken: data.refresh_token || data.RefreshToken || "",
    expiresIn: data.expires_in || data.ExpiresIn || null,
    username: data?.user?.username || data.username || data.Username || "",
  };
}

export function finalizeAuthSession(data = {}) {
  const normalized = normalizeAuthResponse(data);
  setTokens(normalized.accessToken, normalized.refreshToken, normalized.expiresIn);
  return normalized.username ? "/" : "/set-username";
}
