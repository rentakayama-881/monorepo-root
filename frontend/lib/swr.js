/**
 * SWR Configuration and custom fetchers for data fetching with caching
 * Provides auto-revalidation, focus-based refresh, and proper error handling
 */
import useSWR, { mutate as globalMutate } from "swr";
import { getApiBase } from "./api";
import { getToken } from "./auth";
import { fetchWithAuth } from "./tokenRefresh";

/**
 * Default SWR configuration
 * Similar to how GitHub handles data freshness
 */
export const swrConfig = {
  // Revalidate when window regains focus
  revalidateOnFocus: true,
  // Revalidate when browser comes back online
  revalidateOnReconnect: true,
  // Custom retry logic
  shouldRetryOnError: true,
  // Keep previous data while revalidating (smooth UX)
  keepPreviousData: true,
  // Dedupe requests within 2 seconds
  dedupingInterval: 2000,
  // Focus throttle - don't refetch too often on focus
  focusThrottleInterval: 5000,
  // Error retry count
  errorRetryCount: 2,
  // Error retry interval
  errorRetryInterval: 5000,
  // Custom error retry logic
  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    // Don't retry for 404 (resource not found) - it won't magically appear
    if (error.status === 404) return;
    // Don't retry for 401/403 (auth issues) - let token refresh handle it
    if (error.status === 401 || error.status === 403) return;
    // Don't retry for 400 (bad request)
    if (error.status === 400) return;
    // Max 2 retries
    if (retryCount >= 2) return;
    // Retry after 5 seconds for other errors (network, 5xx)
    setTimeout(() => revalidate({ retryCount }), 5000);
  },
};

/**
 * Authenticated fetcher using fetchWithAuth for automatic token refresh
 * @param {string} url - Full URL to fetch
 * @returns {Promise<any>} Parsed JSON response
 */
export async function authFetcher(url) {
  const res = await fetchWithAuth(url);
  
  if (!res) {
    throw new Error("Unauthorized");
  }
  
  if (!res.ok) {
    const error = new Error("API Error");
    try {
      const data = await res.json();
      error.message = data.error || data.message || `Request failed: ${res.status}`;
      error.status = res.status;
    } catch {
      error.message = `Request failed: ${res.status}`;
      error.status = res.status;
    }
    throw error;
  }
  
  return res.json();
}

/**
 * Public fetcher (no auth required)
 * @param {string} url - Full URL to fetch
 * @returns {Promise<any>} Parsed JSON response
 */
export async function publicFetcher(url) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  
  if (!res.ok) {
    const error = new Error("API Error");
    try {
      const data = await res.json();
      error.message = data.error || data.message || `Request failed: ${res.status}`;
      error.status = res.status;
    } catch {
      error.message = `Request failed: ${res.status}`;
      error.status = res.status;
    }
    throw error;
  }
  
  return res.json();
}

/**
 * Hook for fetching current user data with SWR
 * Automatically revalidates on focus and handles token refresh
 */
export function useUser() {
  const token = getToken();
  
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    // Only fetch if we have a token
    token ? `${getApiBase()}/api/account/me` : null,
    authFetcher,
    {
      ...swrConfig,
      // User data should be fresh - check on every focus
      revalidateOnFocus: true,
      // Don't retry on auth errors
      shouldRetryOnError: (error) => error?.status !== 401 && error?.status !== 403,
    }
  );

  return {
    user: data,
    isLoading,
    isValidating,
    error,
    mutate,
    isLoggedIn: !!token && !!data,
  };
}

/**
 * Hook for fetching wallet balance
 * Uses Feature Service for wallet data
 */
export function useWallet() {
  const token = getToken();
  const featureBase = process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.alephdraad.fun";
  
  const { data, error, isLoading, mutate } = useSWR(
    token ? `${featureBase}/api/v1/wallets/me` : null,
    authFetcher,
    {
      ...swrConfig,
      // Wallet balance should refresh on focus
      revalidateOnFocus: true,
    }
  );

  return {
    wallet: data,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for fetching thread detail
 * @param {string|null} threadId - Thread ID to fetch
 */
export function useThread(threadId) {
  const { data, error, isLoading, mutate } = useSWR(
    threadId ? `${getApiBase()}/api/threads/${threadId}` : null,
    publicFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
    }
  );

  return {
    thread: data,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for fetching user's threads (My Threads page)
 */
export function useMyThreads() {
  const token = getToken();
  
  const { data, error, isLoading, mutate } = useSWR(
    token ? `${getApiBase()}/api/threads/my` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
    }
  );

  return {
    threads: data?.threads || [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for fetching categories
 */
export function useCategories() {
  const { data, error, isLoading } = useSWR(
    `${getApiBase()}/api/threads/categories`,
    publicFetcher,
    {
      ...swrConfig,
      // Categories don't change often - longer revalidation
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    categories: data?.categories || [],
    isLoading,
    error,
  };
}

/**
 * Hook for checking if user can delete their account
 */
export function useCanDeleteAccount() {
  const token = getToken();
  
  const { data, error, isLoading, mutate } = useSWR(
    token ? `${getApiBase()}/api/account/can-delete` : null,
    authFetcher,
    {
      ...swrConfig,
      // Don't auto-revalidate - only fetch when needed
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    canDelete: data?.can_delete,
    blockingReasons: data?.blocking_reasons || [],
    warnings: data?.warnings || [],
    walletBalance: data?.wallet_balance || 0,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook for fetching TOTP status
 */
export function useTOTPStatus() {
  const token = getToken();
  
  const { data, error, isLoading, mutate } = useSWR(
    token ? `${getApiBase()}/api/auth/totp/status` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
    }
  );

  return {
    enabled: data?.enabled || false,
    verifiedAt: data?.verified_at,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Global mutate helper - invalidate cache for specific keys
 * Use after mutations (create, update, delete) to trigger refetch
 */
export function invalidateCache(keyOrKeys) {
  if (Array.isArray(keyOrKeys)) {
    keyOrKeys.forEach(key => globalMutate(key));
  } else {
    globalMutate(keyOrKeys);
  }
}

/**
 * Invalidate all user-related data
 * Call this after login/logout
 */
export function invalidateUserData() {
  const base = getApiBase();
  const featureBase = process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.alephdraad.fun";
  globalMutate(`${base}/api/account/me`);
  globalMutate(`${featureBase}/api/v1/wallets/me`);
  globalMutate(`${base}/api/threads/my`);
  globalMutate(`${base}/api/auth/totp/status`);
  globalMutate(`${base}/api/account/can-delete`);
}

/**
 * Invalidate thread-related data
 * Call this after creating/editing/deleting threads
 */
export function invalidateThreads() {
  const base = getApiBase();
  globalMutate(`${base}/api/threads/my`);
  // Also invalidate any matching thread list patterns
  globalMutate(
    (key) => typeof key === 'string' && key.includes('/api/threads'),
    undefined,
    { revalidate: true }
  );
}

export { useSWR, globalMutate as mutate };
