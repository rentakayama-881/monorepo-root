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
      className="relative"
      style={{ marginLeft: paddingLeft }}
    >
      {/* Connector line for nested replies */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px bg-[rgb(var(--border))]"
          style={{ left: "-12px" }}
        />
      )}

      <div
        className={`
          rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4
          ${reply.isDeleted ? "opacity-60" : ""}
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar
            src={reply.avatarUrl}
            name={reply.username}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-[rgb(var(--fg))] truncate">
                {reply.username || "Anonim"}
              </span>
              {depth > 0 && (
                <span className="text-xs text-[rgb(var(--muted))]">
                  • Balasan level {depth}
                </span>
              )}
            </div>
            <div className="text-xs text-[rgb(var(--muted))]">
              {formatRelativeTime(reply.createdAt)}
              {reply.updatedAt && reply.updatedAt !== reply.createdAt && (
                <span className="ml-1">(diedit)</span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="text-sm">
          {reply.isDeleted ? (
            <p className="italic text-[rgb(var(--muted))]">
              [Balasan telah dihapus]
            </p>
          ) : (
            <MarkdownPreview content={reply.content} />
          )}
        </div>

        {/* Actions */}
        {!reply.isDeleted && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[rgb(var(--border))]">
            {canReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--brand))] transition-colors"
              >
                {showReplyForm ? "Batal" : "Balas"}
              </button>
            )}

            {isAuthor && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--error))] transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            )}
          </div>
        )}

        {/* Reply form */}
        {showReplyForm && (
          <div className="mt-3 pt-3 border-t border-[rgb(var(--border))]">
            <ReplyForm
              threadId={threadId}
              parentReplyId={reply.id}
              onSuccess={handleReplySuccess}
              onCancel={() => setShowReplyForm(false)}
              placeholder={`Balas ke ${reply.username}...`}
              compact
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
            className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
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
        <p className="text-[rgb(var(--error))] mb-3">{error}</p>
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
        <p className="text-[rgb(var(--muted))]">
          Belum ada balasan. Jadilah yang pertama!
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Reply count */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[rgb(var(--fg))]">
          {replies.length} Balasan
        </h3>
        <button
          onClick={refetch}
          className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--brand))] transition-colors"
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
