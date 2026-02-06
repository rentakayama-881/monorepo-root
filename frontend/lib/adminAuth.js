const ADMIN_TOKEN_KEY = "admin_token";
const ADMIN_INFO_KEY = "admin_info";
const EXPIRY_SKEW_SECONDS = 30;

function hasWindow() {
  return typeof window !== "undefined";
}

function safeGetSessionStorage() {
  if (!hasWindow()) return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGetLocalStorage() {
  if (!hasWindow()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const normalized = base64 + padding;
    if (typeof atob !== "function") return null;
    const json = atob(normalized);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpired(token) {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false;
  const nowSeconds = Date.now() / 1000;
  return nowSeconds >= exp - EXPIRY_SKEW_SECONDS;
}

function migrateLegacySession() {
  const session = safeGetSessionStorage();
  const legacy = safeGetLocalStorage();
  if (!session || !legacy) return;

  try {
    const sessionToken = session.getItem(ADMIN_TOKEN_KEY);
    if (sessionToken) return;

    const legacyToken = legacy.getItem(ADMIN_TOKEN_KEY);
    if (!legacyToken) return;

    session.setItem(ADMIN_TOKEN_KEY, legacyToken);
    const legacyInfo = legacy.getItem(ADMIN_INFO_KEY);
    if (legacyInfo) {
      session.setItem(ADMIN_INFO_KEY, legacyInfo);
    }

    legacy.removeItem(ADMIN_TOKEN_KEY);
    legacy.removeItem(ADMIN_INFO_KEY);
  } catch {
    // ignore storage access errors
  }
}

export function setAdminSession(token, adminInfo) {
  const session = safeGetSessionStorage();
  const legacy = safeGetLocalStorage();
  if (!session) return;

  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) return;

  try {
    session.setItem(ADMIN_TOKEN_KEY, normalizedToken);
    if (adminInfo != null) {
      session.setItem(ADMIN_INFO_KEY, JSON.stringify(adminInfo));
    } else {
      session.removeItem(ADMIN_INFO_KEY);
    }

    legacy?.removeItem(ADMIN_TOKEN_KEY);
    legacy?.removeItem(ADMIN_INFO_KEY);
  } catch {
    // ignore storage access errors
  }
}

export function getAdminToken() {
  migrateLegacySession();
  const session = safeGetSessionStorage();
  if (!session) return null;

  try {
    const token = session.getItem(ADMIN_TOKEN_KEY);
    if (!token) return null;

    if (isExpired(token)) {
      clearAdminSession();
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

export function getAdminInfo() {
  migrateLegacySession();
  const session = safeGetSessionStorage();
  if (!session) return null;

  try {
    const raw = session.getItem(ADMIN_INFO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  const session = safeGetSessionStorage();
  const legacy = safeGetLocalStorage();

  try {
    session?.removeItem(ADMIN_TOKEN_KEY);
    session?.removeItem(ADMIN_INFO_KEY);
    legacy?.removeItem(ADMIN_TOKEN_KEY);
    legacy?.removeItem(ADMIN_INFO_KEY);
  } catch {
    // ignore storage access errors
  }
}
