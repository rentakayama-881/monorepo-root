"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { getValidToken, refreshAccessToken } from "@/lib/tokenRefresh";
import { getToken, isTokenExpired } from "@/lib/auth";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import TagSelector from "@/components/ui/TagSelector";
import { TagIcon } from "@/components/ui/TagIcons";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

// Autosave key for localStorage (scoped per user + category to prevent cross-user leakage)
const DRAFT_KEY_PREFIX = "thread_draft_v2_";
const AUTOSAVE_DEBOUNCE_MS = 900;

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + pad).replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getDraftUserKey() {
  // Prefer user_id from our JWT Claims (backend/middleware/jwt.go)
  // Fallback to username/sub if present, else "anon".
  try {
    const token = getToken();
    if (!token) return "anon";
    const payload = decodeJwtPayload(token);
    const key = payload?.user_id ?? payload?.username ?? payload?.sub;
    return key ? String(key) : "anon";
  } catch {
    return "anon";
  }
}

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
  const [legacyDraft, setLegacyDraft] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const autosaveTimerRef = useRef(null);
  const tokenRefreshIntervalRef = useRef(null);
  const draftStateRef = useRef({ title: "", summary: "", content: "", telegram: "", selectedTags: [] });
  const hasUserEditedRef = useRef(false);

  const API = getApiBase();
  const draftKey = `${DRAFT_KEY_PREFIX}${getDraftUserKey()}_${params.slug}`;

  // Keep a fresh snapshot for safe flush-on-unmount (avoids stale closures)
  useEffect(() => {
    draftStateRef.current = { title, summary, content, telegram, selectedTags };
  }, [title, summary, content, telegram, selectedTags]);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      setLegacyDraft(null);
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
        return;
      }

      // Legacy v1 drafts were stored without user-scoping: "thread_draft_{categorySlug}"
      // For safety, do NOT auto-restore across accounts; instead, offer an explicit import action.
      const legacyKey = `thread_draft_${params.slug}`;
      const legacySaved = localStorage.getItem(legacyKey);
      if (legacySaved) {
        const draft = JSON.parse(legacySaved);
        const savedAt = draft?.savedAt ? new Date(draft.savedAt) : null;
        setLegacyDraft({ key: legacyKey, draft, savedAt });
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [draftKey, params.slug]);

  // Autosave draft to localStorage
  const saveDraft = useCallback(() => {
    try {
      const snapshot = draftStateRef.current;
      const draft = {
        ...snapshot,
        savedAt: new Date().toISOString(),
        version: 2,
        categorySlug: params.slug,
        userKey: getDraftUserKey(),
      };

      const hasAny =
        snapshot.title.trim() ||
        snapshot.summary.trim() ||
        snapshot.content.trim() ||
        snapshot.telegram.trim() ||
        (Array.isArray(snapshot.selectedTags) && snapshot.selectedTags.length > 0);

      // If user cleared everything, remove draft (prevents stale empty drafts)
      if (!hasAny) {
        localStorage.removeItem(draftKey);
        setLastSaved(null);
        return;
      }

      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSaved(new Date());
    } catch {
      // Ignore localStorage errors
    }
  }, [draftKey, params.slug]);

  // Autosave (debounced) after user starts interacting
  useEffect(() => {
    if (!hasUserEditedRef.current) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      saveDraft();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [title, summary, content, telegram, selectedTags, saveDraft]);

  // Flush draft on unmount (covers client-side navigation/back)
  useEffect(() => {
    return () => {
      try {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
        }
        if (hasUserEditedRef.current) {
          saveDraft();
        }
      } catch {
        // Ignore
      }
    };
  }, [saveDraft]);

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

  const importLegacyDraft = useCallback(() => {
    if (!legacyDraft?.draft || !legacyDraft?.key) return;
    try {
      const draft = legacyDraft.draft || {};
      const next = {
        title: typeof draft.title === "string" ? draft.title : "",
        summary: typeof draft.summary === "string" ? draft.summary : "",
        content: typeof draft.content === "string" ? draft.content : "",
        telegram: typeof draft.telegram === "string" ? draft.telegram : "",
        selectedTags: Array.isArray(draft.selectedTags) ? draft.selectedTags : [],
      };

      setTitle(next.title);
      setSummary(next.summary);
      setContent(next.content);
      setTelegram(next.telegram);
      setSelectedTags(next.selectedTags);
      draftStateRef.current = { ...draftStateRef.current, ...next };
      hasUserEditedRef.current = true;

      const now = new Date();
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          ...next,
          savedAt: now.toISOString(),
          version: 2,
          categorySlug: params.slug,
          userKey: getDraftUserKey(),
        })
      );
      localStorage.removeItem(legacyDraft.key);

      setLastSaved(now);
      setDraftRestored(true);
      setLegacyDraft(null);
    } catch {
      // Ignore corrupted legacy draft
      setLegacyDraft(null);
    }
  }, [draftKey, legacyDraft, params.slug]);

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
    setError("");
    setSuccess("");

    if (!title.trim()) return setError("Judul thread wajib diisi");
    if (title.trim().length < 3) return setError("Judul thread minimal 3 karakter");
    if (!content.trim()) return setError("Konten thread wajib diisi");
    if (!telegram.trim()) return setError("Contact telegram wajib diisi");
    if (tagsAvailable && selectedTags.length < 2) {
      return setError("Pilih minimal 2 tags agar thread mudah difilter");
    }

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
          tag_slugs: tagsAvailable ? selectedTags.map((t) => t.slug) : [],
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
                  tag_slugs: tagsAvailable ? selectedTags.map((t) => t.slug) : [],
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
            message =
              "Sesi telah berakhir. Draft Anda telah disimpan. Silakan refresh halaman dan login kembali.";
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
      {/* Legacy Draft Found (manual import to avoid cross-user leakage) */}
      {legacyDraft && !draftRestored && (
        <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <TagIcon name="alert-triangle" className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Draft lama ditemukan</p>
              <p className="text-xs text-muted-foreground">
                Draft versi lama tidak terikat akun. Klik Import jika ini draft Anda.
                {legacyDraft.savedAt ? ` (tersimpan ${legacyDraft.savedAt.toLocaleString("id-ID")})` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={importLegacyDraft}
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setLegacyDraft(null)}
              className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Draft Restored Notification */}
      {draftRestored && (
        <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
                onChange={(e) => {
                  hasUserEditedRef.current = true;
                  const next = e.target.value;
                  draftStateRef.current = { ...draftStateRef.current, title: next };
                  setTitle(next);
                }}
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
                onChange={(e) => {
                  hasUserEditedRef.current = true;
                  const next = e.target.value;
                  draftStateRef.current = { ...draftStateRef.current, summary: next };
                  setSummary(next);
                }}
                placeholder="Deskripsi singkat yang akan muncul di preview thread"
              />
              <p className="text-xs text-muted-foreground">{summary.length}/300 karakter</p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Tags
                <span className="ml-2 text-xs font-normal text-muted-foreground">(pilih 2–4)</span>
              </label>
              <TagSelector
                selectedTags={selectedTags}
                onTagsChange={(next) => {
                  hasUserEditedRef.current = true;
                  draftStateRef.current = { ...draftStateRef.current, selectedTags: next };
                  setSelectedTags(next);
                }}
                availableTags={availableTags}
                maxTags={4}
                placeholder="Pilih tags untuk thread..."
                enableSearch={false}
                singlePerGroup={true}
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
                onChange={(val) => {
                  hasUserEditedRef.current = true;
                  draftStateRef.current = { ...draftStateRef.current, content: val };
                  setContent(val);
                }}
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
                  onChange={(e) => {
                    hasUserEditedRef.current = true;
                    const next = e.target.value;
                    draftStateRef.current = { ...draftStateRef.current, telegram: next };
                    setTelegram(next);
                  }}
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
              <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
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
                  <svg className="h-3 w-3 text-success" fill="currentColor" viewBox="0 0 20 20">
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
              <CardTitle className="flex items-center gap-2 text-base">
                <TagIcon name="lightbulb" className="h-4 w-4 text-muted-foreground" />
                Tips Membuat Thread
              </CardTitle>
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
                <p className="flex items-start gap-2 text-xs">
                  <TagIcon name="alert-triangle" className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>
                    Pastikan konten thread sesuai dengan{" "}
                    <a href="/rules-content" className="text-primary hover:underline">
                      aturan komunitas
                    </a>
                    .
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
