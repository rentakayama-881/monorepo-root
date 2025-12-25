"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";

export default function CategoryThreadsPage() {
  const params = useParams();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const API = getApiBase();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/threads/category/${params.slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setThreads(data.threads || []))
      .finally(() => setLoading(false));
  }, [API, params.slug]);

  const title = String(params.slug || "").replace(/-/g, " ");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold capitalize text-[rgb(var(--fg))]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Diskusi dan thread terbaru di kategori ini.
          </p>
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
              className={`flex items-start gap-4 p-4 transition-colors hover:bg-[rgb(var(--surface-2))] ${idx !== threads.length - 1 ? "border-b border-[rgb(var(--border))]" : ""}`}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--brand))] bg-opacity-10">
                <svg className="h-4 w-4 text-[rgb(var(--brand))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
