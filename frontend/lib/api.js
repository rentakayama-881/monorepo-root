import { getValidToken, refreshAccessToken } from "./tokenRefresh";
import { clearToken } from "./auth";

// Shared helpers for fetchJson / fetchJsonAuth

function createTimeoutSignal(timeout, externalSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeout);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
    }
  }

  return { controller, timeoutId };
}

async function parseJsonSafe(res) {
  try {
    return await res.clone().json();
  } catch {
    return null;
  }
}

function throwIfBackendError(err) {
  if (err.message && err.status) throw err;
}

function classifyNetworkError(err, controller) {
  if (controller.signal.aborted) {
    throw new Error("Request timed out. Please try again.");
  }
  if (err?.name === "AbortError") {
    throw new Error("Request was cancelled.");
  }
  if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
    throw new Error("Unable to connect to server. Please check your internet connection.");
  }
  throw err;
}

export function getApiBase() {
  const isServer = typeof window === "undefined";

  if (isServer) {
    // Build/server-side requests must use an explicit backend origin.
    const serverBase = String(process.env.API_BASE_URL || "").trim();
    if (serverBase) {
      return serverBase.replace(/\/+$/, "");
    }
  }

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
  const { timeout = 10000, signal, credentials = "include", ...rest } = options;
  const { controller, timeoutId } = createTimeoutSignal(timeout, signal);

  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      ...rest,
      credentials,
      signal: controller.signal,
    });

    const data = await parseJsonSafe(res);

    if (!res.ok) {
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
    throwIfBackendError(err);
    classifyNetworkError(err, controller);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchJsonAuth(path, options = {}) {
  const { timeout = 10000, signal, headers = {}, clearSessionOn401 = true, credentials = "include", ...rest } = options;
  const { controller, timeoutId } = createTimeoutSignal(timeout, signal);

  try {
    let token = await getValidToken();
    if (!token) {
      const error = new Error("Sesi telah berakhir. Silakan login kembali.");
      error.status = 401;
      error.code = "session_expired";
      throw error;
    }

    const performAuthedRequest = async (accessToken) =>
      fetch(`${getApiBase()}${path}`, {
        ...rest,
        credentials,
        headers: { ...headers, Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });

    let res = await performAuthedRequest(token);

    // If token is revoked/stale but not yet expired locally, refresh once and retry.
    if (res.status === 401) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        token = refreshedToken;
        res = await performAuthedRequest(token);
      }
    }

    const data = await parseJsonSafe(res);

    if (!res.ok) {
      if (res.status === 401) {
        if (clearSessionOn401) clearToken();
        const error = new Error(data?.message || data?.error || "Sesi telah berakhir. Silakan login kembali.");
        error.status = 401;
        error.code = data?.code || "session_expired";
        error.details = data?.details;
        error.data = data;
        throw error;
      }

      if (res.status === 403) {
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
        const error = new Error(data?.message || data?.error || "Akses ditolak.");
        error.status = 403;
        error.code = data?.code || "forbidden";
        error.details = data?.details;
        error.data = data;
        throw error;
      }

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
    throwIfBackendError(err);
    classifyNetworkError(err, controller);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function fetchHealth() {
  return fetchJson("/api/health", { method: "GET" });
}
