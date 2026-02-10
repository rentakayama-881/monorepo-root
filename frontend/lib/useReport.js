/**
 * Custom hooks for Reports API (Feature Service)
 * Handles report submission
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
  VALIDATION_CASE: "validation_case",
};

/**
 * Hook for submitting a report
 * @returns {{ submitReport, loading, error, success }}
 */
export function useSubmitReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const submitReport = useCallback(async ({ targetType, targetId, validationCaseId, reason, description = "" }) => {
    const token = getToken();
    if (!token) {
      const err = new Error("Authentication required to submit a report");
      setError(err.message);
      throw err;
    }

    // Validate reason
    const validReasons = REPORT_REASONS.map((r) => r.value);
    if (!validReasons.includes(reason)) {
      const err = new Error("Invalid report reason");
      setError(err.message);
      throw err;
    }

    // Validate target type
    if (!Object.values(REPORT_TARGET_TYPES).includes(targetType)) {
      const err = new Error("Invalid target type");
      setError(err.message);
      throw err;
    }

    const parsedValidationCaseId = Number(validationCaseId);
    if (!Number.isFinite(parsedValidationCaseId) || parsedValidationCaseId <= 0) {
      const err = new Error("Invalid validation case ID");
      setError(err.message);
      throw err;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const body = {
        targetType,
        targetId: targetId ?? String(parsedValidationCaseId),
        validationCaseId: parsedValidationCaseId,
        reason,
      };

      if (description && description.trim()) {
        body.description = description.trim();
      }

      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.REPORTS.CREATE, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (result?.reportId) {
        setSuccess(true);
        return result; // { reportId, message }
      }

      if (result?.success === false) {
        throw new Error(result.message || "Failed to submit report");
      }

      // Backwards-compatible: treat any 2xx JSON as success if fetchFeatureAuth didn't throw.
      setSuccess(true);
      return result;
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
