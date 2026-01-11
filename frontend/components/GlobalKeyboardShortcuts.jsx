"use client";

import { useState } from "react";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useCommandPalette } from "./CommandPaletteProvider";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";

/**
 * Global Keyboard Shortcuts Manager
 * Handles all keyboard shortcuts and shows the help modal
 */
export default function GlobalKeyboardShortcuts() {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const { toggleCommandPalette } = useCommandPalette();

  useKeyboardShortcuts({
    onCommandPalette: toggleCommandPalette,
    onSearch: () => {
      // Focus search input if it exists
      const searchInput = document.querySelector('input[type="search"]');
      if (searchInput) {
        searchInput.focus();
      }
    },
    onShowShortcuts: () => setShowShortcutsModal(true),
    enabled: true,
  });

  return (
    <KeyboardShortcutsModal
      isOpen={showShortcutsModal}
      onClose={() => setShowShortcutsModal(false)}
    />
  );
}
