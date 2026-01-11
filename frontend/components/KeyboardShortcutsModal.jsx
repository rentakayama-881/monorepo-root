"use client";

import { useEffect } from "react";
import { KEYBOARD_SHORTCUTS, isMac } from "@/lib/useKeyboardShortcuts";

/**
 * Keyboard Shortcuts Help Modal
 * Shows all available keyboard shortcuts
 */
export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const userIsMac = isMac();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 animate-scale-in">
        <div className="mx-4 rounded-xl border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 4L4 12M4 4l8 8" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="shortcuts-modal">
              {/* General Shortcuts */}
              <div className="shortcuts-group">
                <h3 className="shortcuts-group-title mb-3">General</h3>
                <div className="space-y-2">
                  {KEYBOARD_SHORTCUTS.general
                    .filter(shortcut => {
                      // Filter based on platform
                      if (shortcut.mac !== undefined) {
                        return shortcut.mac === userIsMac;
                      }
                      return true;
                    })
                    .map((shortcut, index) => (
                      <div key={index} className="shortcut-item">
                        <span className="text-sm text-muted-foreground">
                          {shortcut.description}
                        </span>
                        <div className="shortcut-keys">
                          {shortcut.keys.map((key, i) => (
                            <kbd key={i} className="shortcut-keys kbd">
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Navigation Shortcuts */}
              <div className="shortcuts-group">
                <h3 className="shortcuts-group-title mb-3">Navigation</h3>
                <div className="space-y-2">
                  {KEYBOARD_SHORTCUTS.navigation.map((shortcut, index) => (
                    <div key={index} className="shortcut-item">
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="shortcut-keys">
                        {shortcut.keys.map((key, i) => (
                          <kbd key={i} className="shortcut-keys kbd">
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Shortcuts */}
              <div className="shortcuts-group">
                <h3 className="shortcuts-group-title mb-3">Actions</h3>
                <div className="space-y-2">
                  {KEYBOARD_SHORTCUTS.actions.map((shortcut, index) => (
                    <div key={index} className="shortcut-item">
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="shortcut-keys">
                        {shortcut.keys.map((key, i) => (
                          <kbd key={i} className="shortcut-keys kbd">
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted font-mono">?</kbd> anytime to see these shortcuts
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
