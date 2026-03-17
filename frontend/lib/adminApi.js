/**
 * Shared admin API fetch helper.
 * Encapsulates token auth, error extraction, and Feature Service unwrapping
 * that is repeated across 10+ admin pages.
 */

import { getAdminToken } from "@/lib/adminAuth";
import { getApiBase } from "@/lib/api";
import { getFeatureApiBase, unwrapFeatureData, extractFeatureItems } from "@/lib/featureApi";

/**
 * Fetch from Go backend with admin token.
 * @param {string} path - API path (e.g. "/admin/users")
 * @param {object} [options] - fetch options
 * @returns {Promise<any>} parsed JSON
 */
export async function fetchAdminApi(path, options = {}) {
  const token = getAdminToken();
  if (!token) throw new Error("Sesi admin berakhir. Silakan login ulang.");

  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Request gagal (${res.status})`));
  }

  return res.json();
}

/**
 * Fetch from Feature Service with admin token.
 * @param {string} path - API path (e.g. "/api/v1/admin/moderation/device-bans")
 * @param {object} [options] - fetch options
 * @returns {Promise<any>} parsed JSON
 */
export async function fetchAdminFeature(path, options = {}) {
  const token = getAdminToken();
  if (!token) throw new Error("Sesi admin berakhir. Silakan login ulang.");

  const res = await fetch(`${getFeatureApiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, `Request gagal (${res.status})`));
  }

  return res.json();
}

/**
 * Fetch list from Feature Service, unwrap and normalize items.
 * @param {string} path - API path
 * @param {Function} normalizer - Item normalizer function
 * @returns {Promise<Array>} normalized items
 */
export async function fetchAdminFeatureList(path, normalizer) {
  const data = await fetchAdminFeature(path);
  const payload = unwrapFeatureData(data);
  const items = extractFeatureItems(payload);
  return normalizer ? items.map(normalizer) : items;
}

/**
 * Extract error message from a failed response.
 */
async function extractErrorMessage(res, fallback) {
  try {
    const body = await res.json();
    if (body?.error?.message) return body.error.message;
    if (typeof body?.error === "string") return body.error;
    if (body?.message) return body.message;
  } catch {}
  return fallback;
}
