/**
 * Feature Service API Client
 * For ASP.NET Core backend (MongoDB) - handles reports, documents, wallets, etc.
 */

import { getValidToken, refreshAccessToken } from "./tokenRefresh";
import { clearToken } from "./auth";
import { FEATURE_ENDPOINTS } from "./featureEndpoints";
import { unwrapFeatureData, extractFeatureItems, extractTotalCount } from "./featureApiHelpers";

// Re-export for backward compatibility
export { FEATURE_ENDPOINTS } from "./featureEndpoints";
export { unwrapFeatureData, extractFeatureItems, extractTotalCount } from "./featureApiHelpers";

/**
 * Get Feature Service base URL
 */
export function getFeatureApiBase() {
  return process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";
}

function hasHeader(headers, key) {
  if (!headers) return false;
  const target = String(key || "").toLowerCase();
  return Object.keys(headers).some((k) => String(k).toLowerCase() === target);
}

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function buildRequestHeaders(baseHeaders = {}, extraHeaders = {}, body) {
  const merged = {
    ...baseHeaders,
    ...extraHeaders,
  };

  if (isFormDataBody(body)) {
    // Let browser set proper multipart/form-data boundary automatically.
    for (const key of Object.keys(merged)) {
      if (String(key).toLowerCase() === "content-type") {
        delete merged[key];
      }
    }
    return merged;
  }

  if (!hasHeader(merged, "Content-Type")) {
    merged["Content-Type"] = "application/json";
  }

  return merged;
}

function shouldAttachIdempotencyKey(path, method) {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;

  // Only attach where Feature Service expects idempotency keys (finance/security writes).
  return (
    typeof path === "string" &&
    (path.startsWith("/api/v1/wallets/") ||
      path.startsWith("/api/v1/guarantees") ||
      path.startsWith("/api/v1/disputes"))
  );
}

function generateIdempotencyKey() {
  return crypto.randomUUID();
}

function safeToString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractFeatureServiceError(data) {
  // Feature Service standard error:
  // { success:false, error:{ code, message, details }, meta:{ requestId, timestamp } }
  const apiError = data?.error;
  if (apiError && typeof apiError === "object") {
    return {
      code: apiError.code,
      message: safeToString(apiError.message),
      details: apiError.details,
      requestId: data?.meta?.requestId,
    };
  }

  // Legacy/other shapes
  return {
    code: data?.code,
    message: safeToString(data?.message || data?.error),
    details: data?.details,
    requestId: data?.requestId || data?.meta?.requestId,
  };
}

/**
 * Fetch from Feature Service (no auth required)
 */
export async function fetchFeature(path, options = {}) {
  const { timeout = 15000, signal, ...rest } = options;
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
    const resolvedHeaders = buildRequestHeaders({}, rest.headers || {}, rest.body);
    const res = await fetch(`${getFeatureApiBase()}${path}`, {
      ...rest,
      headers: resolvedHeaders,
      signal: controller.signal,
    });

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const extracted = extractFeatureServiceError(data);
      const message =
        extracted.message || res.statusText || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = extracted.code;
      error.details = extracted.details;
      error.requestId = extracted.requestId;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.message && err.status) {
      throw err;
    }

    if (controller.signal.aborted) {
      throw new Error("Request timed out. Please try again.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request cancelled.");
    }

    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error(
        "Unable to connect to Feature Service. Please check your internet connection."
      );
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Authenticated fetch from Feature Service
 * Uses the same JWT token from Go backend
 */
export async function fetchFeatureAuth(path, options = {}) {
  const { timeout = 15000, signal, headers = {}, ...rest } = options;
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
    // Get valid token (refreshes if needed via Go backend)
    let token = await getValidToken();
    if (!token) {
      const error = new Error("Your session has expired. Please sign in again.");
      error.status = 401;
      error.code = "session_expired";
      throw error;
    }

    const method = rest.method || "GET";

    const performAuthedRequest = async (accessToken) => {
      const requestHeaders = buildRequestHeaders(
        { Authorization: `Bearer ${accessToken}` },
        headers,
        rest.body
      );

      if (
        shouldAttachIdempotencyKey(path, method) &&
        !hasHeader(requestHeaders, "X-Idempotency-Key")
      ) {
        requestHeaders["X-Idempotency-Key"] = generateIdempotencyKey();
      }

      return fetch(`${getFeatureApiBase()}${path}`, {
        ...rest,
        headers: {
          ...requestHeaders,
        },
        signal: controller.signal,
      });
    };

    let res = await performAuthedRequest(token);

    // Token can be revoked while still considered valid by local expiry clock.
    if (res.status === 401) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        token = refreshedToken;
        res = await performAuthedRequest(token);
      }
    }

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const extracted = extractFeatureServiceError(data);
      const message =
        extracted.message || res.statusText || `Request failed with status ${res.status}`;

      // Handle auth errors
      if (res.status === 401) {
        clearToken();
        const error = new Error(message || "Your session has expired. Please sign in again.");
        error.status = 401;
        error.code = extracted.code || "session_expired";
        error.details = extracted.details;
        error.requestId = extracted.requestId;
        throw error;
      }

      if (res.status === 403) {
        const error = new Error(message || "Access denied.");
        error.status = 403;
        error.code = extracted.code || "forbidden";
        error.details = extracted.details;
        error.requestId = extracted.requestId;
        throw error;
      }

      const error = new Error(message);
      error.status = res.status;
      error.code = extracted.code;
      error.details = extracted.details;
      error.requestId = extracted.requestId;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.message && err.status) {
      throw err;
    }

    if (controller.signal.aborted) {
      throw new Error("Request timed out. Please try again.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request cancelled.");
    }

    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error(
        "Unable to connect to Feature Service. Please check your internet connection."
      );
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
