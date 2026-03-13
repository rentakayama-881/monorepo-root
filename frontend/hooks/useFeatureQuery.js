/**
 * useFeatureQuery — SWR-based hook for Feature Service API calls.
 *
 * Replaces manual useState+useCallback+useEffect pattern in featureApi.js.
 * Follows the same pattern as lib/swr.js hooks.
 */

import useSWR from "swr";
import { swrConfig, authFetcher } from "@/lib/swr";
import { getFeatureApiBase, unwrapFeatureData, extractFeatureItems } from "@/lib/featureApi";

/**
 * Generic hook for authenticated Feature Service queries.
 *
 * @param {string|null} path - Endpoint path (e.g. "/api/v1/wallets/me"), or null to disable
 * @param {object} [options]
 * @param {Record<string,string>} [options.params] - Query parameters
 * @param {boolean} [options.isList] - If true, extracts items array + totalCount
 * @param {object} [options.swrOptions] - Extra SWR options
 * @returns {{ data, items, totalCount, isLoading, error, mutate }}
 */
export function useFeatureQuery(path, { params, isList = false, swrOptions } = {}) {
  const base = getFeatureApiBase();

  let url = null;
  if (path) {
    const fullPath = path.startsWith("http") ? path : `${base}${path}`;
    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      url = qs ? `${fullPath}?${qs}` : fullPath;
    } else {
      url = fullPath;
    }
  }

  const {
    data: raw,
    error,
    isLoading,
    mutate,
  } = useSWR(url, authFetcher, {
    ...swrConfig,
    revalidateOnFocus: true,
    ...swrOptions,
  });

  if (isList) {
    const unwrapped = raw ? unwrapFeatureData(raw) : null;
    const items = unwrapped ? extractFeatureItems(unwrapped) : [];
    const totalCount =
      unwrapped?.totalCount ?? unwrapped?.TotalCount ?? unwrapped?.total_count ?? items.length;

    return { data: unwrapped, items, totalCount, isLoading, error, mutate };
  }

  const data = raw ? unwrapFeatureData(raw) : null;
  return { data, items: null, totalCount: null, isLoading, error, mutate };
}
