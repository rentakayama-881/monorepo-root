"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { getToken } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import ProseMirrorRenderer from "@/components/ui/ProseMirrorRenderer";
import { TagList } from "@/components/ui/TagPill";
import ReactionBar from "@/components/ReactionBar";
import ReplyList from "@/components/ReplyList";
import ReplyForm from "@/components/ReplyForm";
import ReportModal from "@/components/ReportModal";
import { REPORT_TARGET_TYPES } from "@/lib/useReport";

export default function ThreadDetailPage() {
  const params = useParams();
  const id = params?.id;
  const API = getApiBase();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [repliesKey, setRepliesKey] = useState(0); // Force refresh replies
  const readingProgressRef = useRef(null);

  const isAuthed = typeof window !== "undefined" ? !!getToken() : false;
  const currentUsername = typeof window !== "undefined" ? localStorage.getItem("username") : null;

  // Reading progress with throttling
  useEffect(() => {
    let ticking = false;
    let lastUpdate = 0;
    const THROTTLE_MS = 100; // Update at most every 100ms
    
    const handleScroll = () => {
      const now = Date.now();
      
      if (!ticking && (now - lastUpdate >= THROTTLE_MS)) {
        window.requestAnimationFrame(() => {
          // Reading progress with guard against division by zero
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          const scrollTop = window.scrollY;
          const trackLength = documentHeight - windowHeight;
          
          if (trackLength > 0) {
            const progress = (scrollTop / trackLength) * 100;
            const node = readingProgressRef.current;
            if (node) node.style.width = `${Math.min(progress, 100)}%`;
          } else {
            const node = readingProgressRef.current;
            if (node) node.style.width = `0%`;
          }
          
          lastUpdate = now;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      setError("Please sign in to view this thread.");
      setLoading(false);
      return;
    }

    if (!id || id === 'undefined') {
      return;
    }

    let cancelled = false;

    setLoading(true);

    // Use fetchWithAuth for automatic token refresh
    fetchWithAuth(`${API}/api/threads/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error("Failed to load thread"))))
      .then(json => !cancelled && setData(json))
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [API, id, isAuthed]);

  if (!isAuthed) {
    return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-border bg-card dark:bg-background p-6">
          <p className="text-sm text-foreground">Please sign in to view this thread.</p>
          <Link href="/login" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            Sign in now →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
        <span>/</span>
        {data?.category?.slug && (
          <>
            <Link href={`/category/${encodeURIComponent(data.category.slug)}`} className="hover:text-foreground hover:underline">
              {data.category.name || data.category.slug}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground">Thread #{id}</span>
      </nav>

      {loading ? (
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-md bg-border" />
          <div className="h-4 w-1/3 animate-pulse rounded-md bg-border" />
          <div className="h-40 animate-pulse rounded-lg bg-border" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      ) : data ? (
        <>
        <article className="rounded-lg border border-border bg-card dark:bg-background">
          {/* Header */}
          <div className="border-b border-border p-6">
            <h1 className="text-xl font-semibold text-foreground">{data.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatRelativeDate(data.created_at)}
              </span>
              {data.category && (
                <Link
                  href={`/category/${encodeURIComponent(data.category.slug)}`}
                  className="inline-flex items-center rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-border"
                >
                  {data.category.name || data.category.slug}
                </Link>
              )}
              {data.user && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <Link href={`/user/${encodeURIComponent(data.user.username)}`} className="font-medium text-foreground hover:underline">
                    {data.user.username}
                  </Link>
                  {data.user.primary_badge && <Badge badge={data.user.primary_badge} size="sm" />}
                </span>
              )}
            </div>
            {Array.isArray(data.tags) && data.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <TagList tags={data.tags} size="sm" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Image */}
            {data.meta?.image && (
              <div className="mb-6 overflow-hidden rounded-lg border border-border bg-muted/20">
                <div className="relative aspect-video">
                  <img
                    src={data.meta.image}
                    alt="Thread image"
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            {data.summary && (
              <div className="mb-6 rounded-lg border-l-4 border-primary bg-muted/50 p-4">
                <p className="text-sm leading-relaxed text-foreground">{data.summary}</p>
              </div>
            )}

            {/* Main content */}
            <div className="prose prose-neutral max-w-none">
              {data.content_type === "text" ? (
                <MarkdownPreview
                  content={
                    typeof data.content === "string"
                      ? data.content
                      : (data.content?.text || JSON.stringify(data.content, null, 2))
                  }
                />
              ) : data.content_type === "prosemirror" ? (
                <ProseMirrorRenderer content={data.content} />
              ) : (
                <ContentTable content={data.content} />
              )}
            </div>

            {/* Telegram contact */}
            {data.meta?.telegram && (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-4">
                <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                <span className="text-sm text-muted-foreground">Contact:</span>
                <a
                  href={`https://t.me/${data.meta.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {data.meta.telegram}
                </a>
              </div>
            )}
          </div>

          {/* Reactions */}
          <div className="border-t border-border px-6 py-4">
            <ReactionBar threadId={id} />
          </div>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/50 px-6 py-4">
            <Link
              href="/threads"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              My Threads
            </Link>
            {data.category && (
              <Link
                href={`/category/${encodeURIComponent(data.category.slug)}`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                View Category
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            )}
            
            {/* Report button */}
            <button
              onClick={() => setShowReportModal(true)}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-destructive transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              Laporkan
            </button>
          </div>
        </article>

        {/* Replies Section */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Balasan</h2>
          
          {/* Reply Form */}
          <div className="mb-6 rounded-lg border border-border bg-card dark:bg-background p-4">
            <ReplyForm
              threadId={id}
              onSuccess={() => setRepliesKey((k) => k + 1)}
              placeholder="Tulis balasan untuk thread ini..."
            />
          </div>

          {/* Reply List */}
          <ReplyList
            key={repliesKey}
            threadId={id}
            currentUsername={currentUsername}
          />
        </section>

        {/* Report Modal */}
        <ReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetType={REPORT_TARGET_TYPES.THREAD}
          targetId={id}
          targetTitle={data?.title}
        />
        </>
      ) : null}

      {/* Reading progress bar */}
      <div ref={readingProgressRef} className="reading-progress" aria-hidden="true" />
    </main>
  );
}

function ContentTable({ content }) {
  if (!content) return <div className="text-sm text-muted-foreground">Tidak ada konten.</div>;
  let rows = [];
  if (Array.isArray(content?.rows)) rows = content.rows;
  else if (Array.isArray(content?.sections)) {
    return (
      <div className="space-y-6">
        {content.sections.map((sec, idx) => (
          <div key={idx}>
            {sec.title && <h3 className="mb-3 text-base font-semibold text-foreground">{sec.title}</h3>}
            <Table rows={sec.rows || []} />
          </div>
        ))}
      </div>
    );
  } else if (typeof content === "object") {
    rows = Object.entries(content).map(([label, value]) => ({ label, value }));
  }
  if (!rows.length) return <div className="text-sm text-muted-foreground">Tidak ada konten.</div>;
  return <Table rows={rows} />;
}

function Table({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/50"}>
              <td className="w-40 px-4 py-3 align-top font-medium text-foreground">{r.label}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{renderValue(r.value)}</td>
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
      <ul className="list-disc pl-4 space-y-1">
        {v.map((x, i) => (
          <li key={i}>{String(x)}</li>
        ))}
      </ul>
    );
  if (typeof v === "object") return <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(v, null, 2)}</pre>;
  return String(v);
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
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}
