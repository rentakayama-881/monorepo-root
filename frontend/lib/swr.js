import useSWR, { mutate as globalMutate } from "swr";
import { getApiBase } from "./api";
import { getToken } from "./auth";
import { fetchWithAuth } from "./tokenRefresh";

export const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  keepPreviousData: true,
  dedupingInterval: 2000,
  focusThrottleInterval: 5000,
  errorRetryCount: 2,
  errorRetryInterval: 5000,
  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    if (error.status === 404) return;
    if (error.status === 401 || error.status === 403) return;
    if (error.status === 400) return;
    if (retryCount >= 2) return;
    setTimeout(() => revalidate({ retryCount }), 5000);
  },
};

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

export function useUser() {
  const token = getToken();

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    token ? `${getApiBase()}/api/account/me` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
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

export function useWallet() {
  const token = getToken();
  const featureBase = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";

  const { data, error, isLoading, mutate } = useSWR(
    token ? `${featureBase}/api/v1/wallets/me` : null,
    authFetcher,
    {
      ...swrConfig,
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

export function useValidationCase(validationCaseId) {
  const { data, error, isLoading, mutate } = useSWR(
    validationCaseId ? `${getApiBase()}/api/validation-cases/${validationCaseId}/public` : null,
    publicFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
    }
  );

  return {
    validationCase: data,
    isLoading,
    error,
    mutate,
  };
}

export function useMyValidationCases() {
  const token = getToken();
  
  const { data, error, isLoading, mutate } = useSWR(
    token ? `${getApiBase()}/api/validation-cases/me` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
    }
  );

  return {
    validationCases: data?.validation_cases || [],
    isLoading,
    error,
    mutate,
  };
}

export function useValidationCaseCategories() {
  const { data, error, isLoading } = useSWR(
    `${getApiBase()}/api/validation-cases/categories`,
    publicFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    categories: data?.categories || [],
    isLoading,
    error,
  };
}

export function useCanDeleteAccount() {
  const token = getToken();

  const { data, error, isLoading, mutate } = useSWR(
    token ? `${getApiBase()}/api/account/can-delete` : null,
    authFetcher,
    {
      ...swrConfig,
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

export function invalidateCache(keyOrKeys) {
  if (Array.isArray(keyOrKeys)) {
    keyOrKeys.forEach(key => globalMutate(key));
  } else {
    globalMutate(keyOrKeys);
  }
}

export function invalidateUserData() {
  const base = getApiBase();
  const featureBase = process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL || "https://feature.aivalid.id";
  globalMutate(`${base}/api/account/me`);
  globalMutate(`${featureBase}/api/v1/wallets/me`);
  globalMutate(`${base}/api/validation-cases/me`);
  globalMutate(`${base}/api/auth/totp/status`);
  globalMutate(`${base}/api/account/can-delete`);
}

export function invalidateValidationCases() {
  const base = getApiBase();
  globalMutate(`${base}/api/validation-cases/me`);
  globalMutate(
    (key) => typeof key === 'string' && key.includes("/api/validation-cases"),
    undefined,
    { revalidate: true }
  );
}

export { useSWR, globalMutate as mutate };
