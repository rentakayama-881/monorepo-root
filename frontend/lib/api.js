import { getValidToken } from "./tokenRefresh";
import { clearToken } from "./auth";

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
}

/**
 * Internal helper to handle common fetch logic including timeout, abort, and error handling
 */
async function baseFetch(url, options = {}) {
  const { timeout = 10000, signal, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeout);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
  }

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
    });

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      // Handle specific auth errors for authenticated requests
      if (res.status === 401 && options.isAuthenticated) {
        clearToken();
        const error = new Error(data?.error || "Sesi telah berakhir. Silakan login kembali.");
        error.status = 401;
        error.code = data?.code || "session_expired";
        throw error;
      }

      if (res.status === 403 && options.isAuthenticated) {
        // Check if account is locked
        if (data?.code === "account_locked" || data?.error?.includes("terkunci")) {
          const error = new Error(data?.error || "Akun terkunci. Hubungi admin untuk bantuan.");
          error.status = 403;
          error.code = "account_locked";
          error.lockedAt = data?.locked_at;
          error.expiresAt = data?.expires_at;
          error.reason = data?.reason;
          throw error;
        }
        // Other 403 errors (permission denied, etc)
        const error = new Error(data?.error || "Akses ditolak.");
        error.status = 403;
        error.code = data?.code || "forbidden";
        throw error;
      }

      // Prioritaskan pesan error dari backend
      const message = data?.error || data?.message || res.statusText || `Request gagal dengan status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data?.code;
      throw error;
    }

    return data ?? (await res.json());
  } catch (err) {
    // Jangan override error message yang sudah ada dari backend
    if (err.message && err.status) {
      throw err;
    }
    
    if (controller.signal.aborted) {
      throw new Error("Request timeout. Silakan coba lagi.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request dibatalkan.");
    }
    
    // Hanya throw network error jika memang network issue
    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
    }
    
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJson(path, options = {}) {
  return baseFetch(`${getApiBase()}${path}`, options);
}

/**
 * Authenticated version of fetchJson that handles token refresh automatically.
 * Use this for all authenticated API calls.
 */
export async function fetchJsonAuth(path, options = {}) {
  const { headers = {}, ...rest } = options;

  // Get valid token (refreshes if needed)
  const token = await getValidToken();
  if (!token) {
    const error = new Error("Sesi telah berakhir. Silakan login kembali.");
    error.status = 401;
    error.code = "session_expired";
    throw error;
  }

  return baseFetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`,
    },
    isAuthenticated: true,
  });
}

export function fetchHealth() {
  return fetchJson("/api/health", { method: "GET" });
}
