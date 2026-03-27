"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { getToken, AUTH_CHANGED_EVENT } from "@/lib/auth";
import { swrConfig, authFetcher } from "@/lib/swr";

// ---------------------------------------------------------------------------
// Shared auth token hook (mirrors lib/swr.js pattern)
// ---------------------------------------------------------------------------

function useAuthToken() {
  const [token, setToken] = useState(() => getToken());

  useEffect(() => {
    const sync = () => setToken(getToken());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);

  return token;
}

// ---------------------------------------------------------------------------
// Browser Service base URL
// ---------------------------------------------------------------------------

function getBrowserBase() {
  return process.env.NEXT_PUBLIC_BROWSER_API_URL || "https://browser.aivalid.id";
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all browser profiles for current user */
export function useProfiles() {
  const token = useAuthToken();

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    token ? `${getBrowserBase()}/api/v1/profiles` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
    }
  );

  return {
    profiles: data?.profiles ?? data?.data ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/** Fetch active sessions */
export function useActiveSessions() {
  const token = useAuthToken();

  const { data, error, isLoading, mutate } = useSWR(
    token ? `${getBrowserBase()}/api/v1/sessions?active=true` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
      refreshInterval: 10000, // poll every 10s for active sessions
    }
  );

  return {
    sessions: data?.sessions ?? data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}

/** Fetch pricing info */
export function usePricing() {
  const token = useAuthToken();

  const { data, error, isLoading } = useSWR(
    token ? `${getBrowserBase()}/api/v1/pricing` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: false,
      dedupingInterval: 60000, // pricing doesn't change often
    }
  );

  return {
    pricing: data,
    pricePerHour: data?.price_per_hour ?? 10000,
    pricePerMinute: data?.price_per_minute ?? Math.ceil((data?.price_per_hour ?? 10000) / 60),
    isLoading,
    error,
  };
}

/** Fetch single session status (for session viewer page) */
export function useSessionStatus(sessionId) {
  const token = useAuthToken();

  const { data, error, isLoading, mutate } = useSWR(
    token && sessionId
      ? `${getBrowserBase()}/api/v1/sessions/${encodeURIComponent(sessionId)}`
      : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
      refreshInterval: 5000, // poll frequently for active session
    }
  );

  return {
    session: data?.session ?? data,
    isLoading,
    error,
    mutate,
  };
}
