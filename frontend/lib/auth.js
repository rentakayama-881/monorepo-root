export const TOKEN_KEY = "token";

export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
  // storage event TIDAK ke-trigger di tab yang sama, jadi kita buat event sendiri
  window.dispatchEvent(new Event("auth:changed"));
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  window.dispatchEvent(new Event("auth:changed"));
}
