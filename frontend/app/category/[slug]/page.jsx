"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { LOCKED_CATEGORIES } from "@/lib/constants";
import ThreadCard, { ThreadCardSkeleton } from "@/components/ui/ThreadCard";
import EmptyState from "@/components/ui/EmptyState";

export default function CategoryThreadsPage() {
  const params = useParams();
  const [threads, setThreads] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const API = getApiBase();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/threads/category/${params.slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setThreads(data.threads || []);
        setCategory(data.category || null);
      })
      .finally(() => setLoading(false));
  }, [API, params.slug]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header - with skeleton loading */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          {loading ? (
            <>
              {/* Skeleton for title */}
              <div className="h-7 w-48 animate-pulse rounded bg-border" />
              {/* Skeleton for description */}
              <div className="mt-2 h-4 w-72 animate-pulse rounded bg-border" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">
                {category?.name || String(params.slug || "").replace(/-/g, " ")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {category?.description || "Diskusi dan thread terbaru di kategori ini."}
              </p>
              {!loading && threads.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {threads.length} thread{threads.length !== 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>

{!LOCKED_CATEGORIES.includes(params.slug) ? (
          <Link
            href={`/category/${params.slug}/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat Thread
          </Link>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed" title="Kategori ini sementara ditutup untuk thread baru">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Kategori Terkunci
          </div>
        )}
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <ThreadCardSkeleton key={i} variant="list" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <EmptyState
          variant="content"
          title="Belum ada thread di kategori ini"
          description="Jadilah yang pertama untuk memulai diskusi di kategori ini."
          action={
            !LOCKED_CATEGORIES.includes(params.slug) && (
              <Link
                href={`/category/${params.slug}/new`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Buat Thread Pertama
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              variant="default"
              showCategory={false}
            />
          ))}
        </div>
      )}
    </main>
  );
}
