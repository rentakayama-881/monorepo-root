"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { LOCKED_CATEGORIES } from "@/lib/constants";
import ThreadCard from "@/components/ui/ThreadCard";
import EmptyState from "@/components/ui/EmptyState";
import { TagPill } from "@/components/ui/TagPill";
import CategoryThreadsSkeleton from "./CategoryThreadsSkeleton";

const PAGE_SIZE = 10;

export default function CategoryThreadsPage() {
  const params = useParams();
  const [threads, setThreads] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const API = getApiBase();

  useEffect(() => {
    setSelectedTagSlugs([]);
    setCurrentPage(1);
  }, [params.slug]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/threads/category/${params.slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setThreads(data.threads || []);
        setCategory(data.category || null);
      })
      .finally(() => setLoading(false));
  }, [API, params.slug]);

  function getTagGroup(tagSlug) {
    const slug = String(tagSlug || "").toLowerCase();
    if (slug.startsWith("artifact-")) return "artifact";
    if (slug.startsWith("domain-")) return "domain";
    if (slug.startsWith("stage-")) return "stage";
    if (slug.startsWith("evidence-")) return "evidence";
    return "other";
  }

  const availableTags = useMemo(() => {
    const map = new Map();
    for (const thread of threads) {
      const list = Array.isArray(thread?.tags) ? thread.tags : [];
      for (const tag of list) {
        if (tag?.slug && !map.has(tag.slug)) {
          map.set(tag.slug, tag);
        }
      }
    }

    const groupRank = { artifact: 1, domain: 2, stage: 3, evidence: 4, other: 5 };
    return Array.from(map.values()).sort((a, b) => {
      const ga = getTagGroup(a.slug);
      const gb = getTagGroup(b.slug);
      const ra = groupRank[ga] || 99;
      const rb = groupRank[gb] || 99;
      if (ra !== rb) return ra - rb;
      return String(a.name || "").localeCompare(String(b.name || ""), "id-ID");
    });
  }, [threads]);

  const filteredThreads = useMemo(() => {
    if (!Array.isArray(selectedTagSlugs) || selectedTagSlugs.length === 0) return threads;
    return threads.filter((thread) => {
      const slugs = new Set((Array.isArray(thread?.tags) ? thread.tags : []).map((t) => t.slug));
      return selectedTagSlugs.every((slug) => slugs.has(slug));
    });
  }, [threads, selectedTagSlugs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTagSlugs]);

  const totalPages = useMemo(() => {
    if (filteredThreads.length === 0) return 1;
    return Math.ceil(filteredThreads.length / PAGE_SIZE);
  }, [filteredThreads.length]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredThreads.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredThreads, currentPage]);

  const hasActiveFilter = selectedTagSlugs.length > 0;
  const totalThreads = threads.length;
  const visibleThreads = filteredThreads.length;
  const paginationStart = visibleThreads === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const paginationEnd = Math.min(currentPage * PAGE_SIZE, visibleThreads);

  function toggleFilterTag(slug) {
    setSelectedTagSlugs((prev) => {
      const set = new Set(prev);
      if (set.has(slug)) {
        set.delete(slug);
        return Array.from(set);
      }

      const groupKey = getTagGroup(slug);
      if (groupKey !== "other") {
        for (const existing of prev) {
          if (getTagGroup(existing) === groupKey) {
            set.delete(existing);
          }
        }
      }
      set.add(slug);
      return Array.from(set);
    });
  }

  if (loading) {
    return (
      <CategoryThreadsSkeleton
        slug={params.slug}
        locked={LOCKED_CATEGORIES.includes(params.slug)}
        threadCount={8}
      />
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {category?.name || String(params.slug || "").replace(/-/g, " ")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {category?.description || "Diskusi dan thread terbaru di kategori ini."}
          </p>
          {threads.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {hasActiveFilter ? `${visibleThreads} dari ${totalThreads}` : totalThreads} thread
              {totalThreads !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {!LOCKED_CATEGORIES.includes(params.slug) ? (
          <Link
            href={`/category/${params.slug}/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat Thread
          </Link>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-md bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed" title="Kategori ini sementara ditutup untuk thread baru">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Kategori Terkunci
          </div>
        )}
      </header>

      {/* Tag Filter (client-side, based on tags present in loaded threads) */}
      {availableTags.length > 0 && (
        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 text-sm font-medium text-foreground">Filter tags</div>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <TagPill
                  key={tag.slug}
                  tag={tag}
                  size="sm"
                  selected={selectedTagSlugs.includes(tag.slug)}
                  onClick={() => toggleFilterTag(tag.slug)}
                />
              ))}
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => setSelectedTagSlugs([])}
                className="ml-auto inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                Reset filter
              </button>
            )}
          </div>
          {hasActiveFilter && (
            <p className="mt-2 text-xs text-muted-foreground">
              Menampilkan {visibleThreads} thread yang cocok.
            </p>
          )}
        </section>
      )}

      {threads.length === 0 ? (
        <EmptyState
          variant="content"
          title="Belum ada thread di kategori ini"
          description="Jadilah yang pertama untuk memulai diskusi di kategori ini."
          action={
            !LOCKED_CATEGORIES.includes(params.slug) && (
              <Link
                href={`/category/${params.slug}/new`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Buat Thread Pertama
              </Link>
            )
          }
        />
      ) : filteredThreads.length === 0 ? (
        <EmptyState
          variant="content"
          title="Tidak ada thread yang cocok"
          description="Coba kurangi filter tags atau reset filter untuk melihat semua thread."
          action={
            hasActiveFilter && (
              <button
                type="button"
                onClick={() => setSelectedTagSlugs([])}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Reset filter
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {paginatedThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              variant="default"
              showCategory={false}
            />
          ))}
          {visibleThreads > PAGE_SIZE && (
            <nav className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Menampilkan {paginationStart}-{paginationEnd} dari {visibleThreads} thread (halaman{" "}
                {currentPage} / {totalPages})
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </main>
  );
}
