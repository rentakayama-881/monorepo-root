"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getApiBase, fetchJsonAuth } from "@/lib/api";
import { getValidToken, refreshAccessToken } from "@/lib/tokenRefresh";
import { getToken, isTokenExpired } from "@/lib/auth";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import TagSelector from "@/components/ui/TagSelector";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

// Autosave key for localStorage
const DRAFT_KEY_PREFIX = "thread_draft_";

export default function CreateThreadPage() {
  const router = useRouter();
  const params = useParams();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [telegram, setTelegram] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagsAvailable, setTagsAvailable] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const autosaveTimerRef = useRef(null);
  const tokenRefreshIntervalRef = useRef(null);

  const API = getApiBase();
  const draftKey = `${DRAFT_KEY_PREFIX}${params.slug}`;

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.summary) setSummary(draft.summary);
        if (draft.content) setContent(draft.content);
        if (draft.telegram) setTelegram(draft.telegram);
        if (draft.selectedTags) setSelectedTags(draft.selectedTags);
        if (draft.savedAt) setLastSaved(new Date(draft.savedAt));
        setDraftRestored(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [draftKey]);

  // Autosave draft to localStorage
  const saveDraft = useCallback(() => {
    try {
      const draft = {
        title,
        summary,
        content,
        telegram,
        selectedTags,
        savedAt: new Date().toISOString(),
      };
      // Only save if there's actual content
      if (title.trim() || content.trim() || summary.trim()) {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setLastSaved(new Date());
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [title, summary, content, telegram, selectedTags, draftKey]);

  // Autosave every 10 seconds when content changes
  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 10000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [title, summary, content, telegram, selectedTags, saveDraft]);

  // Also save on window unload/beforeunload
  useEffect(() => {
    const handleUnload = () => saveDraft();
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [saveDraft]);

  // Clear draft after successful submission
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
      setLastSaved(null);
    } catch {
      // Ignore
    }
  }, [draftKey]);

  // Proactive token refresh - keep session alive while user is typing
  useEffect(() => {
    // Check and refresh token every 2 minutes while on this page
    const checkAndRefreshToken = async () => {
      const token = getToken();
      if (token && isTokenExpired()) {
        try {
          await refreshAccessToken();
        } catch {
          // Token refresh failed - will handle on submit
        }
      }
    };

    // Initial check
    checkAndRefreshToken();

    // Set up interval - check every 2 minutes
    tokenRefreshIntervalRef.current = setInterval(checkAndRefreshToken, 2 * 60 * 1000);

    return () => {
      if (tokenRefreshIntervalRef.current) {
        clearInterval(tokenRefreshIntervalRef.current);
      }
    };
  }, []);

  // Fetch available tags
  useEffect(() => {
    fetch(`${API}/api/tags`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const resolvedTags = Array.isArray(data) ? data : data.tags || [];
        if (resolvedTags.length > 0) {
          setAvailableTags(resolvedTags);
          setTagsAvailable(true);
        } else {
          setAvailableTags([]);
          setTagsAvailable(false);
          setSelectedTags([]);
        }
      })
      .catch(() => {
        setAvailableTags([]);
        setTagsAvailable(false);
        setSelectedTags([]);
      });
  }, [API]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!title.trim()) return setError("Judul thread wajib diisi");
    if (title.trim().length < 3) return setError("Judul thread minimal 3 karakter");
    if (!content.trim()) return setError("Konten thread wajib diisi");
    if (!telegram.trim()) return setError("Contact telegram wajib diisi");

    // Save draft before attempting submit (in case of failure)
    saveDraft();

    setLoading(true);
    try {
      // Use getValidToken to ensure token is fresh before submitting
      const token = await getValidToken();
      if (!token) {
        setError("Sesi telah berakhir. Silakan login kembali. Draft Anda telah disimpan.");
        return;
      }

      const res = await fetch(`${API}/api/threads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category_slug: params.slug,
          title,
          summary,
          content_type: "text",
          content,
          tag_slugs: tagsAvailable ? selectedTags.map(t => t.slug) : [],
          meta: {
            telegram,
          },
        }),
      });

      if (!res.ok) {
        let message = "Gagal membuat thread";
        try {
          const data = await res.json();
          // Handle token/session errors specifically
          if (res.status === 401) {
            // Try refresh token once more
            const newToken = await refreshAccessToken();
            if (newToken) {
              // Retry the request with new token
              const retryRes = await fetch(`${API}/api/threads`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${newToken}`,
                },
                body: JSON.stringify({
                  category_slug: params.slug,
                  title,
                  summary,
                  content_type: "text",
                  content,
                  tag_slugs: tagsAvailable ? selectedTags.map(t => t.slug) : [],
                  meta: {
                    telegram,
                  },
                }),
              });
              if (retryRes.ok) {
                clearDraft();
                setSuccess("Thread berhasil dibuat!");
                setTimeout(() => router.push(`/category/${params.slug}`), 1200);
                return;
              }
            }
            message = "Sesi telah berakhir. Draft Anda telah disimpan. Silakan refresh halaman dan login kembali.";
          } else {
            message = data?.details || data?.error || data?.message || message;
          }
        } catch (err) {
          const txt = await res.text();
          if (txt) message = txt;
        }
        throw new Error(message);
      }

      // Success - clear draft
      clearDraft();
      setSuccess("Thread berhasil dibuat!");
      setTimeout(() => router.push(`/category/${params.slug}`), 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8 md:py-12">
      {/* Draft Restored Notification */}
      {draftRestored && (
        <div className="mb-4 rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm text-blue-600 dark:text-blue-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Draft sebelumnya telah dipulihkan. Konten Anda aman.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setTitle("");
              setSummary("");
              setContent("");
              setTelegram("");
              setSelectedTags([]);
              setDraftRestored(false);
            }}
            className="text-xs underline hover:no-underline"
          >
            Hapus draft
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Buat Thread Baru
        </h1>
        <p className="mt-2 text-muted-foreground">
          Kategori: <span className="font-medium text-foreground capitalize">{params.slug.replace(/-/g, " ")}</span>
        </p>
      </div>

      {/* Main Form */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Judul Thread <span className="text-destructive">*</span>
              </label>
              <input
                required
                className="flex h-10 w-full rounded-lg border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masukkan judul yang jelas dan menarik"
              />
              <p className="text-xs text-muted-foreground">{title.length}/100 karakter</p>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Ringkasan
                <span className="ml-2 text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                className="flex min-h-[100px] w-full rounded-lg border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 resize-y"
                rows={3}
                maxLength={300}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Deskripsi singkat yang akan muncul di preview thread"
              />
              <p className="text-xs text-muted-foreground">{summary.length}/300 karakter</p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Tags
                <span className="ml-2 text-xs font-normal text-muted-foreground">(pilih maksimal 3)</span>
              </label>
              <TagSelector
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                availableTags={availableTags}
                maxTags={3}
                placeholder="Pilih tags untuk thread..."
                enableSearch={false}
              />
              {!tagsAvailable && (
                <p className="text-xs text-muted-foreground">
                  Tags belum tersedia saat ini, jadi pilihan tags dinonaktifkan sementara.
                </p>
              )}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Konten Thread <span className="text-destructive">*</span>
              </label>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                placeholder="Tulis konten thread di sini. Markdown didukung..."
                minHeight="300px"
                disabled={loading}
                preview={MarkdownPreview}
              />
            </div>

            {/* Telegram */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Contact Telegram <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center">
                <span className="flex h-10 items-center rounded-l-lg border border-r-0 bg-secondary px-3 text-sm text-muted-foreground">
                  @
                </span>
                <input
                  required
                  className="flex h-10 w-full rounded-r-lg border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  value={telegram}
                  maxLength={50}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="username"
                />
              </div>
              <p className="text-xs text-muted-foreground">Username telegram tanpa simbol @</p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
                {success}
              </div>
            )}

            {/* Submit Button with Autosave Status */}
            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" size="lg" disabled={loading} className="min-w-[160px]">
                {loading ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Membuat...
                  </>
                ) : (
                  "Buat Thread"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Batal
              </Button>
              {/* Autosave indicator */}
              {lastSaved && (
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                  <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Draft tersimpan {lastSaved.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Right Column - Tips */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">💡 Tips Membuat Thread</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">Judul yang Jelas</p>
                <p>Gunakan judul yang spesifik dan deskriptif agar mudah ditemukan.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Ringkasan Menarik</p>
                <p>Tulis ringkasan yang menjelaskan inti thread dalam 1-2 kalimat.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Tags yang Tepat</p>
                <p>Pilih tags yang sesuai agar thread mudah dikategorikan.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Konten Terstruktur</p>
                <p>Gunakan markdown untuk format yang rapi. Tambahkan heading, list, dan code block jika perlu.</p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs">
                  ⚠️ Pastikan konten thread sesuai dengan <a href="/rules-content" className="text-primary hover:underline">aturan komunitas</a>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
