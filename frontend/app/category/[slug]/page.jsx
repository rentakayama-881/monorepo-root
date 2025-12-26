"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";

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
              <div className="h-7 w-48 animate-pulse rounded bg-[rgb(var(--border))]" />
              {/* Skeleton for description */}
              <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[rgb(var(--border))]" />
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">
                {category?.name || String(params.slug || "").replace(/-/g, " ")}
              </h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                {category?.description || "Diskusi dan thread terbaru di kategori ini."}
              </p>
            </>
          )}
        </div>

        <Link
          href={`/category/${params.slug}/new`}
          className="inline-flex items-center gap-2 rounded-md bg-[rgb(var(--brand))] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Buat Thread
        </Link>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center">
          <p className="text-sm text-[rgb(var(--muted))]">Belum ada thread di kategori ini.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          {threads.map((thread, idx) => (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              className={`block p-4 transition-colors hover:bg-[rgb(var(--surface-2))] ${idx !== threads.length - 1 ? "border-b border-[rgb(var(--border))]" : ""}`}
            >
              <h2 className="text-base font-semibold text-[rgb(var(--fg))] hover:text-[rgb(var(--brand))]">
                {thread.title}
              </h2>

              {thread.summary && (
                <p className="mt-1 line-clamp-2 text-sm text-[rgb(var(--muted))]">
                  {thread.summary}
                </p>
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                <span>@{thread.username}</span>
                <span>•</span>
                <span>
                  {new Date(thread.created_at * 1000).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
