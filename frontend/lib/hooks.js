/**
 * Custom hooks for API calls with consistent error handling
 */
import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "./api";
import { getToken } from "./auth";
import logger from "./logger";

/**
 * Hook for making authenticated API requests
 * @param {string} endpoint - API endpoint (e.g., "/api/wallet/balance")
 * @param {object} options - Fetch options
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token && options.requireAuth !== false) {
      setError("Unauthorized");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBase()}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      const result = await res.json();
      setData(result);
    } catch (err) {
      logger.error(`API Error [${endpoint}]:`, err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);

  useEffect(() => {
    if (options.skip) return;
    fetchData();
  }, [fetchData, options.skip]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for making mutations (POST, PUT, DELETE)
 * @returns {{ mutate, loading, error }}
 */
export function useMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (endpoint, options = {}) => {
    const token = getToken();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBase()}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      return { success: true, data };
    } catch (err) {
      logger.error(`Mutation Error [${endpoint}]:`, err.message);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, setError };
}

/**
 * Format API error for display
 * @param {Error|string} error 
 * @returns {string}
 */
export function formatApiError(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || "Terjadi kesalahan. Silakan coba lagi.";
}
