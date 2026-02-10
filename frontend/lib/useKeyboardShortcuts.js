"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Custom hook for global keyboard shortcuts
 * Handles multi-key sequences (like vim-style "g" then "h")
 */
export function useKeyboardShortcuts({
  onCommandPalette,
  onSearch,
  onNewValidationCase,
  onShowShortcuts,
  enabled = true,
}) {
  const router = useRouter();
  const sequenceRef = useRef([]);
  const sequenceTimeoutRef = useRef(null);

  const resetSequence = useCallback(() => {
    sequenceRef.current = [];
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
  }, []);

  const addToSequence = useCallback((key) => {
    sequenceRef.current.push(key);
    
    // Reset sequence after 1 second of inactivity
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
    }
    sequenceTimeoutRef.current = setTimeout(resetSequence, 1000);
    
    return sequenceRef.current;
  }, [resetSequence]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = e.target;
      const isInput = 
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Command Palette: ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (onCommandPalette) onCommandPalette();
        resetSequence();
        return;
      }

      // Focus Search: ⌘/ or Ctrl+/
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        if (onSearch) onSearch();
        resetSequence();
        return;
      }

      // Escape: Close modals/dropdowns
      if (e.key === "Escape") {
        // Let individual components handle their own escape logic
        resetSequence();
        return;
      }

      // Show keyboard shortcuts: ?
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        if (onShowShortcuts) onShowShortcuts();
        resetSequence();
        return;
      }

      // Don't process vim-style shortcuts when typing
      if (isInput) {
        resetSequence();
        return;
      }

      // Vim-style navigation shortcuts
      if (e.key === "g" || e.key === "G") {
        const sequence = addToSequence("g");
        
        // Check if this is the second "g" in sequence
        if (sequence.length === 2 && sequence[0] === "g") {
          e.preventDefault();
          
          const secondKey = sequence[1];
          
          // G then H - Go to Home
          if (secondKey === "h" || secondKey === "H") {
            router.push("/");
          }
          // G then T - Go to Validation Case Index
          else if (secondKey === "t" || secondKey === "T") {
            router.push("/validation-cases");
          }
          // G then S - Go to Settings
          else if (secondKey === "s" || secondKey === "S") {
            router.push("/account");
          }
          
          resetSequence();
        }
      } else if (sequenceRef.current.length > 0 && sequenceRef.current[0] === "g") {
        // Second key in vim sequence
        e.preventDefault();
        addToSequence(e.key);
      }
      // N - New Validation Case (context-sensitive, handled by page)
      else if (e.key === "n" || e.key === "N") {
        if (!isInput && onNewValidationCase) {
          e.preventDefault();
          onNewValidationCase();
        }
        resetSequence();
      }
      else {
        // Any other key resets the sequence
        resetSequence();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, [enabled, onCommandPalette, onSearch, onNewValidationCase, onShowShortcuts, router, resetSequence, addToSequence]);

  return { resetSequence };
}

/**
 * Keyboard shortcuts configuration
 * Used by the shortcuts modal to display available shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  general: [
    { keys: ["⌘", "K"], description: "Open command palette", mac: true },
    { keys: ["Ctrl", "K"], description: "Open command palette", mac: false },
    { keys: ["⌘", "/"], description: "Focus search", mac: true },
    { keys: ["Ctrl", "/"], description: "Focus search", mac: false },
    { keys: ["?"], description: "Show keyboard shortcuts" },
    { keys: ["Esc"], description: "Close modal/dropdown" },
  ],
  navigation: [
    { keys: ["G", "H"], description: "Go to Home" },
    { keys: ["G", "T"], description: "Go to Validation Case Index" },
    { keys: ["G", "S"], description: "Go to Settings" },
  ],
  actions: [
    { keys: ["N"], description: "New Validation Case (on index page)" },
  ],
};

/**
 * Detect if user is on Mac
 */
export function isMac() {
  if (typeof window === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}
