"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import MarkdownPreview from "@/components/ui/MarkdownPreview";

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
  const [editingThread, setEditingThread] = useState(null);
  const [originalType, setOriginalType] = useState("text");
  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    telegram: "",
  });
  const [saving, setSaving] = useState(false);

  // delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const reloadMyThreads = useCallback(async () => {
    const res = await fetchWithAuth(`${API}/threads/me`);
    if (!res || !res.ok) throw new Error("Gagal memuat threads");
    const data = await res.json();
    const list = Array.isArray(data) ? data : Array.isArray(data.threads) ? data.threads : Array.isArray(data.items) ? data.items : [];
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

  // Auto-refresh when page becomes visible (tab focus)
  useEffect(() => {
    if (!authed) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        reloadMyThreads().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [authed, reloadMyThreads]);

  function startEdit(th) {
    setOk(""); setError(""); setEditingThread(th);
    (async () => {
      try {
        const res = await fetchWithAuth(`${API}/threads/${th.id}`);
        if (!res || !res.ok) throw new Error("Gagal memuat detail thread");
        const full = await res.json();

        const ctype = (full.content_type || "text").toLowerCase();
        setOriginalType(ctype);

        let contentText = "";
        if (ctype === "text") {
          if (typeof full.content === "string") {
            contentText = full.content;
          } else if (full.content && typeof full.content === "object" && typeof full.content.text === "string") {
            // Extract text from {"text": "..."} wrapper
            contentText = full.content.text;
          } else if (full.content) {
            contentText = JSON.stringify(full.content, null, 2);
          }
        } else {
          contentText = full.content ? JSON.stringify(full.content, null, 2) : "";
        }

        setForm({
          title: full.title || "",
          summary: full.summary || "",
          content: contentText,
          telegram: ((full.meta && full.meta.telegram) || "").replace(/^@/, ""),
        });
      } catch (e) {
        setError(String(e.message || e));
        setEditingThread(null);
      }
    })();
  }

  function cancelEdit() {
    setEditingThread(null);
    setOriginalType("text");
    setForm({ title: "", summary: "", content: "", telegram: "" });
  }

  async function saveEdit(id) {
    setSaving(true); setOk(""); setError("");
    try {
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
        content: contentToSend,
        meta: {
          telegram: form.telegram ? `@${form.telegram.replace(/^@/, "")}` : undefined,
        },
      };

      const r = await fetchWithAuth(`${API}/threads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r || !r.ok) {
        const txt = r ? await r.text() : "Request failed";
        throw new Error(txt || "Gagal menyimpan thread");
      }

      await reloadMyThreads();
      setOk("Thread berhasil diperbarui.");
      setEditingThread(null);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  // Delete thread handler
  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true); setOk(""); setError("");
    try {
      const res = await fetchWithAuth(`${API}/threads/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      if (!res || !res.ok) {
        const txt = res ? await res.text() : "Request failed";
        throw new Error(txt || "Gagal menghapus thread");
      }
      await reloadMyThreads();
      setOk("Thread berhasil dihapus.");
      setDeleteConfirm(null);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setDeleting(false);
    }
  }

  // Close modal on escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        cancelEdit();
        setDeleteConfirm(null);
      }
    };
    if (editingThread || deleteConfirm) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editingThread, deleteConfirm]);

  if (!authed) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error || "Anda harus login untuk melihat threads Anda."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">My Threads</h1>
        <span className="rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {threads.length} threads
        </span>
      </div>

      {/* Status messages */}
      {ok && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-600">
          {ok}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Anda belum memiliki thread.</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Buat Thread Pertama
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {threads.map((th, idx) => {
            const catSlug = typeof th.category === "string" ? th.category : th.category?.slug;
            const catName = typeof th.category === "object" ? th.category?.name || th.category?.slug : th.category;
            const isLast = idx === threads.length - 1;

            return (
              <div
                key={th.id}
                className={`flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 ${!isLast ? "border-b border-border" : ""}`}
              >
                {/* Icon */}
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary bg-opacity-10">
                  <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/thread/${encodeURIComponent(th.id)}`}
                        className="text-base font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {th.title || "(Tanpa Judul)"}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>#{th.id}</span>
                        <span>•</span>
                        <span>{formatRelativeDate(th.created_at)}</span>
                        {catSlug && (
                          <>
                            <span>•</span>
                            <Link
                              href={`/category/${encodeURIComponent(catSlug)}`}
                              className="rounded-full bg-muted/50 px-2 py-0.5 font-medium text-foreground hover:bg-border"
                            >
                              {catName}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/thread/${encodeURIComponent(th.id)}`}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        title="Lihat"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => startEdit(th)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(th)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                        title="Hapus"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Summary preview */}
                  {th.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {th.summary}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Thread</h2>
              <button
                onClick={cancelEdit}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Judul Thread *</label>
                <input
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Ringkasan</label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Konten Thread *</label>
                <MarkdownEditor
                  value={form.content}
                  onChange={(val) => setForm((f) => ({ ...f, content: val }))}
                  placeholder="Tuliskan isi thread dengan Markdown..."
                  minHeight="200px"
                  disabled={saving}
                  preview={MarkdownPreview}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Telegram *</label>
                <input
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="username"
                  value={form.telegram}
                  onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/50 px-6 py-4">
              <button
                onClick={cancelEdit}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Batal
              </button>
              <button
                onClick={() => saveEdit(editingThread.id)}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-border px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Hapus Thread</h2>
                <p className="text-sm text-muted-foreground">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-foreground">
                Apakah Anda yakin ingin menghapus thread <strong>&quot;{deleteConfirm.title || "(Tanpa Judul)"}&quot;</strong>?
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Thread ini akan dihapus secara permanen dari database dan tidak dapat dikembalikan.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/50 px-6 py-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus Thread"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function formatRelativeDate(ts) {
  if (!ts) return "";
  try {
    const date = new Date(ts * 1000);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  } catch {
    return "";
  }
}
