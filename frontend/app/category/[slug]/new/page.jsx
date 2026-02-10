"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchJson, fetchJsonAuth, getApiBase } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { LOCKED_CATEGORIES } from "@/lib/constants";
import TagSelector from "@/components/ui/TagSelector";
import { TagList } from "@/components/ui/TagPill";

function formatIDR(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "";
  return Math.max(0, Math.trunc(n)).toLocaleString("id-ID");
}

export default function CreateValidationCasePage() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params?.slug || "");
  const locked = LOCKED_CATEGORIES.includes(slug);

  const isAuthed = useMemo(() => {
    try {
      return !!getToken();
    } catch {
      return false;
    }
  }, []);

  const [category, setCategory] = useState(null);
  const [loadingCategory, setLoadingCategory] = useState(true);

  const [availableTags, setAvailableTags] = useState([]);
  const [tagsAvailable, setTagsAvailable] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);

  const [form, setForm] = useState({
    title: "",
    summary: "",
    bounty_amount: "10000",
    content: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCategory() {
      setLoadingCategory(true);
      try {
        const categories = await fetchJson("/api/validation-cases/categories", { method: "GET" });
        const list = Array.isArray(categories?.categories) ? categories.categories : [];
        const found = list.find((c) => c.slug === slug) || null;
        if (!cancelled) setCategory(found);
      } catch {
        if (!cancelled) setCategory(null);
      } finally {
        if (!cancelled) setLoadingCategory(false);
      }
    }

    async function loadTags() {
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/tags`, { method: "GET" });
        const data = res.ok ? await res.json() : null;
        const resolved = Array.isArray(data) ? data : Array.isArray(data?.tags) ? data.tags : [];
        if (!cancelled) {
          setAvailableTags(resolved);
          setTagsAvailable(resolved.length > 0);
        }
      } catch {
        if (!cancelled) {
          setAvailableTags([]);
          setTagsAvailable(false);
        }
      }
    }

    if (slug) {
      loadCategory();
      loadTags();
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function submit() {
    setError("");
    setOk("");

    if (locked) {
      setError("Intake untuk kategori ini sedang ditutup.");
      return;
    }

    const title = String(form.title || "").trim();
    const summary = String(form.summary || "").trim();
    const content = String(form.content || "").trim();
    const bounty = Number(String(form.bounty_amount || "").replace(/[^\d]/g, ""));

    if (title.length < 3) {
      setError("Title minimal 3 karakter.");
      return;
    }
    if (!content) {
      setError("Case Record wajib diisi.");
      return;
    }
    if (!bounty || bounty < 10000) {
      setError("Bounty minimal Rp 10.000.");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        category_slug: slug,
        title,
        summary,
        content_type: "text",
        content,
        bounty_amount: bounty,
        tag_slugs: selectedTags.map((t) => t.slug),
      };

      const created = await fetchJsonAuth("/api/validation-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const id = created?.id;
      setOk("Validation Case berhasil dibuat.");
      if (id) {
        router.push(`/validation-cases/${encodeURIComponent(String(id))}`);
      }
    } catch (e) {
      setError(e?.message || "Gagal membuat Validation Case");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/validation-cases" className="hover:underline">
          Validation Case Index
        </Link>
        <span>/</span>
        <Link href={`/category/${encodeURIComponent(slug)}`} className="hover:underline">
          {category?.name || slug}
        </Link>
        <span>/</span>
        <span className="text-foreground">Create</span>
      </nav>

      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Intake
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Create Validation Case
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Case Record bersifat formal dan dapat diaudit. Jangan sertakan info kontak di Case Record.
        </p>
      </header>

      {locked ? (
        <div className="mb-5 rounded-[var(--radius)] border border-border bg-secondary/60 px-5 py-4 text-sm text-muted-foreground">
          Intake closed untuk kategori ini.
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-[var(--radius)] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {ok ? (
        <div className="mb-5 rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          {ok}
        </div>
      ) : null}

      <section className="rounded-[var(--radius)] border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <div className="text-sm font-semibold text-foreground">
            {loadingCategory ? "Loading type..." : category?.name || slug}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">category_slug: {slug}</div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
              placeholder="Ringkas, spesifik, dapat diverifikasi."
              disabled={locked || submitting}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Abstract (optional)</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
              placeholder="Garis besar kebutuhan validasi, konteks, dan batasan."
              disabled={locked || submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Bounty (IDR)</label>
              <input
                value={formatIDR(form.bounty_amount)}
                onChange={(e) => setForm((f) => ({ ...f, bounty_amount: e.target.value }))}
                className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground"
                inputMode="numeric"
                disabled={locked || submitting}
              />
              <div className="mt-1 text-[11px] text-muted-foreground">Minimal Rp 10.000. Dana akan dikunci via escrow setelah Final Offer diterima.</div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Tags (optional)</label>
              {tagsAvailable ? (
                <TagSelector
                  tags={availableTags}
                  selectedTags={selectedTags}
                  onChange={setSelectedTags}
                  disabled={locked || submitting}
                />
              ) : (
                <div className="mt-1 text-sm text-muted-foreground">Tags tidak tersedia.</div>
              )}
              {Array.isArray(selectedTags) && selectedTags.length > 0 ? (
                <div className="mt-2">
                  <TagList tags={selectedTags} size="xs" />
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Case Record</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={14}
              className="mt-1 w-full rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-sm text-foreground font-mono"
              placeholder={[
                "Suggested structure:",
                "",
                "1) Context",
                "2) Claims / Expected Output",
                "3) Inputs (AI output, data, code)",
                "4) Constraints",
                "5) Acceptance Criteria",
                "6) Known Risks / Non-goals",
              ].join("\\n")}
              disabled={locked || submitting}
            />
            <div className="mt-2 text-[11px] text-muted-foreground">
              Kontak Telegram tidak boleh dimasukkan. Kontak hanya dibuka via workflow Request Consultation dan dicatat pada Case Log.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/category/${encodeURIComponent(slug)}`}
              className="text-sm font-semibold text-muted-foreground hover:underline"
            >
              Back to Type Index
            </Link>
            <button
              onClick={submit}
              disabled={locked || submitting}
              className="rounded-[var(--radius)] bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              type="button"
            >
              {submitting ? "Submitting..." : "Create Validation Case"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

