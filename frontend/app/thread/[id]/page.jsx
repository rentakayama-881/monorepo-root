"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ThreadDetailPage({ params }) {
  const { id } = params;
  const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAuthed = typeof window !== "undefined" ? !!localStorage.getItem("token") : false;

  useEffect(() => {
    if (!isAuthed) {
      setError("Anda harus login untuk melihat thread.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const token = localStorage.getItem("token");

    fetch(`${API}/api/threads/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error("Gagal membaca thread"))))
      .then(json => !cancelled && setData(json))
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [API, id, isAuthed]);

  if (!isAuthed) return <div className="text-sm text-red-600">{error || "Anda harus login untuk melihat thread."}</div>;

  return (
    <section className="max-w-4xl mx-auto py-12 px-4">
      {loading ? (
        <div className="text-sm">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : data ? (
        <div className="border rounded-xl bg-white shadow-md p-8">
          {/* Judul thread */}
          <h1 className="text-3xl font-bold text-black mb-3">{data.title}</h1>
          {/* Info thread */}
          <div className="flex flex-wrap items-center gap-5 text-sm text-neutral-500 mb-5">
            <span>{formatDate(data.created_at)}</span>
            <span>•</span>
            <span>
              Kategori:{" "}
              <Link href={`/category/${encodeURIComponent(data.category?.slug || "")}`} className="underline hover:text-blue-700">
                {data.category?.name || data.category?.slug}
              </Link>
            </span>
            <span>•</span>
            <span>
              Oleh:{" "}
              <Link href={`/user/${encodeURIComponent(data.user?.username || "")}`} className="underline hover:text-blue-700">
                {data.user?.username}
              </Link>
            </span>
          </div>
          {/* Gambar utama */}
          {data.meta?.image && (
            <div className="my-6">
              <img
                src={data.meta.image}
                alt="Gambar Thread"
                className="rounded-lg w-full max-h-[420px] object-cover border"
                style={{ background: "#f7f7f7" }}
              />
            </div>
          )}
          {/* Ringkasan */}
          {data.summary && (
            <p className="text-lg leading-relaxed text-neutral-800 mb-6">{data.summary}</p>
          )}
          {/* Konten utama */}
          <article>
            {data.content_type === "text" ? (
              <div className="prose prose-neutral max-w-none text-base leading-relaxed mb-8" style={{ whiteSpace: "pre-wrap" }}>
                {typeof data.content === "string"
                  ? data.content
                  : (data.content && JSON.stringify(data.content, null, 2)) || "Tidak ada konten."}
              </div>
            ) : (
              <ContentTable content={data.content} />
            )}
          </article>
          {/* Telegram Contact */}
          {data.meta?.telegram && (
            <div className="mt-8 flex items-center gap-2 text-base">
              <span className="font-medium">Contact Telegram:</span>
              <a
                href={`https://t.me/${data.meta.telegram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-700 hover:text-blue-900"
              >
                {data.meta.telegram}
              </a>
            </div>
          )}
          {/* Aksi navigasi */}
          <div className="mt-10 flex gap-4">
            <Link href={`/threads`} className="px-5 py-2 rounded bg-neutral-100 text-black font-medium hover:bg-neutral-200 transition">
              ← Kembali ke Threads
            </Link>
            <Link href={`/category/${encodeURIComponent(data.category?.slug || "")}`} className="px-5 py-2 rounded bg-black text-white font-medium hover:bg-neutral-900 transition">
              Lihat Kategori
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ContentTable({ content }) {
  if (!content) return <div className="text-sm text-neutral-600">Tidak ada konten.</div>;
  let rows = [];
  if (Array.isArray(content?.rows)) rows = content.rows;
  else if (Array.isArray(content?.sections)) {
    return (
      <div className="space-y-4">
        {content.sections.map((sec, idx) => (
          <div key={idx}>
            {sec.title && <h3 className="font-medium mb-2">{sec.title}</h3>}
            <Table rows={sec.rows || []} />
          </div>
        ))}
      </div>
    );
  } else if (typeof content === "object") {
    rows = Object.entries(content).map(([label, value]) => ({ label, value }));
  }
  if (!rows.length) return <div className="text-sm text-neutral-600">Tidak ada konten.</div>;
  return <Table rows={rows} />;
}

function Table({ rows }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full bg-white text-sm border border-neutral-200 rounded shadow-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-neutral-50" : "bg-white"}>
              <td className="align-top p-2 w-40 font-semibold border-b border-neutral-100">{r.label}</td>
              <td className="align-top p-2 border-b border-neutral-100">{renderValue(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderValue(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return (
      <ul className="list-disc pl-4">
        {v.map((x, i) => (
          <li key={i}>{String(x)}</li>
        ))}
      </ul>
    );
  if (typeof v === "object") return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>;
  return String(v);
}

function formatDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return "";
  }
}
