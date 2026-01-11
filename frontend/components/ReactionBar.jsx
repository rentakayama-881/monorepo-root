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
              group relative flex items-center gap-1.5 rounded-full border px-3 py-1.5
              text-sm font-medium transition-all duration-200
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:scale-105 active:scale-95
              ${
                isActive
                  ? "reaction-active border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }
            `}
            title={label}
            aria-label={`${label} (${count})`}
            aria-pressed={isActive}
          >
            <span className={`text-base transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
              {emoji}
            </span>
            {count > 0 && (
              <span className="min-w-[1rem] text-center tabular-nums font-semibold">
                {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
              </span>
            )}
            
            {/* Tooltip */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              {label}
              <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></span>
            </span>
          </button>
        );
      })}

      {/* Total count badge */}
      {totalCount > 0 && (
        <span className="ml-1 px-2 py-1 text-xs font-medium text-muted-foreground bg-secondary rounded-full">
          {totalCount} {totalCount === 1 ? 'reaksi' : 'reaksi'}
        </span>
      )}
    </div>
  );
}
