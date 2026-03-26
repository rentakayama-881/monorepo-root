"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";
import { STORAGE_KEYS } from "@/lib/constants";
import logger from "@/lib/logger";
import { buildCommands } from "./commandPaletteCommands";

/**
 * Command Palette Component
 * Accessible via ⌘K (Mac) or Ctrl+K (Windows)
 */
export default function CommandPalette({ isOpen, onClose }) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const commands = useMemo(
    () => buildCommands({ router, theme, setTheme, onClose }),
    [router, theme, setTheme, onClose]
  );

  // Fuzzy search matching
  const filteredCommands = useMemo(() => {
    if (!search) return commands.filter((cmd) => !cmd.hidden);

    const searchLower = search.toLowerCase();
    return commands
      .filter((cmd) => !cmd.hidden)
      .filter((cmd) => {
        const titleMatch = cmd.title.toLowerCase().includes(searchLower);
        const keywordMatch = cmd.keywords.some((kw) => kw.toLowerCase().includes(searchLower));
        return titleMatch || keywordMatch;
      })
      .sort((a, b) => {
        // Prioritize title matches over keyword matches
        const aTitle = a.title.toLowerCase().startsWith(searchLower);
        const bTitle = b.title.toLowerCase().startsWith(searchLower);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        return 0;
      });
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset state when opened
  useEffect(() => {
    if (!isOpen) return;

    const resetTimer = setTimeout(() => {
      setSearch("");
      setSelectedIndex(0);
      try {
        const recent = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES) || "[]");
        setRecentSearches(recent);
      } catch (error) {
        logger.warn("Failed to load recent searches:", error);
        setRecentSearches([]);
      }
    }, 0);

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(resetTimer);
      clearTimeout(focusTimer);
    };
  }, [isOpen]);

  const executeCommand = useCallback(
    (command) => {
      const recent = [command.id, ...recentSearches.filter((id) => id !== command.id)].slice(0, 5);
      setRecentSearches(recent);
      try {
        localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(recent));
      } catch (error) {
        logger.warn("Failed to save recent searches:", error);
      }

      command.action();
      onClose();
    },
    [onClose, recentSearches]
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose, executeCommand]);

  // Keep selected item in view
  useEffect(() => {
    const selectedElement = document.querySelector('[data-selected="true"]');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="command-palette-overlay"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Command Palette */}
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="Type a command or search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedIndex(0);
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />

        {/* Results */}
        <div className="command-palette-results custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([group, items]) => (
              <div key={group} className="command-palette-group">
                <div className="command-palette-group-title">{group}</div>
                {items.map((cmd, index) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  return (
                    <div
                      key={cmd.id}
                      className="command-palette-item"
                      data-selected={globalIndex === selectedIndex}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      role="button"
                      tabIndex={-1}
                    >
                      <span className="command-palette-item-icon" aria-hidden="true">
                        {cmd.icon}
                      </span>
                      <span className="flex-1">{cmd.title}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Enter</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
