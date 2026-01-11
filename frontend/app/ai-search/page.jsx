"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getApiBase } from "@/lib/api";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";

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
      <div className="mb-8 text-center section-enter">
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          AI Search
        </h1>
        <p className="text-sm text-muted-foreground">
          Cari thread dengan kata kunci, lalu pilih thread untuk mendapatkan penjelasan AI.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          className="flex-1 border border-border bg-card rounded-lg px-4 py-3 outline-none text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20 transition-all shadow-sm"
          placeholder="Ketik kata kunci pencarian..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={explaining}
        />
        <button
          type="submit"
          disabled={!query.trim() || searching || explaining}
          className="rounded-lg px-6 py-3 bg-primary text-white font-medium disabled:opacity-50 hover:opacity-90 transition-all shadow-sm hover:shadow"
        >
          {searching ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Mencari...
            </span>
          ) : "Cari"}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-4 text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* STEP 2: AI Explanation View */}
      {selectedThread && (
        <div className="space-y-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke hasil pencarian
          </button>

          <div className="border border-border bg-card rounded-lg overflow-hidden">
            {/* Thread Header */}
            <div className="border-b border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg text-foreground line-clamp-2">
                    {selectedThread.title}
                  </h2>
                  {selectedThread.category && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                      {selectedThread.category}
                    </span>
                  )}
                </div>
                <Link
                  href={`/thread/${selectedThread.id}`}
                  className="shrink-0 text-sm text-primary hover:underline"
                >
                  Buka Thread →
                </Link>
              </div>
              {selectedThread.summary && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                  {selectedThread.summary}
                </p>
              )}
            </div>

            {/* AI Explanation */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h3 className="font-medium text-foreground">Penjelasan AI</h3>
              </div>

              {explaining ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="thinking-dots flex gap-1 mt-1">
                      <div className="thinking-dot bg-primary" style={{ '--i': 0 }}></div>
                      <div className="thinking-dot bg-primary" style={{ '--i': 1 }}></div>
                      <div className="thinking-dot bg-primary" style={{ '--i': 2 }}></div>
                    </div>
                    <p className="text-sm text-muted-foreground">AI sedang berpikir...</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted/50 rounded animate-pulse w-full"/>
                    <div className="h-4 bg-muted/50 rounded animate-pulse w-5/6"/>
                    <div className="h-4 bg-muted/50 rounded animate-pulse w-4/6"/>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-foreground">
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
            <h2 className="font-medium text-foreground">
              Hasil Pencarian
            </h2>
            <span className="text-sm text-muted-foreground">
              {threads.length} thread{hasMore && "+"}
            </span>
          </div>

          <div className="space-y-2">
            {threads.map((t) => (
              <div
                key={t.id}
                className="border border-border bg-card rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground line-clamp-2">
                      {t.title}
                    </h3>
                    {t.summary && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {t.summary}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {t.category && (
                        <span className="px-2 py-0.5 rounded-full bg-muted/50">
                          {t.category}
                        </span>
                      )}
                      <span>Relevance: {(t.score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-border">
                  <button
                    onClick={() => handleExplain(t)}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <span>🤖</span>
                    Jelaskan dengan AI
                  </button>
                  <Link
                    href={`/thread/${t.id}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Memuat lebih banyak...
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Scroll untuk memuat lebih banyak</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State - No Results */}
      {!selectedThread && !searching && query && threads.length === 0 && (
        <EmptyState
          variant="search"
          title="Tidak ada hasil"
          description="Coba kata kunci yang berbeda atau lebih umum untuk menemukan thread yang relevan."
        />
      )}

      {/* Initial State - No Search Yet */}
      {!selectedThread && !searching && !query && threads.length === 0 && (
        <EmptyState
          variant="default"
          icon={
            <div className="empty-state-icon text-primary/50">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
          }
          title="Mulai Pencarian AI"
          description="Ketik kata kunci untuk mencari thread, lalu pilih thread yang ingin dijelaskan oleh AI."
        />
      )}
    </div>
  );
}
