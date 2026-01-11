"use client";

import { useCommandPalette } from "./CommandPaletteProvider";
import { isMac } from "@/lib/useKeyboardShortcuts";

/**
 * Command Palette Trigger Button
 * Shows in header to make command palette more discoverable
 */
export default function CommandPaletteTrigger() {
  const { openCommandPalette } = useCommandPalette();
  const userIsMac = typeof window !== "undefined" ? isMac() : false;

  return (
    <button
      onClick={openCommandPalette}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent transition-colors text-sm text-muted-foreground"
      aria-label="Open command palette"
      type="button"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span className="hidden lg:inline">Quick actions...</span>
      <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs rounded bg-muted font-mono border">
        {userIsMac ? "⌘" : "Ctrl"}K
      </kbd>
    </button>
  );
}
