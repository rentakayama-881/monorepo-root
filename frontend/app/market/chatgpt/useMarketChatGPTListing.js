"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { getApiBase } from "@/lib/api";
import { extractList } from "@/lib/apiHelpers";
import { MARKET_PAGE_SIZE, parseApiResponseSafe, toDisplayAccount } from "./marketChatGPTUtils";

const LISTING_REFRESH_INTERVAL_MS = 60_000;

export default function useMarketChatGPTListing() {
  const [loading, setLoading] = useState(true);
  const [listingError, setListingError] = useState("");
  const [refreshingListings, setRefreshingListings] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [page, setPage] = useState(1);
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

  // Initial load + periodic refresh
  useEffect(() => {
    void loadListings({ initial: true });

    const timer = setInterval(() => {
      void loadListings({ initial: false, silent: true });
    }, LISTING_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [loadListings]);

  // Re-fetch when user returns to the tab
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
      `${item.title} ${item.displayPriceIDR} ${item.status} ${item.seller} ${item.uploadedAtLabel}`
        .toLowerCase()
        .includes(term)
    );
  }, [accounts, deferredQuery]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery]);

  useEffect(() => {
    setPage((current) => {
      const totalPages = Math.max(1, Math.ceil(filtered.length / MARKET_PAGE_SIZE));
      return Math.min(current, totalPages);
    });
  }, [filtered.length]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / MARKET_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStartIndex = totalItems === 0 ? 0 : (currentPage - 1) * MARKET_PAGE_SIZE;

  const paginatedItems = useMemo(() => {
    return filtered.slice(pageStartIndex, pageStartIndex + MARKET_PAGE_SIZE);
  }, [filtered, pageStartIndex]);

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
    currentPage,
    totalPages,
    totalItems,
    pageStartIndex,
    paginatedItems,
    placeholderCount: Math.max(0, MARKET_PAGE_SIZE - paginatedItems.length),
    displayStart: totalItems === 0 ? 0 : pageStartIndex + 1,
    displayEnd: Math.min(totalItems, pageStartIndex + paginatedItems.length),
    setPage,
    refreshListings,
  };
}
