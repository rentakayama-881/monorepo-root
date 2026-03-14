const SUDO_TOKEN_KEY = "sudo_token";
const SUDO_EXPIRES_KEY = "sudo_expires";

export function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures for resilience in restricted environments.
  }
}

export function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage remove failures for resilience in restricted environments.
  }
}

export function loadStoredSudoState() {
  const token = safeStorageGet(SUDO_TOKEN_KEY);
  const expires = safeStorageGet(SUDO_EXPIRES_KEY);

  if (!token || !expires) {
    return { token: null, expires: null };
  }

  const expiresAt = new Date(expires);
  if (expiresAt > new Date()) {
    return { token, expires: expiresAt };
  }

  safeStorageRemove(SUDO_TOKEN_KEY);
  safeStorageRemove(SUDO_EXPIRES_KEY);
  return { token: null, expires: null };
}

export function saveSudoToken(token, expiresAt) {
  safeStorageSet(SUDO_TOKEN_KEY, token);
  safeStorageSet(SUDO_EXPIRES_KEY, expiresAt);
}

export function clearSudoStorage() {
  safeStorageRemove(SUDO_TOKEN_KEY);
  safeStorageRemove(SUDO_EXPIRES_KEY);
}
