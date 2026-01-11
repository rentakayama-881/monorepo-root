"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import TagSelector from "@/components/ui/TagSelector";

export default function CreateThreadPage() {
  const router = useRouter();
  const params = useParams();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [telegram, setTelegram] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const API = getApiBase();

  // Fetch available tags
  useEffect(() => {
    fetch(`${API}/api/tags`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setAvailableTags(Array.isArray(data) ? data : data.tags || []);
      })
      .catch(() => {
        // If tags endpoint doesn't exist yet, use mock data
        setAvailableTags([
          { slug: 'service', name: 'Service', description: 'Offering services', color: '#0969da', icon: 'briefcase' },
          { slug: 'selling', name: 'Selling', description: 'Selling products', color: '#1a7f37', icon: 'tag' },
          { slug: 'looking', name: 'Looking For', description: 'Looking for help', color: '#8250df', icon: 'search' },
          { slug: 'hiring', name: 'Hiring', description: 'Job opportunities', color: '#bf3989', icon: 'people' },
          { slug: 'collaboration', name: 'Collaboration', description: 'Partnership', color: '#1f6feb', icon: 'git-merge' },
          { slug: 'question', name: 'Question', description: 'Asking questions', color: '#bc4c00', icon: 'question' },
          { slug: 'discussion', name: 'Discussion', description: 'General discussion', color: '#58a6ff', icon: 'comment-discussion' },
        ]);
      });
  }, [API]);

  const inputClass =
    "w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--brand))]";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!title.trim()) return setError("Judul thread wajib diisi");
    if (!content.trim()) return setError("Konten thread wajib diisi");
    if (!telegram.trim()) return setError("Contact telegram wajib diisi");

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
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
          tag_slugs: selectedTags.map(t => t.slug),
          meta: {
            telegram,
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Gagal membuat thread");
      }
      setSuccess("Thread berhasil dibuat!");
      setTimeout(() => router.push(`/category/${params.slug}`), 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-semibold text-[rgb(var(--fg))]">Buat Thread Baru</h2>
        <div className="text-base text-[rgb(var(--muted))]">
          Kategori: <span className="font-medium capitalize">{params.slug.replace(/-/g, " ")}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6" autoComplete="off">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">Judul Thread <span className="text-[rgb(var(--error))]">*</span></label>
          <input
            required
            className={inputClass}
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Masukkan judul yang jelas"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">Ringkasan (optional)</label>
          <textarea
            className={`${inputClass} min-h-[90px]`}
            rows={3}
            maxLength={300}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Deskripsi singkat / highlight utama thread"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">
            Tags
            <span className="ml-2 text-xs font-normal text-[rgb(var(--muted))]">(optional)</span>
          </label>
          <TagSelector
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            availableTags={availableTags}
            maxTags={3}
            placeholder="Pilih tags untuk thread..."
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">Konten Thread <span className="text-[rgb(var(--error))]">*</span></label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Silakan menulis..."
            minHeight="200px"
            disabled={loading}
            preview={MarkdownPreview}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">Contact Telegram <span className="text-[rgb(var(--error))]">*</span></label>
          <input
            required
            className={inputClass}
            value={telegram}
            maxLength={50}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="username (tanpa @)"
          />
        </div>

        {error && <div className="rounded-md border border-[rgb(var(--error-border))] bg-[rgb(var(--error-bg))] px-3 py-2 text-sm text-[rgb(var(--error))]">{error}</div>}
        {success && <div className="rounded-md border border-[rgb(var(--success-border))] bg-[rgb(var(--success-bg))] px-3 py-2 text-sm text-[rgb(var(--success))]">{success}</div>}

        <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center rounded-md bg-[rgb(var(--brand))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {loading ? "Membuat..." : "Buat Thread"}
        </button>
      </form>
    </section>
  );
}
