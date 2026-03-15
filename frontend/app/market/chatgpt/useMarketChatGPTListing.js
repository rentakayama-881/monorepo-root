"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { getApiBase } from "@/lib/api";
import { extractList } from "@/lib/apiHelpers";
import { parseApiResponseSafe, toDisplayAccount } from "./marketChatGPTUtils";

const LISTING_REFRESH_INTERVAL_MS = 60_000;

export default function useMarketChatGPTListing() {
  const [loading, setLoading] = useState(true);
  const [listingError, setListingError] = useState("");
  const [refreshingListings, setRefreshingListings] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const isMountedRef = useRef(false);
  const apiBase = useMemo(() => getApiBase(), []);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadListings = useCallback(
    async ({ initial = false, silent = false } = {}) => {
      if (initial && isMountedRef.current) {
        setLoading(true);
      }
      if (!initial && !silent && isMountedRef.current) {
        setRefreshingListings(true);
      }

      try {
        const res = await fetch(`${apiBase}/api/market/chatgpt?i18n=en-US&ts=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await parseApiResponseSafe(res);
        if (!res.ok) throw new Error(data?.error || "Gagal memuat daftar akun.");

        if (isMountedRef.current) {
          setResponse(data);
          setListingError("");
          setLastFetchedAt(Date.now());
        }
        return { ok: true };
      } catch (err) {
        const nextError = err?.message || "Gagal memuat daftar akun.";
        if (isMountedRef.current && (initial || !silent)) {
          setListingError(nextError);
        }
        return { ok: false, error: nextError };
      } finally {
        if (isMountedRef.current) {
          if (initial) setLoading(false);
          setRefreshingListings(false);
        }
      }
    },
    [apiBase]
  );

  useEffect(() => {
    void loadListings({ initial: true });

    const timer = setInterval(() => {
      void loadListings({ initial: false, silent: true });
    }, LISTING_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [loadListings]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isMountedRef.current) {
        void loadListings({ initial: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadListings]);

  const accounts = useMemo(() => {
    const list = extractList(response?.json);
    return list.map(toDisplayAccount);
  }, [response]);

  const filtered = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((item) =>
      `${item.title} ${item.displayPriceIDR} ${item.subscription} ${item.seller} ${item.uploadedAtLabel}`
        .toLowerCase()
        .includes(term)
    );
  }, [accounts, deferredQuery]);

  const providerTotalItems = useMemo(() => {
    const json = response?.json;
    if (!json || typeof json !== "object") return 0;
    return json.provider_total_items || json.totalItems || json.total_items || 0;
  }, [response]);

  const refreshListings = useCallback(async () => {
    const result = await loadListings({ initial: false, silent: false });
    return result;
  }, [loadListings]);

  return {
    loading,
    listingError,
    refreshingListings,
    query,
    setQuery,
    response,
    items: filtered,
    totalItems: filtered.length,
    allItemsCount: accounts.length,
    providerTotalItems,
    refreshListings,
    lastFetchedAt,
  };
}
