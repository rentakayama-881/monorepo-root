/**
 * API response normalization helpers.
 *
 * Many backend endpoints wrap their payload in inconsistent keys
 * (data / Data / result / Result).  These helpers centralise the
 * unwrapping logic so every call-site does not have to guess.
 */

/**
 * Unwrap a single-value API response.
 *
 * Checks common wrapper keys in order and returns the first match,
 * falling back to the raw payload when no wrapper is detected.
 *
 * @param {unknown} payload - Raw JSON response body
 * @returns {unknown}
 */
export function unwrapApiData(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if ("data" in payload) return payload.data;
  if ("Data" in payload) return payload.Data;
  if ("result" in payload) return payload.result;
  if ("Result" in payload) return payload.Result;
  return payload;
}

/**
 * Extract an array from an API response that may wrap it under
 * various keys (items, accounts, data, result, etc.).
 *
 * @param {unknown} payload - Raw JSON response body
 * @returns {Array}
 */
export function extractList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload.items,
    payload.accounts,
    payload.data,
    payload.result,
    payload.chatgpt,
    payload.rows,
    payload.list,
  ];
  for (const item of candidates) {
    if (Array.isArray(item)) return item;
    if (item && typeof item === "object" && Array.isArray(item.items))
      return item.items;
  }
  return [];
}
