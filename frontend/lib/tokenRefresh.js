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
        // Refresh failed - clear tokens and redirect to login
        clearToken();
        if (typeof window !== "undefined") {
          // Check if we're not already on login page
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login?session=expired";
          }
        }
        return null;
      }

      const data = await res.json();
      setTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } catch (error) {
      console.error("Token refresh failed:", error);
      clearToken();
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
