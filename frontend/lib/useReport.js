/**
 * Custom hooks for Reports API (Feature Service)
 * Handles report submission and listing
 */
import { useState, useEffect, useCallback } from "react";
import { fetchFeature, fetchFeatureAuth, FEATURE_ENDPOINTS } from "./featureApi";
import { getToken } from "./auth";
import logger from "./logger";

/**
 * Report reasons
 */
export const REPORT_REASONS = [
  { value: "harassment", label: "Pelecehan / Harassment" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Konten Tidak Pantas" },
  { value: "hate_speech", label: "Ujaran Kebencian" },
  { value: "misinformation", label: "Informasi Menyesatkan" },
  { value: "other", label: "Lainnya" },
];

/**
 * Report target types
 */
export const REPORT_TARGET_TYPES = {
  THREAD: "thread",
  REPLY: "reply",
  USER: "user",
};

/**
 * Hook for submitting a report
 * @returns {{ submitReport, loading, error, success }}
 */
export function useSubmitReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const submitReport = useCallback(async (targetType, targetId, reason, description = "") => {
    const token = getToken();
    if (!token) {
      const err = new Error("Silakan login untuk melaporkan");
      setError(err.message);
      throw err;
    }

    // Validate reason
    const validReasons = REPORT_REASONS.map((r) => r.value);
    if (!validReasons.includes(reason)) {
      const err = new Error("Alasan laporan tidak valid");
      setError(err.message);
      throw err;
    }

    // Validate target type
    if (!Object.values(REPORT_TARGET_TYPES).includes(targetType)) {
      const err = new Error("Tipe target tidak valid");
      setError(err.message);
      throw err;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const body = {
        targetType,
        targetId,
        reason,
      };

      if (description && description.trim()) {
        body.description = description.trim();
      }

      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.REPORTS.CREATE, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (result.success) {
        setSuccess(true);
        return result.data; // { reportId }
      } else {
        throw new Error(result.message || "Gagal mengirim laporan");
      }
    } catch (err) {
      logger.error("Submit Report Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { submitReport, loading, error, success, reset };
}

/**
 * Hook for fetching user's reports
 * @param {object} options - Options
 * @param {number} options.limit - Items per page
 * @param {boolean} options.skip - Skip initial fetch
 * @returns {{ reports, loading, error, hasMore, loadMore, refetch }}
 */
export function useMyReports(options = {}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(!options.skip);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const fetchReports = useCallback(
    async (cursor = null, append = false) => {
      const token = getToken();
      if (!token) {
        setError("Silakan login untuk melihat laporan Anda");
        setLoading(false);
        return;
      }

      const limit = options.limit || 20;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const queryParams = new URLSearchParams({ limit: String(limit) });
        if (cursor) {
          queryParams.set("cursor", cursor);
        }

        const endpoint = `${FEATURE_ENDPOINTS.REPORTS.LIST}?${queryParams}`;
        const result = await fetchFeatureAuth(endpoint);

        if (result.success) {
          const newReports = result.data || [];
          setReports((prev) => (append ? [...prev, ...newReports] : newReports));
          setHasMore(result.meta?.hasMore || false);
          setNextCursor(result.meta?.nextCursor || null);
        } else {
          throw new Error(result.message || "Gagal memuat laporan");
        }
      } catch (err) {
        logger.error("Fetch Reports Error:", err.message);
        if (!append) {
          setError(err.message);
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [options.limit]
  );

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoadingMore) {
      fetchReports(nextCursor, true);
    }
  }, [nextCursor, isLoadingMore, fetchReports]);

  const refetch = useCallback(() => {
    setNextCursor(null);
    fetchReports(null, false);
  }, [fetchReports]);

  useEffect(() => {
    if (!options.skip) {
      fetchReports();
    }
  }, [options.skip, fetchReports]);

  return { reports, loading, error, hasMore, loadMore, refetch, isLoadingMore };
}

/**
 * Hook for fetching available report reasons
 * @returns {{ reasons, loading, error }}
 */
export function useReportReasons() {
  const [reasons, setReasons] = useState(REPORT_REASONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReasons = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeature(FEATURE_ENDPOINTS.REPORTS.REASONS);

      if (result.success && result.data) {
        // Map API response to our format if needed
        const mappedReasons = result.data.map((reason) => ({
          value: reason.code || reason.value,
          label: reason.label || reason.name,
        }));
        setReasons(mappedReasons);
      }
    } catch (err) {
      // Fallback to static reasons on error
      logger.warn("Failed to fetch report reasons, using defaults:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReasons();
  }, [fetchReasons]);

  return { reasons, loading, error };
}
