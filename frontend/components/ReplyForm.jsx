"use client";

import React, { useState, useRef, useEffect } from "react";
import Button from "@/components/ui/Button";
import MarkdownPreview from "@/components/ui/MarkdownPreview";
import { useCreateReply } from "@/lib/useReplies";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

/**
 * ReplyForm component - form for creating/editing replies with markdown support
 * @param {Object} props
 * @param {string} props.threadId - Thread ID
 * @param {string} props.parentReplyId - Parent reply ID (for nested replies)
 * @param {Function} props.onSuccess - Callback after successful submission
 * @param {Function} props.onCancel - Callback for cancel action
 * @param {string} props.placeholder - Textarea placeholder
 * @param {boolean} props.compact - Compact mode for nested replies
 * @param {string} props.className - Additional CSS classes
 */
export default function ReplyForm({
  threadId,
  parentReplyId = null,
  onSuccess,
  onCancel,
  placeholder = "Tulis balasan...",
  compact = false,
  className = "",
}) {
  const [content, setContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);
  const { toast } = useToast();
  const { createReply, loading } = useCreateReply();

  const isLoggedIn = !!getToken();
  const canSubmit = content.trim().length > 0 && !loading;
  const maxLength = 10000;
  const remainingChars = maxLength - content.length;

  // Auto-focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !compact) {
      textareaRef.current.focus();
    }
  }, [compact]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      toast.warning("Login Diperlukan", "Silakan login untuk membalas");
      return;
    }

    if (!canSubmit) return;

    try {
      await createReply(threadId, content.trim(), parentReplyId);
      toast.success("Berhasil", "Balasan berhasil dikirim");
      setContent("");
      setShowPreview(false);
      onSuccess?.();
    } catch (err) {
      toast.error("Gagal", err.message);
    }
  };

  const handleKeyDown = (e) => {
    // Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) {
        handleSubmit(e);
      }
    }
  };

  // Toolbar actions for markdown
  const insertMarkdown = (before, after = "", defaultText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const text = selected || defaultText;

    const newContent =
      content.substring(0, start) + before + text + after + content.substring(end);
    setContent(newContent);

    // Restore focus and selection
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = start + before.length + text.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  if (!isLoggedIn) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-sm text-[rgb(var(--muted))]">
          <a href="/login" className="text-[rgb(var(--brand))] hover:underline">
            Login
          </a>{" "}
          untuk membalas thread ini
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${className}`}>
      {/* Toolbar */}
      {!compact && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => insertMarkdown("**", "**", "tebal")}
            className="p-1.5 rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] transition-colors"
            title="Bold (Ctrl+B)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 2a1 1 0 00-1 1v10a1 1 0 001 1h5.5a3.5 3.5 0 001.852-6.47A3.5 3.5 0 008.5 2H4zm4.5 5a1.5 1.5 0 100-3H5v3h3.5zM5 9v3h4.5a1.5 1.5 0 000-3H5z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("*", "*", "miring")}
            className="p-1.5 rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] transition-colors"
            title="Italic (Ctrl+I)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M6 2.75A.75.75 0 016.75 2h6.5a.75.75 0 010 1.5h-2.505l-3.858 9H9.25a.75.75 0 010 1.5h-6.5a.75.75 0 010-1.5h2.505l3.858-9H6.75A.75.75 0 016 2.75z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("`", "`", "kode")}
            className="p-1.5 rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] transition-colors"
            title="Inline Code"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("[", "](url)", "teks link")}
            className="p-1.5 rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] transition-colors"
            title="Link (Ctrl+K)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.025 5.45a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25z"/>
            </svg>
          </button>

          <div className="flex-1" />

          {/* Preview toggle */}
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showPreview
                ? "bg-[rgb(var(--brand))] text-white"
                : "text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))]"
            }`}
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>
      )}

      {/* Textarea or Preview */}
      {showPreview ? (
        <div className="min-h-[100px] rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
          {content.trim() ? (
            <MarkdownPreview content={content} />
          ) : (
            <p className="text-sm text-[rgb(var(--muted))] italic">
              Tidak ada konten untuk di-preview
            </p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          maxLength={maxLength}
          rows={compact ? 3 : 5}
          className={`
            w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))]
            px-3 py-2 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))]
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
            focus-visible:outline-[rgb(var(--brand))] resize-y min-h-[80px]
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-[rgb(var(--muted))]">
          {remainingChars < 500 && (
            <span className={remainingChars < 100 ? "text-[rgb(var(--error))]" : ""}>
              {remainingChars} karakter tersisa
            </span>
          )}
          {!compact && (
            <span className="ml-2">
              Markdown didukung • Ctrl+Enter untuk kirim
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Batal
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!canSubmit}
          >
            {loading ? "Mengirim..." : "Kirim"}
          </Button>
        </div>
      </div>
    </form>
  );
}
