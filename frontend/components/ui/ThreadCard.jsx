"use client";

/**
 * ThreadCard Component - Consistent card for displaying threads
 * Styled like prompts.chat PromptCard with GitHub-level polish
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { getToken } from "@/lib/auth";
import Avatar from "./Avatar";
import { TagList } from "./TagPill";
import Badge from "./Badge";
import { useToast } from "./Toast";

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = typeof timestamp === "number" 
    ? new Date(timestamp * 1000) 
    : new Date(timestamp);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format relative time (e.g., "2 jam lalu")
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const date = typeof timestamp === "number" 
    ? new Date(timestamp * 1000) 
    : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return formatDate(timestamp);
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64Url = parts[1];
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
    if (typeof atob !== "function") return null;
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function getUsernameFromToken(token) {
  const payload = decodeJwtPayload(token);
  const uname = payload?.username ?? payload?.preferred_username ?? payload?.name ?? null;
  return typeof uname === "string" && uname.trim() ? uname : null;
}

/**
 * ThreadCard - Main thread card component
 * 
 * @param {Object} props
 * @param {Object} props.thread - Thread data object
 * @param {string} props.variant - "default" | "compact" | "list" (default: "default")
 * @param {boolean} props.showAuthor - Show author info (default: true)
 * @param {boolean} props.showCategory - Show category badge (default: true)
 * @param {boolean} props.showDate - Show date (default: true)
 * @param {boolean} props.showSummary - Show summary (default: true)
 * @param {string} props.href - Optional override href for the thread detail link
 * @param {(event: any) => void} props.onThreadClick - Optional click handler for the thread detail link
 * @param {string} props.className - Additional classes
 */
export default function ThreadCard({
  thread,
  variant = "default",
  showAuthor = true,
  showCategory = true,
  showDate = true,
  showSummary = true,
  href = "",
  onThreadClick,
  className = "",
}) {
  if (!thread) return null;

  const {
    id,
    title,
    summary,
    username,
    avatar_url,
    primary_badge,
    category,
    created_at,
    view_count,
    guarantee_amount,
    credential_count,
    tags,
  } = thread;

  const threadHref = typeof href === "string" && href.trim() ? href : `/thread/${id}`;

  // Compact variant - single line item
  if (variant === "compact") {
    return (
      <Link
        href={threadHref}
        onClick={(event) => (typeof onThreadClick === "function" ? onThreadClick(event) : undefined)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
          "hover:bg-accent",
          className
        )}
      >
        {showAuthor && (
          <Avatar
            src={avatar_url}
            name={username}
            size="xxs"
            className="shrink-0"
          />
        )}
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {title}
        </span>
        {showDate && (
          <span className="text-[11px] text-muted-foreground">
            {formatRelativeTime(created_at)}
          </span>
        )}
      </Link>
    );
  }

  // List variant - for list within containers (GitHub Issues style)
  if (variant === "list") {
    return (
      <Link
        href={threadHref}
        onClick={(event) => (typeof onThreadClick === "function" ? onThreadClick(event) : undefined)}
        className={cn(
          "flex items-start gap-2 p-3 transition-colors border-b last:border-b-0",
          "hover:bg-accent",
          className
        )}
      >
        {/* Avatar */}
        {showAuthor && (
          <Avatar
            src={avatar_url}
            name={username}
            size="xxs"
            className="mt-0.5 shrink-0"
          />
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title with tags */}
          <div className="mb-0.5">
            <h3 className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 inline">
              {title}
            </h3>
            {tags && tags.length > 0 && (
              <div className="inline-flex ml-1.5 gap-0.5">
                <TagList tags={tags} size="xs" maxDisplay={2} />
              </div>
            )}
          </div>
          
          {/* Summary */}
          {showSummary && summary && (
            <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
              {summary}
            </p>
          )}
          
          {/* Metadata */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              {showAuthor && (
                <Link
                  href={`/user/${username}`}
                  className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{username || "Anonim"}
                  {primary_badge && (
                    <Badge badge={primary_badge} size="xs" />
                  )}
                </Link>
              )}
              {showCategory && category && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px]">
                    {category.name || category.slug}
                  </span>
                </>
              )}
              {showDate && (
                <>
                  <span>•</span>
                  <span>{formatRelativeTime(created_at)}</span>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <CredentialPill
                threadId={id}
                initialCount={credential_count}
                threadUsername={username}
                size="xs"
              />
              <GuaranteePill amount={guarantee_amount} size="xs" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Default variant - full card
  return (
    <div
      className={cn(
        "thread-card group relative overflow-hidden rounded-md border border-border bg-card transition-colors",
        "hover:border-foreground/20 hover:bg-muted/20",
        className
      )}
    >
      <Link
        href={threadHref}
        onClick={(event) => (typeof onThreadClick === "function" ? onThreadClick(event) : undefined)}
        className="block px-3 pb-2 pt-3"
      >
        {/* Header with Title & Category */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          {/* Title */}
          <h3 className="flex-1 text-[13px] font-semibold leading-[1.1] text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>

          {/* Category badge on the right */}
          {showCategory && category && (
            <span className="inline-block shrink-0 mt-0.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              {category.name || category.slug}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <TagList tags={tags} size="xs" maxDisplay={3} />
          </div>
        )}

        {/* Summary */}
        {showSummary && summary && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
            {summary}
          </p>
        )}

        {/* Footer - Author & Meta */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border">
          {/* Author */}
          {showAuthor && (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                src={avatar_url}
                name={username}
                size="xxs"
                className="ring-2 ring-background transition-all group-hover:ring-primary/20"
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground truncate">
                  @{username || "Anonim"}
                  {primary_badge && <Badge badge={primary_badge} size="xs" />}
                </div>

                {showDate && (
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(created_at)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {typeof view_count === "number" && (
              <span
                className="inline-flex items-center gap-1 transition-colors group-hover:text-foreground"
                title="Dilihat"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="font-medium">{view_count}</span>
              </span>
            )}

            <CredentialPill
              threadId={id}
              initialCount={credential_count}
              threadUsername={username}
            />
            <GuaranteePill amount={guarantee_amount} />
          </div>
        </div>
      </Link>
    </div>
  );
}

function GuaranteePill({ amount, size = "sm" }) {
  if (Number(amount) <= 0) return null;

  const classes =
    size === "xs"
      ? "px-1.5 py-0.5 text-[10px] gap-0.5"
      : "px-2 py-0.5 text-[10px] gap-1";

  const iconClass = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400",
        classes
      )}
      title="Jaminan Profil"
    >
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5 1-2.5 2.25s1 2.25 2.5 2.25c1.5 0 2.5 1 2.5 2.25S13.5 17 12 17c-1 0-2-.5-2.5-1.5M12 6.5v1M12 16.5v1" />
      </svg>
      Rp {Number(amount).toLocaleString("id-ID")}
    </span>
  );
}

export function CredentialPill({ threadId, initialCount = 0, initialHasCredentialed = false, threadUsername = "", size = "sm" }) {
  const { toast } = useToast();
  const [count, setCount] = useState(typeof initialCount === "number" ? initialCount : 0);
  const [hasCredentialed, setHasCredentialed] = useState(!!initialHasCredentialed);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCount(typeof initialCount === "number" ? initialCount : 0);
  }, [initialCount]);

  const isClient = typeof window !== "undefined";
  const token = isClient ? getToken() : null;
  const isAuthed = !!token;
  const currentUsername = isClient ? getUsernameFromToken(token) : null;
  const isSelf = !!(currentUsername && threadUsername && currentUsername === threadUsername);

  async function refreshCount() {
    try {
      const base = getApiBase();
      const r = await fetch(`${base}/api/threads/${threadId}/credential/count`);
      if (!r.ok) return;
      const j = await r.json();
      if (typeof j?.count === "number") setCount(j.count);
    } catch {
      // ignore
    }
  }

  async function toggle(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (loading) return;

    if (!isAuthed) {
      toast.info("Login diperlukan", "Silakan login untuk memberi credential.");
      return;
    }
    if (isSelf) {
      toast.warning("Tidak bisa", "Kamu tidak bisa memberi credential pada thread sendiri.");
      return;
    }

    setLoading(true);

    const nextHas = !hasCredentialed;
    try {
      const base = getApiBase();
      const res = await fetchWithAuth(`${base}/api/threads/${threadId}/credential`, {
        method: nextHas ? "POST" : "DELETE",
      });
      if (!res.ok) {
        let msg = "Gagal memproses credential";
        try {
          const data = await res.clone().json();
          msg = data?.error || data?.message || data?.error?.message || msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      // Prefer backend-provided count (immediate UI update), fallback to count endpoint.
      try {
        const data = await res.clone().json();
        if (typeof data?.count === "number") {
          setCount(data.count);
        }
      } catch {
        // ignore json parse errors
      }

      setHasCredentialed(nextHas);
      await refreshCount();
    } catch (err) {
      const msg = String(err?.message || err);
      toast.error("Credential gagal", msg);
    } finally {
      setLoading(false);
    }
  }

  const title = !isAuthed
    ? "Login untuk memberi credential"
    : isSelf
      ? "Tidak dapat memberikan credential pada thread sendiri"
      : hasCredentialed
        ? "Klik untuk menghapus credential"
        : "Klik untuk memberi credential";

  const iconClass = size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textClass = size === "xs" ? "text-[11px]" : "text-[11px]";
  const padClass = size === "xs" ? "px-1 py-0.5" : "px-1.5 py-0.5";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={title}
      aria-label="Credential"
      aria-pressed={hasCredentialed}
      className={cn(
        "inline-flex items-center gap-0.5 transition-colors select-none",
        padClass,
        hasCredentialed
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground hover:text-foreground",
        (!isAuthed || isSelf) ? "opacity-50" : "",
        loading ? "opacity-60 cursor-wait" : ""
      )}
    >
      <svg className={iconClass} viewBox="0 0 24 24" fill={hasCredentialed ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
      <span className={cn("tabular-nums font-semibold", textClass)}>{count}</span>
    </button>
  );
}

/**
 * ThreadCardSkeleton - Loading state for ThreadCard
 */
export function ThreadCardSkeleton({ variant = "default" }) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-4 w-4 rounded-full bg-secondary animate-pulse" />
        <div className="flex-1 h-4 rounded bg-secondary animate-pulse" />
        <div className="h-3 w-16 rounded bg-secondary animate-pulse" />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="p-3 space-y-2">
        <div className="h-5 w-3/4 rounded bg-secondary animate-pulse" />
        <div className="h-4 w-full rounded bg-secondary animate-pulse" />
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-secondary animate-pulse" />
          <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card dark:bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="h-6 w-3/4 rounded bg-secondary animate-pulse" />
        <div className="h-6 w-20 rounded-full bg-secondary animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-secondary animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-secondary animate-pulse" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 rounded-full bg-secondary animate-pulse" />
        <div className="h-5 w-20 rounded-full bg-secondary animate-pulse" />
        <div className="h-5 w-14 rounded-full bg-secondary animate-pulse" />
      </div>
      <div className="flex items-center gap-2 pt-3 border-t">
        <div className="h-6 w-6 rounded-full bg-secondary animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
          <div className="h-2.5 w-16 rounded bg-secondary animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-8 rounded bg-secondary animate-pulse" />
          <div className="h-3 w-8 rounded bg-secondary animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * ThreadCardList - Container for list of thread cards
 */
export function ThreadCardList({ 
  children, 
  className = "",
  emptyMessage = "Belum ada thread.",
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  if (!hasChildren) {
    return (
      <div className="rounded-md border border-dashed bg-card dark:bg-background py-12 text-center">
        <svg className="mx-auto h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-md border bg-card dark:bg-background divide-y",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * ThreadCardGrid - Grid layout for thread cards
 */
export function ThreadCardGrid({ 
  children, 
  columns = 3,
  className = "",
  emptyMessage = "Belum ada thread.",
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;

  if (!hasChildren) {
    return (
      <div className="rounded-md border border-dashed bg-card dark:bg-background py-12 text-center">
        <svg className="mx-auto h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn(
      "grid gap-4",
      gridCols[columns] || gridCols[3],
      className
    )}>
      {children}
    </div>
  );
}
