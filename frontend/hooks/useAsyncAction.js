/**
 * useAsyncAction — Hook for mutation operations with loading/error/success state.
 *
 * Replaces the common pattern of:
 *   const [loading, setLoading] = useState(false);
 *   const [error, setError] = useState("");
 *   const handleSubmit = async () => { setLoading(true); try {...} catch {...} finally { setLoading(false) } };
 */

import { useState, useCallback, useRef } from "react";

/**
 * @param {Function} actionFn - Async function to execute
 * @param {object} [options]
 * @param {Function} [options.onSuccess] - Called with result on success
 * @param {Function} [options.onError] - Called with error on failure
 * @param {boolean} [options.resetErrorOnExecute] - Clear error before re-executing (default: true)
 * @returns {{ execute, loading, error, data, reset }}
 */
export function useAsyncAction(actionFn, { onSuccess, onError, resetErrorOnExecute = true } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const mountedRef = useRef(true);

  const execute = useCallback(
    async (...args) => {
      if (resetErrorOnExecute) setError(null);
      setLoading(true);
      try {
        const result = await actionFn(...args);
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
          onSuccess?.(result);
        }
        return result;
      } catch (err) {
        if (mountedRef.current) {
          const message = err?.message || String(err);
          setError(message);
          setLoading(false);
          onError?.(err);
        }
        throw err;
      }
    },
    [actionFn, onSuccess, onError, resetErrorOnExecute]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { execute, loading, error, data, reset };
}
