/**
 * Custom hooks for API calls with consistent error handling
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { getApiBase } from "./api";
import { getToken } from "./auth";
import logger from "./logger";

/**
 * Hook for making authenticated API requests
 * @param {string} endpoint - API endpoint (e.g., "/api/wallet/balance")
 * @param {object} options - Fetch options
 * @param {boolean} options.skip - Skip initial fetch
 * @param {boolean} options.requireAuth - Require auth token (default: true)
 * @param {object} options.headers - Additional headers
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState(null);
  
  // Use ref to store options to avoid dependency issues
  // This allows us to always access the latest options without causing re-renders
  const optionsRef = useRef(options);
  optionsRef.current = options;
  
  // Store abort controller for manual refetch cancellation
  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async (signal) => {
    const opts = optionsRef.current;
    const token = getToken();
    
    // Check if request was already aborted before proceeding
    if (signal?.aborted) {
      return;
    }
    
    if (!token && opts.requireAuth !== false) {
      // Only set state if not aborted
      if (!signal?.aborted) {
        setError("Unauthorized");
        setLoading(false);
      }
      return;
    }

    // Check again before setting initial state
    if (!signal?.aborted) {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await fetch(`${getApiBase()}${endpoint}`, {
        signal, // AbortController signal for cancellation
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...opts.headers,
        },
        ...opts,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      const result = await res.json();
      // Check if aborted before setting state
      if (!signal?.aborted) {
        setData(result);
      }
    } catch (err) {
      // Don't set error if request was aborted (component unmounted or deps changed)
      if (err.name === 'AbortError') {
        return;
      }
      logger.error(`API Error [${endpoint}]:`, err.message);
      // Only set error state if not aborted
      if (!signal?.aborted) {
        setError(err.message);
      }
    } finally {
      // Only update loading state if not aborted
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [endpoint]); // Only endpoint as dependency - options accessed via ref

  useEffect(() => {
    if (optionsRef.current.skip) return;
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    fetchData(abortController.signal);
    
    // Cleanup: abort request when component unmounts or endpoint changes
    return () => {
      abortController.abort();
    };
  }, [fetchData]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    fetchData(abortController.signal);
  }, [fetchData]);

  return { data, loading, error, refetch };
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
  return error.message || "An unexpected error occurred. Please try again.";
}
