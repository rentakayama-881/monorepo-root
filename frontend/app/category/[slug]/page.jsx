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
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setThreads(data.threads || []))
      .finally(() => setLoading(false));
  }, [API, params.slug]);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold capitalize tracking-tight text-neutral-900">
            {params.slug.replace(/-/g, " ")}
          </h1>
          <p className="mt-2 text-base text-neutral-700">
            Diskusi dan thread terbaru di kategori ini. Temukan insight, relasi, dan peluang baru.
          </p>
        </div>
        <Link
          href={`/category/${params.slug}/new`}
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          + Buat Thread
        </Link>
      </header>
      {loading ? (
        <div className="py-10 text-center text-neutral-600">Memuat thread...</div>
      ) : threads.length === 0 ? (
        <div className="py-10 text-center text-neutral-500">Belum ada thread di kategori ini.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {threads.map(thread => (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              className="flex flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-sm hover:bg-neutral-50"
            >
              <h2 className="text-lg font-semibold leading-snug text-neutral-900">{thread.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{thread.summary}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-neutral-600">
                <span>Dibuat oleh</span>
                <Link
                  href={`/user/${thread.username}`}
                  className="font-medium text-neutral-900 underline"
                  onClick={e => e.stopPropagation()}
                >
                  @{thread.username}
                </Link>
                <span>•</span>
                <span>
                  {new Date(thread.created_at * 1000)
                    .toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
