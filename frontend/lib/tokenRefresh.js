import { getApiBase } from "./api";
import logger from "./logger";
import { getToken, getRefreshToken, isTokenExpired, setTokens, clearToken } from "./auth";

let refreshPromise = null;

function shouldSkipNavigationRedirect() {
  if (typeof navigator === "undefined") return false;
  return /jsdom/i.test(String(navigator.userAgent || ""));
}

function redirectToAccountLockedLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.includes("/login")) return;
  if (shouldSkipNavigationRedirect()) return;

  try {
    if (typeof window.location.assign === "function") {
      window.location.assign("/login?error=account_locked");
      return;
    }
    window.location.href = "/login?error=account_locked";
  } catch {
    // Ignore redirect failures in restricted environments.
  }
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const payload = refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : null;
      const res = await fetch(`${getApiBase()}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: payload
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
        body: payload ?? undefined,
      });

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          // Ignore JSON parse errors
        }

        // Check if account is locked (403 with specific message)
        if (
          res.status === 403 &&
          (data?.code === "AUTH009" ||
            data?.code === "AUTH012" ||
            data?.message?.includes("terkunci") ||
            data?.error?.includes("terkunci"))
        ) {
          // Account locked - redirect silently
          clearToken();
          redirectToAccountLockedLogin();
          return null;
        }

        // IMPORTANT:
        // Do not clear user session immediately when refresh token fails.
        // We still may have a usable access token in storage (clock skew / stale refresh token),
        // and the caller can try the protected endpoint once before deciding session is expired.
        // Session cleanup should happen only when the protected API itself returns 401.
        return null;
      }

      const data = await res.json();
      setTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } catch (error) {
      // Network error - don't clear tokens, just return null
      // User can retry when connection is restored
      logger.warn("Token refresh failed (network):", error.message);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getValidToken() {
  const token = getToken();

  if (!token) {
    return null;
  }

  if (isTokenExpired()) {
    // Retry refresh with exponential backoff: 2s, 4s, 8s
    // Grace period ~14s before giving up — handles transient network issues
    for (let attempt = 0; attempt < 3; attempt++) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return refreshed;

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }

    // All retries exhausted — session is truly expired
    clearToken();
    return null;
  }

  return token;
}

export async function fetchWithAuth(url, options = {}) {
  let token = await getValidToken();

  if (!token) {
    const error = new Error("Not authenticated");
    error.status = 401;
    throw error;
  }

  const authOptions = {
    ...options,
    credentials: options.credentials ?? "include",
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  };

  let res = await fetch(url, authOptions);

  // If we get 401, try to refresh and retry once
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      authOptions.headers.Authorization = `Bearer ${token}`;
      res = await fetch(url, authOptions);
    }

    // If still 401 after retry, clear session to prevent zombie state
    if (!token || res.status === 401) {
      clearToken();
    }
  }

  return res;
}
