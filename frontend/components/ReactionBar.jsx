"use client";

import React from "react";
import { useReactions, REACTION_TYPES, REACTION_EMOJIS, REACTION_LABELS } from "@/lib/useReactions";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

/**
 * ReactionBar component - displays reaction buttons with counts
 * @param {Object} props
 * @param {string} props.threadId - Thread ID
 * @param {string} props.className - Additional CSS classes
 */
export default function ReactionBar({ threadId, className = "" }) {
  const {
    reactions,
    userReaction,
    totalCount,
    loading,
    isSubmitting,
    toggleReaction,
  } = useReactions(threadId);

  const { toast } = useToast();

  const handleReactionClick = async (reactionType) => {
    const token = getToken();
    if (!token) {
      toast.warning("Login Diperlukan", "Silakan login untuk memberi reaksi");
      return;
    }

    try {
      await toggleReaction(reactionType);
    } catch (err) {
      toast.error("Gagal", err.message);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {REACTION_TYPES.map((type) => (
          <div
            key={type}
            className="h-8 w-14 animate-pulse rounded-full bg-muted/50"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {REACTION_TYPES.map((type) => {
        const count = reactions[type] || 0;
        const isActive = userReaction === type;
        const emoji = REACTION_EMOJIS[type];
        const label = REACTION_LABELS[type];

        return (
          <button
            key={type}
            onClick={() => handleReactionClick(type)}
            disabled={isSubmitting}
            className={`
              group flex items-center gap-1.5 rounded-full border px-3 py-1.5
              text-sm font-medium transition-all duration-200
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }
            `}
            title={label}
            aria-label={`${label} (${count})`}
            aria-pressed={isActive}
          >
            <span className="text-base transition-transform group-hover:scale-110">
              {emoji}
            </span>
            {count > 0 && (
              <span className="min-w-[1rem] text-center tabular-nums">
                {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
              </span>
            )}
          </button>
        );
      })}

      {/* Total count badge */}
      {totalCount > 0 && (
        <span className="ml-2 text-xs text-muted-foreground">
          {totalCount} reaksi
        </span>
      )}
    </div>
  );
}
