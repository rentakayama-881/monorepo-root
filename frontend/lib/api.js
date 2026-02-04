import { getValidToken } from "./tokenRefresh";
import { clearToken } from "./auth";

export function getApiBase() {
  // Support multiple env var names used across deployments/docs.
  // Prefer explicit API base; fall back to documented backend URL; then a safe default.
  const envBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
    "";

  let base = String(envBase || "").trim();

  // If the env points to HTTP while the app is served over HTTPS, upgrade to HTTPS.
  // This avoids mixed-content blocks and auth header stripping on redirects.
  if (typeof window !== "undefined" && window.location?.protocol === "https:" && base.startsWith("http://")) {
    base = `https://${base.slice("http://".length)}`;
  }

  // If no env is set in production, default to the known API subdomain for the main site.
  // Keeps local dev behavior unchanged.
  if (!base && typeof window !== "undefined") {
    const host = window.location?.hostname || "";
    if (host === "aivalid.id" || host === "www.aivalid.id" || (host.endsWith(".aivalid.id") && host !== "api.aivalid.id")) {
      base = "https://api.aivalid.id";
    }
  }

  if (!base) {
    base = "http://localhost:8080";
  }

  // Normalize trailing slashes.
  return base.replace(/\/+$/, "");
}

export async function fetchJson(path, options = {}) {
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
    const res = await fetch(`${getApiBase()}${path}`, {
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
      // Prioritize error message from backend
      const message = data?.message || data?.error || res.statusText || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data?.code;
      error.details = data?.details;
      error.data = data;
      throw error;
    }

    return data ?? (await res.json());
  } catch (err) {
    // Don't override existing error message from backend
    if (err.message && err.status) {
      throw err;
    }
    
    if (controller.signal.aborted) {
      throw new Error("Request timed out. Please try again.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request was cancelled.");
    }
    
    // Only throw network error if it's actually a network issue
    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error("Unable to connect to server. Please check your internet connection.");
    }
    
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Authenticated version of fetchJson that handles token refresh automatically.
 * Use this for all authenticated API calls.
 */
export async function fetchJsonAuth(path, options = {}) {
  const { timeout = 10000, signal, headers = {}, ...rest } = options;
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
    // Get valid token (refreshes if needed)
    const token = await getValidToken();
    if (!token) {
      const error = new Error("Sesi telah berakhir. Silakan login kembali.");
      error.status = 401;
      error.code = "session_expired";
      throw error;
    }

    const res = await fetch(`${getApiBase()}${path}`, {
      ...rest,
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      // Handle specific auth errors
      if (res.status === 401) {
        // Session invalid - clear and signal session expired
        clearToken();
        const error = new Error(data?.message || data?.error || "Sesi telah berakhir. Silakan login kembali.");
        error.status = 401;
        error.code = data?.code || "session_expired";
        error.details = data?.details;
        error.data = data;
        throw error;
      }

      if (res.status === 403) {
        // Check if account is locked
        if (data?.code === "AUTH009" || data?.code === "AUTH012" || data?.message?.includes("terkunci")) {
          const error = new Error(data?.message || data?.error || "Akun terkunci. Hubungi admin untuk bantuan.");
          error.status = 403;
          error.code = data?.code || "account_locked";
          error.lockedAt = data?.locked_at;
          error.expiresAt = data?.expires_at;
          error.reason = data?.reason;
          error.details = data?.details;
          error.data = data;
          throw error;
        }
        // Other 403 errors (permission denied, etc)
        const error = new Error(data?.message || data?.error || "Akses ditolak.");
        error.status = 403;
        error.code = data?.code || "forbidden";
        error.details = data?.details;
        error.data = data;
        throw error;
      }

      // Prioritaskan pesan error dari backend
      const message = data?.message || data?.error || res.statusText || `Request gagal dengan status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data?.code;
      error.details = data?.details;
      error.data = data;
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

export function fetchHealth() {
  return fetchJson("/api/health", { method: "GET" });
}
