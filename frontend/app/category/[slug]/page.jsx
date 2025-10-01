"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function CategoryThreadsPage() {
  const params = useParams();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/threads/category/${params.slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setThreads(data.threads || []))
      .finally(() => setLoading(false));
  }, [API, params.slug]);

  return (
    <section className="max-w-6xl mx-auto w-full py-10 px-4">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold capitalize text-black tracking-tight">
            {params.slug.replace(/-/g, " ")}
          </h1>
          <p className="text-neutral-600 text-base mt-2">
            Diskusi dan thread terbaru di kategori ini. Temukan insight, relasi, dan peluang baru.
          </p>
        </div>
        <Link
          href={`/category/${params.slug}/new`}
          className="inline-block px-6 py-2 rounded-lg bg-black text-white font-semibold shadow hover:bg-neutral-900 transition"
        >
          + Buat Thread
        </Link>
      </header>
      {loading ? (
        <div className="text-center py-10 text-neutral-500">Memuat thread...</div>
      ) : threads.length === 0 ? (
        <div className="text-center py-10 text-neutral-400">Belum ada thread di kategori ini.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {threads.map(thread => (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              className="group border rounded-2xl bg-white p-6 flex flex-col shadow hover:shadow-xl transition-all"
            >
              <h2 className="font-semibold text-xl group-hover:text-blue-700 line-clamp-2 text-black">{thread.title}</h2>
              <p className="text-neutral-700 text-base mt-3 line-clamp-3">{thread.summary}</p>
              <div className="flex items-center gap-2 text-xs mt-4 text-neutral-500">
                <span>Dibuat oleh</span>
                <Link
                  href={`/user/${thread.username}`}
                  className="underline font-medium group-hover:text-blue-700"
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
