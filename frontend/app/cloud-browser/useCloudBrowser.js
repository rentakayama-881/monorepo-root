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
// Service base URLs
// ---------------------------------------------------------------------------

function getBrowserBase() {
  return process.env.NEXT_PUBLIC_BROWSER_API_URL || "https://browser.aivalid.id";
}

function getFeatureBase() {
  return process.env.NEXT_PUBLIC_FEATURE_API_URL || "https://feature.aivalid.id";
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all browser profiles for current user (→ Feature Service) */
export function useProfiles() {
  const token = useAuthToken();

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    token ? `${getFeatureBase()}/api/v1/browser/profiles` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
    }
  );

  return {
    profiles: data?.data?.profiles ?? data?.profiles ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/** Fetch active sessions (→ Feature Service) */
export function useActiveSessions() {
  const token = useAuthToken();

  const { data, error, isLoading, mutate } = useSWR(
    token ? `${getFeatureBase()}/api/v1/browser/sessions?active=true` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
      refreshInterval: 10000,
    }
  );

  return {
    sessions: data?.data?.sessions ?? data?.sessions ?? [],
    isLoading,
    error,
    mutate,
  };
}

/** Fetch pricing info (→ Feature Service) */
export function usePricing() {
  const token = useAuthToken();

  const { data, error, isLoading } = useSWR(
    token ? `${getFeatureBase()}/api/v1/browser/sessions/pricing` : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const pricing = data?.data ?? data;
  const perHour = pricing?.pricePerHourIdr ?? pricing?.price_per_hour ?? 10000;

  return {
    pricing,
    pricePerHour: perHour,
    pricePerMinute: Math.ceil(perHour / 60),
    isLoading,
    error,
  };
}

/** Fetch single session status (→ Browser Service) */
export function useSessionStatus(sessionId) {
  const token = useAuthToken();

  const { data, error, isLoading, mutate } = useSWR(
    token && sessionId
      ? `${getBrowserBase()}/api/v1/sessions/${encodeURIComponent(sessionId)}/status`
      : null,
    authFetcher,
    {
      ...swrConfig,
      revalidateOnFocus: true,
      refreshInterval: 5000,
    }
  );

  return {
    session: data?.session ?? data,
    isLoading,
    error,
    mutate,
  };
}
