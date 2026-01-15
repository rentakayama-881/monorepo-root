import { getApiBase } from "./api";
import {
  getToken,
  getRefreshToken,
  isTokenExpired,
  setTokens,
  clearToken,
} from "./auth";

let refreshPromise = null;

/**
 * Refresh the access token using the refresh token
 * Returns the new access token or null if refresh failed
 */
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearToken();
    return null;
  }

  // Prevent multiple simultaneous refresh calls
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          // Ignore JSON parse errors
        }

        // Check if account is locked (403 with specific message)
        if (res.status === 403 && (data?.code === "AUTH009" || data?.code === "AUTH012" || data?.message?.includes("terkunci") || data?.error?.includes("terkunci"))) {
          // Account locked - redirect silently
          clearToken();
          if (typeof window !== "undefined") {
            if (!window.location.pathname.includes("/login")) {
              window.location.href = "/login?error=account_locked";
            }
          }
          return null;
        }

        // Only clear token and redirect for definitive auth errors (401, 403)
        // Don't logout for server errors (5xx) or other issues
        if (res.status === 401 || res.status === 403) {
          clearToken();
          if (typeof window !== "undefined") {
            if (!window.location.pathname.includes("/login")) {
              window.location.href = "/login?session=expired";
            }
          }
        }
        // For other errors (5xx, network), just return null without clearing
        // Let the user retry or the page handle gracefully
        return null;
      }

      const data = await res.json();
      setTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } catch (error) {
      // Network error - don't clear tokens, just return null
      // User can retry when connection is restored
      console.warn("Token refresh failed (network):", error.message);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidToken() {
  const token = getToken();
  
  if (!token) {
    return null;
  }

  // Check if token is about to expire
  if (isTokenExpired()) {
    return await refreshAccessToken();
  }

  return token;
}

/**
 * Wrapper for fetch that automatically handles token refresh
 */
export async function fetchWithAuth(url, options = {}) {
  let token = await getValidToken();
  
  if (!token) {
    throw new Error("Not authenticated");
  }

  const authOptions = {
    ...options,
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
  }

  return res;
}
