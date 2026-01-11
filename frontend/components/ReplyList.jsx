"use client";

import React, { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { useReplies, useDeleteReply } from "@/lib/useReplies";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import ReplyForm from "./ReplyForm";

/**
 * Format relative time in Indonesian
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Single reply item component
 */
function ReplyItem({
  reply,
  threadId,
  depth = 0,
  onReplySuccess,
  currentUsername,
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteReply } = useDeleteReply();
  const { toast } = useToast();

  const maxDepth = 3;
  const canReply = depth < maxDepth && !reply.isDeleted;
  const isAuthor = currentUsername && reply.username === currentUsername;
  const paddingLeft = depth > 0 ? `${depth * 24}px` : "0";

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus balasan ini?")) return;

    setIsDeleting(true);
    try {
      await deleteReply(threadId, reply.id);
      toast.success("Berhasil", "Balasan telah dihapus");
      onReplySuccess?.();
    } catch (err) {
      toast.error("Gagal", err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReplySuccess = () => {
    setShowReplyForm(false);
    onReplySuccess?.();
  };

  return (
    <div
      className="relative animate-fade-in"
      style={{ marginLeft: paddingLeft }}
    >
      {/* Connector line for nested replies */}
      {depth > 0 && (
        <div
          className="reply-thread-line"
          style={{ left: "-12px" }}
        />
      )}

      <div
        className={`
          rounded-[var(--radius)] border bg-card p-4 transition-all
          hover:border-primary/30 hover:shadow-sm
          ${reply.isDeleted ? "opacity-60" : ""}
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar
            src={reply.avatarUrl}
            name={reply.username}
            size="sm"
            className="ring-2 ring-background"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate">
                {reply.username || "Anonim"}
              </span>
              {depth > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6.122.392a1.75 1.75 0 0 1 1.756 0l5.25 3.045c.54.313.872.89.872 1.514V7.25a.75.75 0 0 1-1.5 0V5.677L7.75 8.432v6.384a1 1 0 0 1-1.502.865L.872 12.563A1.75 1.75 0 0 1 0 11.049V4.951c0-.624.332-1.2.872-1.514L6.122.392zM7.125 1.69l4.63 2.685L7 7.133 2.245 4.375l4.63-2.685a.25.25 0 0 1 .25 0zM1.5 11.049V5.677l4.75 2.755v5.516l-4.625-2.683a.25.25 0 0 1-.125-.216zm11.672-.282a.75.75 0 1 0-1.087-1.034l-2.378 2.5a.75.75 0 0 0 0 1.034l2.378 2.5a.75.75 0 1 0 1.087-1.034L11.999 13.5h3.251a.75.75 0 0 0 0-1.5h-3.251l1.173-1.233z"></path>
                  </svg>
                  Balasan
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <time dateTime={reply.createdAt}>
                {formatRelativeTime(reply.createdAt)}
              </time>
              {reply.updatedAt && reply.updatedAt !== reply.createdAt && (
                <>
                  <span>•</span>
                  <span className="italic">(diedit)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="text-sm">
          {reply.isDeleted ? (
            <p className="italic text-muted-foreground py-2">
              [Balasan telah dihapus]
            </p>
          ) : (
            <MarkdownPreview content={reply.content} />
          )}
        </div>

        {/* Actions */}
        {!reply.isDeleted && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            {canReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6.78 1.97a.75.75 0 010 1.06L3.81 6h6.44A4.75 4.75 0 0115 10.75v2.5a.75.75 0 01-1.5 0v-2.5a3.25 3.25 0 00-3.25-3.25H3.81l2.97 2.97a.75.75 0 11-1.06 1.06L1.47 7.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"></path>
                </svg>
                {showReplyForm ? "Batal" : "Balas"}
              </button>
            )}

            {isAuthor && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 00.249.225h5.19a.25.25 0 00.249-.225l.66-6.6a.75.75 0 011.492.149l-.66 6.6A1.748 1.748 0 0110.595 15h-5.19a1.75 1.75 0 01-1.741-1.575l-.66-6.6a.75.75 0 111.492-.15zM6.5 1.75V3h3V1.75a.25.25 0 00-.25-.25h-2.5a.25.25 0 00-.25.25z"></path>
                </svg>
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            )}
          </div>
        )}

        {/* Reply form with smooth animation */}
        {showReplyForm && (
          <div className="mt-4 pt-4 border-t animate-slide-down">
            <ReplyForm
              threadId={threadId}
              parentReplyId={reply.id}
              onSuccess={handleReplySuccess}
              onCancel={() => setShowReplyForm(false)}
              placeholder={`Balas ke ${reply.username}...`}
              compact
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Build nested reply tree from flat list
 */
function buildReplyTree(replies) {
  const replyMap = new Map();
  const rootReplies = [];

  // First pass: create map
  replies.forEach((reply) => {
    replyMap.set(reply.id, { ...reply, children: [] });
  });

  // Second pass: build tree
  replies.forEach((reply) => {
    const node = replyMap.get(reply.id);
    if (reply.parentReplyId && replyMap.has(reply.parentReplyId)) {
      const parent = replyMap.get(reply.parentReplyId);
      parent.children.push(node);
    } else {
      rootReplies.push(node);
    }
  });

  return rootReplies;
}

/**
 * Recursive render of reply tree
 */
function RenderReplyTree({ replies, threadId, depth, onReplySuccess, currentUsername }) {
  return (
    <>
      {replies.map((reply) => (
        <div key={reply.id} className="space-y-3">
          <ReplyItem
            reply={reply}
            threadId={threadId}
            depth={depth}
            onReplySuccess={onReplySuccess}
            currentUsername={currentUsername}
          />
          {reply.children && reply.children.length > 0 && (
            <div className="mt-3 space-y-3">
              <RenderReplyTree
                replies={reply.children}
                threadId={threadId}
                depth={depth + 1}
                onReplySuccess={onReplySuccess}
                currentUsername={currentUsername}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * ReplyList component - displays replies with nested structure
 * @param {Object} props
 * @param {string} props.threadId - Thread ID
 * @param {string} props.currentUsername - Current logged-in user's username
 * @param {string} props.className - Additional CSS classes
 */
export default function ReplyList({ threadId, currentUsername, className = "" }) {
  const {
    replies,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
    isLoadingMore,
  } = useReplies(threadId, { limit: 20 });

  const replyTree = buildReplyTree(replies);

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[var(--radius)] border bg-card p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-destructive mb-3">{error}</p>
        <Button variant="secondary" onClick={refetch}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  // Empty state
  if (replies.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-muted-foreground">
          Belum ada balasan. Jadilah yang pertama!
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Reply count */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {replies.length} Balasan
        </h3>
        <button
          onClick={refetch}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Reply tree */}
      <div className="space-y-3">
        <RenderReplyTree
          replies={replyTree}
          threadId={threadId}
          depth={0}
          onReplySuccess={refetch}
          currentUsername={currentUsername}
        />
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="text-center pt-4">
          <Button
            variant="secondary"
            onClick={loadMore}
            loading={isLoadingMore}
          >
            Muat Lebih Banyak
          </Button>
        </div>
      )}
    </div>
  );
}
