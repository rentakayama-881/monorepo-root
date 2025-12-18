"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation"; // <--- PERUBAHAN 1: Import useParams
import { getApiBase } from "@/lib/api";

export default function ThreadDetailPage() { // <--- PERUBAHAN 2: Hapus props params
  const params = useParams(); // <--- PERUBAHAN 3: Pakai hook
  
  // Pastikan id diambil dengan aman (unwrap)
  const id = params?.id; 

  const API = getApiBase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAuthed = typeof window !== "undefined" ? !!localStorage.getItem("token") : false;

  useEffect(() => {
    // Cek Login
    if (!isAuthed) {
      setError("Anda harus login untuk melihat thread.");
      setLoading(false);
      return;
    }

    // --- PERUBAHAN 4: PENTING! ---
    // Jangan fetch kalau ID belum ada atau masih undefined
    if (!id || id === 'undefined') {
        return;
    }

    let cancelled = false;
    const token = localStorage.getItem("token");

    setLoading(true); // Set loading true saat mulai fetch

    fetch(`${API}/api/threads/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error("Gagal membaca thread"))))
      .then(json => !cancelled && setData(json))
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [API, id, isAuthed]);

  if (!isAuthed) return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-800">
      <div className="font-medium">Anda harus login untuk melihat thread.</div>
      <Link href="/login" className="text-sm font-medium text-neutral-900 underline">Masuk sekarang</Link>
    </div>
  );

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      {loading ? (
        <div className="text-sm">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : data ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-7 shadow-sm">
          {/* Judul thread */}
          <h1 className="mb-3 text-2xl font-semibold text-neutral-900">{data.title}</h1>
          {/* Info thread */}
          <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-neutral-600">
            <span>{formatDate(data.created_at)}</span>
            <span>•</span>
            <span>
              Kategori:{" "}
              <Link href={`/category/${encodeURIComponent(data.category?.slug || "")}`} className="font-medium text-neutral-900 underline">
                {data.category?.name || data.category?.slug}
              </Link>
            </span>
            <span>•</span>
            <span>
              Oleh:{" "}
              <Link href={`/user/${encodeURIComponent(data.user?.username || "")}`} className="font-medium text-neutral-900 underline">
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
                className="w-full max-h-[420px] rounded-md border border-neutral-200 object-cover"
              />
            </div>
          )}
          {/* Ringkasan */}
          {data.summary && (
            <p className="mb-6 text-base leading-relaxed text-neutral-800">{data.summary}</p>
          )}
          {/* Konten utama */}
          <article>
            {data.content_type === "text" ? (
              <div className="mb-8 whitespace-pre-wrap text-base leading-relaxed text-neutral-900">
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
            <div className="mt-8 flex items-center gap-2 text-base text-neutral-800">
              <span className="font-medium text-neutral-900">Contact Telegram:</span>
              <a
                href={`https://t.me/${data.meta.telegram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-900 underline"
              >
                {data.meta.telegram}
              </a>
            </div>
          )}
          {/* Aksi navigasi */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/threads`} className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100">
              ← Kembali ke Threads
            </Link>
            <Link href={`/category/${encodeURIComponent(data.category?.slug || "")}`} className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
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
      <table className="w-full rounded-md border border-neutral-200 bg-white text-sm shadow-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-neutral-50" : "bg-white"}>
              <td className="w-40 align-top border-b border-neutral-100 p-2 font-semibold text-neutral-900">{r.label}</td>
              <td className="align-top border-b border-neutral-100 p-2 text-neutral-800">{renderValue(r.value)}</td>
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

