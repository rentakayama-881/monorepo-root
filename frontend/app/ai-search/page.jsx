"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getApiBase } from "@/lib/api";
import Link from "next/link";

export default function AISearchPage() {
  const API_BASE = getApiBase();

  // Step 1: Search state
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState([]);
  const [searching, setSearching] = useState(false);
  const [nextCursor, setNextCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Step 2: Explain state
  const [selectedThread, setSelectedThread] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);

  const [error, setError] = useState("");
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // STEP 1: Search threads
  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError("");
    setThreads([]);
    setSelectedThread(null);
    setExplanation("");
    setNextCursor(0);
    setHasMore(false);

    try {
      const url = new URL("/api/rag/search-threads", API_BASE);
      url.searchParams.set("q", query);
      url.searchParams.set("cursor", "0");
      url.searchParams.set("limit", "20");

      const res = await fetch(url.toString());
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setThreads(data.threads || []);
      setNextCursor(data.next_cursor || 0);
      setHasMore(data.has_more || false);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan saat mencari");
    } finally {
      setSearching(false);
    }
  }

  // Load more for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !query.trim()) return;

    setLoadingMore(true);
    try {
      const url = new URL("/api/rag/search-threads", API_BASE);
      url.searchParams.set("q", query);
      url.searchParams.set("cursor", String(nextCursor));
      url.searchParams.set("limit", "20");

      const res = await fetch(url.toString());
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setThreads((prev) => [...prev, ...(data.threads || [])]);
      setNextCursor(data.next_cursor || 0);
      setHasMore(data.has_more || false);
    } catch (err) {
      setError(err.message || "Gagal memuat lebih banyak hasil");
    } finally {
      setLoadingMore(false);
    }
  }, [API_BASE, query, nextCursor, hasMore, loadingMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || selectedThread) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore, selectedThread]);

  // STEP 2: Get AI explanation for selected thread
  async function handleExplain(thread) {
    setSelectedThread(thread);
    setExplaining(true);
    setError("");
    setExplanation("");

    try {
      const res = await fetch(`${API_BASE}/api/rag/explain/${thread.id}`);
      
      if (res.status === 429) {
        throw new Error("Terlalu banyak permintaan AI. Silakan tunggu 1 menit.");
      }
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setExplanation(data.explanation || "Tidak ada penjelasan tersedia.");
    } catch (err) {
      setError(err.message || "Gagal mendapatkan penjelasan AI");
    } finally {
      setExplaining(false);
    }
  }

  // Go back to search results
  function handleBack() {
    setSelectedThread(null);
    setExplanation("");
    setError("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2 text-[rgb(var(--fg))]">
        AI Search
      </h1>
      <p className="text-sm text-[rgb(var(--muted))] mb-6">
        Cari thread dengan kata kunci, lalu pilih thread untuk mendapatkan penjelasan AI.
      </p>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          className="flex-1 border border-[rgb(var(--border))] bg-[rgb(var(--surface))] rounded-lg px-4 py-2.5 outline-none text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--brand))] focus:ring-1 focus:ring-[rgb(var(--brand))]"
          placeholder="Ketik kata kunci pencarian..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={explaining}
        />
        <button
          type="submit"
          disabled={!query.trim() || searching || explaining}
          className="rounded-lg px-5 py-2.5 bg-[rgb(var(--brand))] text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {searching ? "Mencari..." : "Cari"}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-4 text-sm text-[rgb(var(--error))] border border-[rgb(var(--error))]/30 bg-[rgb(var(--error))]/10 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* STEP 2: AI Explanation View */}
      {selectedThread && (
        <div className="space-y-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke hasil pencarian
          </button>

          <div className="border border-[rgb(var(--border))] bg-[rgb(var(--surface))] rounded-lg overflow-hidden">
            {/* Thread Header */}
            <div className="border-b border-[rgb(var(--border))] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg text-[rgb(var(--fg))] line-clamp-2">
                    {selectedThread.title}
                  </h2>
                  {selectedThread.category && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]">
                      {selectedThread.category}
                    </span>
                  )}
                </div>
                <Link
                  href={`/thread/${selectedThread.id}`}
                  className="shrink-0 text-sm text-[rgb(var(--brand))] hover:underline"
                >
                  Buka Thread →
                </Link>
              </div>
              {selectedThread.summary && (
                <p className="mt-3 text-sm text-[rgb(var(--muted))] line-clamp-3">
                  {selectedThread.summary}
                </p>
              )}
            </div>

            {/* AI Explanation */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h3 className="font-medium text-[rgb(var(--fg))]">Penjelasan AI</h3>
              </div>

              {explaining ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted))]">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Generating AI explanation...
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-[rgb(var(--surface-2))] rounded animate-pulse w-full"/>
                    <div className="h-4 bg-[rgb(var(--surface-2))] rounded animate-pulse w-5/6"/>
                    <div className="h-4 bg-[rgb(var(--surface-2))] rounded animate-pulse w-4/6"/>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-[rgb(var(--fg))]">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {explanation}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: Thread List */}
      {!selectedThread && threads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-[rgb(var(--fg))]">
              Hasil Pencarian
            </h2>
            <span className="text-sm text-[rgb(var(--muted))]">
              {threads.length} thread{hasMore && "+"}
            </span>
          </div>

          <div className="space-y-2">
            {threads.map((t) => (
              <div
                key={t.id}
                className="border border-[rgb(var(--border))] bg-[rgb(var(--surface))] rounded-lg p-4 hover:border-[rgb(var(--brand))]/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[rgb(var(--fg))] line-clamp-2">
                      {t.title}
                    </h3>
                    {t.summary && (
                      <p className="mt-1 text-sm text-[rgb(var(--muted))] line-clamp-2">
                        {t.summary}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
                      {t.category && (
                        <span className="px-2 py-0.5 rounded-full bg-[rgb(var(--surface-2))]">
                          {t.category}
                        </span>
                      )}
                      <span>Relevance: {(t.score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-[rgb(var(--border))]">
                  <button
                    onClick={() => handleExplain(t)}
                    className="flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--brand))] hover:underline"
                  >
                    <span>🤖</span>
                    Jelaskan dengan AI
                  </button>
                  <Link
                    href={`/thread/${t.id}`}
                    className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"
                  >
                    Lihat Thread →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Trigger for Infinite Scroll */}
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted))]">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Memuat lebih banyak...
                </div>
              ) : (
                <span className="text-sm text-[rgb(var(--muted))]">Scroll untuk memuat lebih banyak</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedThread && !searching && query && threads.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-medium text-[rgb(var(--fg))] mb-1">Tidak ada hasil</h3>
          <p className="text-sm text-[rgb(var(--muted))]">
            Coba kata kunci yang berbeda atau lebih umum
          </p>
        </div>
      )}

      {/* Initial State */}
      {!selectedThread && !searching && !query && threads.length === 0 && (
        <div className="text-center py-12 border border-dashed border-[rgb(var(--border))] rounded-lg">
          <div className="text-4xl mb-3">🔎</div>
          <h3 className="font-medium text-[rgb(var(--fg))] mb-1">Mulai Pencarian</h3>
          <p className="text-sm text-[rgb(var(--muted))] max-w-md mx-auto">
            Ketik kata kunci untuk mencari thread, lalu pilih thread yang ingin dijelaskan oleh AI.
          </p>
        </div>
      )}
    </div>
  );
}
