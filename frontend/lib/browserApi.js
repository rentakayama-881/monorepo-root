/**
 * Browser Service API Client
 * For the Smart Browser cloud anti-detect browser service.
 *
 * Browser Service: browser.aivalid.id (dedicated browser infra)
 * Feature Service: feature.aivalid.id (pricing/billing via existing featureApi)
 */

import { getValidToken, refreshAccessToken } from "./tokenRefresh";
import { clearToken } from "./auth";

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

function getBrowserApiBase() {
  return process.env.NEXT_PUBLIC_BROWSER_API_URL || "https://browser.aivalid.id";
}

// ---------------------------------------------------------------------------
// Core fetch helper (authenticated)
// ---------------------------------------------------------------------------

export async function fetchBrowserApi(path, options = {}) {
  const { timeout = 15000, signal, headers = {}, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeout);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), {
        once: true,
      });
    }
  }

  try {
    let token = await getValidToken();
    if (!token) {
      const error = new Error("Sesi Anda telah berakhir. Silakan masuk kembali.");
      error.status = 401;
      error.code = "session_expired";
      throw error;
    }

    const performRequest = async (accessToken) =>
      fetch(`${getBrowserApiBase()}${path}`, {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...headers,
        },
        signal: controller.signal,
      });

    let res = await performRequest(token);

    // Refresh once if 401
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        token = refreshed;
        res = await performRequest(token);
      }
    }

    let data;
    try {
      data = await res.clone().json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
        const error = new Error(
          data?.message || data?.error || "Sesi Anda telah berakhir. Silakan masuk kembali."
        );
        error.status = 401;
        error.code = data?.code || "session_expired";
        throw error;
      }

      const message =
        data?.message ||
        data?.error ||
        res.statusText ||
        `Request gagal dengan status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data?.code;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.message && err.status) throw err;

    if (controller.signal.aborted) {
      throw new Error("Request timeout. Silakan coba lagi.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request dibatalkan.");
    }
    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error("Tidak dapat terhubung ke Browser Service. Periksa koneksi internet Anda.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

export function getProfiles() {
  return fetchBrowserApi("/api/v1/profiles");
}

export function createProfile(data) {
  return fetchBrowserApi("/api/v1/profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProfile(id, data) {
  return fetchBrowserApi(`/api/v1/profiles/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteProfile(id) {
  return fetchBrowserApi(`/api/v1/profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function startSession(profileId) {
  return fetchBrowserApi("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId }),
    timeout: 30000, // starting a session may take longer
  });
}

export function stopSession(sessionId) {
  return fetchBrowserApi(`/api/v1/sessions/${encodeURIComponent(sessionId)}/stop`, {
    method: "POST",
  });
}

export function getSessionStatus(sessionId) {
  return fetchBrowserApi(`/api/v1/sessions/${encodeURIComponent(sessionId)}`);
}

export function getSessions(activeOnly = false) {
  const qs = activeOnly ? "?active=true" : "";
  return fetchBrowserApi(`/api/v1/sessions${qs}`);
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export function getPricing() {
  return fetchBrowserApi("/api/v1/pricing");
}
