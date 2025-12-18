"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/api";

export default function MyThreadsPage() {
  const API = `${getApiBase()}/api`;
  const authed = useMemo(() => {
    try { return !!localStorage.getItem("token"); } catch { return false; }
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [threads, setThreads] = useState([]);

  // editor state
  const [editingId, setEditingId] = useState(null);
  const [originalType, setOriginalType] = useState("text"); // disimpan diam-diam
  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    image: "",
    telegram: "",
  });
  const [saving, setSaving] = useState(false);

  const reloadMyThreads = useCallback(async () => {
    const t = localStorage.getItem("token");
    const r = await fetch(`${API}/threads/me`, { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) throw new Error("Gagal memuat threads");
    const data = await r.json();
    const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
    list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    setThreads(list);
  }, [API]);

  useEffect(() => {
    if (!authed) {
      setLoading(false);
      setError("Anda harus login untuk melihat threads Anda.");
      return;
    }
    let cancelled = false;
    (async () => {
      try { setLoading(true); setError(""); await reloadMyThreads(); }
      catch (e) { if (!cancelled) setError(e.message || String(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [API, authed, reloadMyThreads]);

  function startEdit(th) {
    setOk(""); setError(""); setEditingId(th.id);
    // Prefill dari detail agar persis sama dengan data aslinya
    (async () => {
      try {
        const t = localStorage.getItem("token");
        const res = await fetch(`${API}/threads/${th.id}`, { headers: { Authorization: `Bearer ${t}` } });
        if (!res.ok) throw new Error("Gagal memuat detail thread");
        const full = await res.json();

        // simpan tipe asli (disembunyikan di UI)
        const ctype = (full.content_type || "text").toLowerCase();
        setOriginalType(ctype);

        // isi konten sebagai teks untuk diedit (kalau json → stringify cantik)
        const contentText =
          ctype === "text"
            ? (typeof full.content === "string" ? full.content : (full.content ? JSON.stringify(full.content, null, 2) : ""))
            : (full.content ? JSON.stringify(full.content, null, 2) : "");

        setForm({
          title: full.title || "",
          summary: full.summary || "",
          content: contentText,
          image: (full.meta && (full.meta.image || full.meta.image_url)) || "",
          telegram: ((full.meta && full.meta.telegram) || "").replace(/^@/, ""),
        });
      } catch (e) {
        setError(String(e.message || e));
      }
    })();
  }

  function cancelEdit() {
    setEditingId(null);
    setOriginalType("text");
    setForm({ title: "", summary: "", content: "", image: "", telegram: "" });
  }

  async function saveEdit(id) {
    setSaving(true); setOk(""); setError("");
    try {
      const t = localStorage.getItem("token");

      // bentuk body sesuai form create (tanpa field "tipe konten")
      // tapi saat kirim content, sesuaikan dengan tipe asli:
      // - jika thread aslinya text → kirim string apa adanya
      // - jika thread aslinya json → coba parse ke object (kalau gagal, kirim stringnya)
      let contentToSend;
      if (originalType === "text") {
        contentToSend = form.content;
      } else {
        try { contentToSend = JSON.parse(form.content); }
        catch { contentToSend = form.content; }
      }

      const body = {
        title: form.title,
        summary: form.summary,
        // tidak mengirim content_type → tipe tidak berubah
        content: contentToSend,
        meta: {
          image: form.image || undefined,
          telegram: form.telegram ? `@${form.telegram.replace(/^@/, "")}` : undefined,
        },
      };

      const r = await fetch(`${API}/threads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt || "Gagal menyimpan thread");

      await reloadMyThreads();
      setOk("Thread berhasil diperbarui.");
      setEditingId(null);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (!authed) return <div className="text-sm text-red-600">{error || "Anda harus login untuk melihat threads Anda."}</div>;

  const inputClass =
    "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-800";
  const mutedText = "text-sm text-neutral-600";
  const buttonPrimary =
    "inline-flex items-center justify-center rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60";
  const buttonGhost = "inline-flex items-center justify-center rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900";

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 py-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Threads Saya</h1>

      {loading ? (
        <div className="text-sm">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div className="space-y-3">
          {threads.length === 0 ? (
            <div className={mutedText}>Anda belum memiliki thread.</div>
          ) : (
            threads.map((th) => {
              const catSlug = typeof th.category === "string" ? th.category : th.category?.slug;
              const catName = typeof th.category === "object" ? th.category?.name || th.category?.slug : th.category;
              return (
                <div key={th.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-neutral-900">{th.title || "(Tanpa Judul)"}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                        <span>{formatDate(th.created_at)}</span>
                        {catSlug && (
                          <>
                            <span>•</span>
                            <Link href={`/category/${encodeURIComponent(catSlug)}`} className="font-medium text-neutral-900 underline">
                              {catName}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/thread/${encodeURIComponent(th.id)}`} className="inline-flex items-center rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
                        Lihat
                      </Link>
                      <button onClick={() => startEdit(th)} className="inline-flex items-center rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800">
                        Edit
                      </button>
                    </div>
                  </div>

                  {editingId === th.id && (
                    <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4">
                      {/* Judul Thread */}
                      <div>
                        <label className="text-sm font-medium text-neutral-900">Judul Thread *</label>
                        <div className="mb-1 text-xs text-neutral-600">Masukkan judul yang jelas</div>
                        <input
                          className={inputClass}
                          value={form.title}
                          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>

                      {/* Ringkasan */}
                      <div>
                        <label className="text-sm font-medium text-neutral-900">Ringkasan (optional)</label>
                        <div className="mb-1 text-xs text-neutral-600">Deskripsi singkat / highlight utama thread</div>
                        <textarea
                          rows={3}
                          className={`${inputClass} min-h-[120px]`}
                          value={form.summary}
                          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                        />
                      </div>

                      {/* Konten Thread */}
                      <div>
                        <label className="text-sm font-medium text-neutral-900">Konten Thread *</label>
                        <div className="mb-1 text-xs text-neutral-600">Tuliskan isi thread secara lengkap di sini...</div>
                        <textarea
                          rows={8}
                          className={`${inputClass} font-mono text-sm`}
                          value={form.content}
                          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                        />
                      </div>

                      {/* Gambar & Telegram */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-neutral-900">Gambar (optional)</label>
                          <div className="mb-1 text-xs text-neutral-600">URL gambar (opsional)</div>
                          <input
                            className={inputClass}
                            placeholder="https://..."
                            value={form.image}
                            onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-neutral-900">Contact Telegram *</label>
                          <div className="mb-1 text-xs text-neutral-600">@username</div>
                          <input
                            className={inputClass}
                            placeholder="username"
                            value={form.telegram}
                            onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(th.id)}
                          disabled={saving}
                          className={`${buttonPrimary} disabled:opacity-50`}
                        >
                          {saving ? "Menyimpan..." : "Simpan"}
                        </button>
                        <button onClick={cancelEdit} className={buttonGhost}>
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {ok && <div className="text-sm text-green-700">{ok}</div>}
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "";
  try { return new Date(ts * 1000).toLocaleString(); }
  catch { return ""; }
}
