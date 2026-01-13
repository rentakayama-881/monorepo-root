export const TOKEN_KEY = "token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const TOKEN_EXPIRES_KEY = "token_expires";
export const AUTH_CHANGED_EVENT = "auth:changed";

function broadcastAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getTokenExpiry() {
  if (typeof window === "undefined") return null;
  try {
    const expires = localStorage.getItem(TOKEN_EXPIRES_KEY);
    return expires ? new Date(expires) : null;
  } catch {
    return null;
  }
}

export function isTokenExpired() {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  // Add 30 second buffer before actual expiry
  return new Date() >= new Date(expiry.getTime() - 30000);
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  broadcastAuthChange();
}

export function setRefreshToken(token) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {}
}

export function setTokenExpiry(expiresIn) {
  if (typeof window === "undefined") return;
  try {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    localStorage.setItem(TOKEN_EXPIRES_KEY, expiresAt.toISOString());
  } catch {}
}

export function setTokens(accessToken, refreshToken, expiresIn) {
  setToken(accessToken);
  if (refreshToken) {
    const current = getRefreshToken();
    if (refreshToken !== current) {
      setRefreshToken(refreshToken);
    }
  }
  if (expiresIn) {
    setTokenExpiry(expiresIn);
  }
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
  } catch {}
  broadcastAuthChange();
}
