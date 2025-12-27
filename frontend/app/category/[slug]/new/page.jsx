"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import MarkdownEditor from "@/components/ui/MarkdownEditor";
import MarkdownPreview from "@/components/ui/MarkdownPreview";

export default function CreateThreadPage() {
  const router = useRouter();
  const params = useParams();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [telegram, setTelegram] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const API = getApiBase();

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
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">Judul Thread <span className="text-red-500">*</span></label>
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
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">Konten Thread <span className="text-red-500">*</span></label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Tuliskan isi thread dengan Markdown...

Contoh format:
## Heading
**Bold** dan _italic_
- List item
`inline code`

```
code block
```

[Link](https://example.com)
![Gambar](https://example.com/image.jpg)"
            minHeight="200px"
            disabled={loading}
            preview={MarkdownPreview}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[rgb(var(--fg))]">Contact Telegram <span className="text-red-500">*</span></label>
          <input
            required
            className={inputClass}
            value={telegram}
            maxLength={50}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="username (tanpa @)"
          />
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>}

        <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center rounded-md bg-[rgb(var(--brand))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {loading ? "Membuat..." : "Buat Thread"}
        </button>
      </form>
    </section>
  );
}
