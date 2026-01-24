"use client";

/**
 * ThreadCard Component - Consistent card for displaying threads
 * Styled like prompts.chat PromptCard with GitHub-level polish
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import Avatar from "./Avatar";
import { TagList } from "./TagPill";
import Badge from "./Badge";

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
 * @param {string} props.className - Additional classes
 */
export default function ThreadCard({
  thread,
  variant = "default",
  showAuthor = true,
  showCategory = true,
  showDate = true,
  showSummary = true,
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
    reply_count,
    view_count,
    tags,
  } = thread;

  // Compact variant - single line item
  if (variant === "compact") {
    return (
      <Link
        href={`/thread/${id}`}
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
            className="h-4 w-4"
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
        href={`/thread/${id}`}
        className={cn(
          "flex items-start gap-2 p-3 transition-colors border-b last:border-b-0",
          "hover:bg-accent",
          className
        )}
      >
        {/* Avatar */}
        {showAuthor && (
          <Avatar src={avatar_url} name={username} className="h-4 w-4 mt-0.5" />
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
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
            {typeof reply_count === "number" && reply_count > 0 && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"></path>
                  </svg>
                  {reply_count}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Default variant - full card
// Default variant - full card (fees-like spacing & typography)
return (
  <div
    className={cn(
      "thread-card group relative overflow-hidden rounded-md border border-border bg-card transition-colors",
      "hover:border-foreground/20 hover:bg-muted/20",
      className
    )}
  >
    <Link href={`/thread/${id}`} className="block p-3">
      {/* Header with Title & Category */}
      <div className="flex items-start justify-between gap-3 mb-1.5">
        {/* Title */}
        <h3 className="flex-1 text-[13px] font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Category badge on the right */}
        {showCategory && category && (
          <span className="inline-block shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
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
      <div className="flex items-center justify-between pt-2.5 border-t border-border">
        {/* Author */}
        {showAuthor && (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              src={avatar_url}
              name={username}
              className="h-5 w-5 ring-2 ring-background transition-all group-hover:ring-primary/20"
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

        {/* Stats */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {typeof reply_count === "number" && (
            <span
              className="inline-flex items-center gap-1 transition-colors group-hover:text-foreground"
              title="Balasan"
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
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
              <span className="font-medium">{reply_count}</span>
            </span>
          )}

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
        </div>
      </div>
    </Link>
  </div>
);

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
