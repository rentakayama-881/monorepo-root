"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";
import { STORAGE_KEYS } from "@/lib/constants";

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

  // Define all available commands
  const commands = useMemo(() => [
    // Navigation
    {
      id: "nav-home",
      group: "Navigation",
      title: "Go to Home",
      icon: "HOME",
      action: () => router.push("/"),
      keywords: ["home", "beranda", "dashboard"],
    },
    {
      id: "nav-case-index",
      group: "Navigation",
      title: "Go to Validation Case Index",
      icon: "INDEX",
      action: () => router.push("/validation-cases"),
      keywords: ["validation", "case", "index", "registry", "docket"],
    },
    {
      id: "nav-my-cases",
      group: "Navigation",
      title: "Go to My Validation Cases",
      icon: "MINE",
      action: () => router.push("/account/validation-cases"),
      keywords: ["my", "cases", "validation", "docket"],
    },
    {
      id: "nav-about",
      group: "Navigation",
      title: "Go to About",
      icon: "ABOUT",
      action: () => router.push("/about-content"),
      keywords: ["about", "tentang"],
    },
    {
      id: "nav-rules",
      group: "Navigation",
      title: "Go to Rules",
      icon: "RULES",
      action: () => router.push("/rules-content"),
      keywords: ["rules", "aturan", "peraturan"],
    },
    {
      id: "nav-account",
      group: "Navigation",
      title: "Go to Settings",
      icon: "SET",
      action: () => router.push("/account"),
      keywords: ["settings", "pengaturan", "account", "akun"],
    },
    
    // Actions
    {
      id: "action-search",
      group: "Actions",
      title: "Search",
      icon: "FIND",
      action: () => {
        onClose();
        setTimeout(() => {
          const searchInput = document.querySelector('input[type="search"]');
          if (searchInput) searchInput.focus();
        }, 100);
      },
      keywords: ["search", "cari", "find", "filter"],
    },
    {
      id: "action-theme-light",
      group: "Actions",
      title: "Switch to Light Mode",
      icon: "LIGHT",
      action: () => setTheme("light"),
      keywords: ["theme", "light", "terang", "bright"],
      hidden: theme === "light",
    },
    {
      id: "action-theme-dark",
      group: "Actions",
      title: "Switch to Dark Mode",
      icon: "DARK",
      action: () => setTheme("dark"),
      keywords: ["theme", "dark", "gelap", "night"],
      hidden: theme === "dark",
    },
    {
      id: "action-theme-system",
      group: "Actions",
      title: "Use System Theme",
      icon: "AUTO",
      action: () => setTheme("system"),
      keywords: ["theme", "system", "auto", "sistem"],
      hidden: theme === "system",
    },
  ], [router, theme, setTheme, onClose]);

  // Fuzzy search matching
  const filteredCommands = useMemo(() => {
    if (!search) return commands.filter(cmd => !cmd.hidden);

    const searchLower = search.toLowerCase();
    return commands
      .filter(cmd => !cmd.hidden)
      .filter(cmd => {
        const titleMatch = cmd.title.toLowerCase().includes(searchLower);
        const keywordMatch = cmd.keywords.some(kw => kw.toLowerCase().includes(searchLower));
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
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      // Load recent searches from localStorage
      try {
        const recent = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES) || "[]");
        setRecentSearches(recent);
      } catch (error) {
        console.warn("Failed to load recent searches:", error);
        setRecentSearches([]);
      }
      // Focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
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
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Keep selected item in view
  useEffect(() => {
    const selectedElement = document.querySelector('[data-selected="true"]');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const executeCommand = (command) => {
    // Save to recent searches
    const recent = [command.id, ...recentSearches.filter(id => id !== command.id)].slice(0, 5);
    setRecentSearches(recent);
    try {
      localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(recent));
    } catch (error) {
      // Ignore localStorage errors (e.g., quota exceeded, private browsing)
      console.warn("Failed to save recent searches:", error);
    }

    // Execute command
    command.action();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="command-palette-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command Palette */}
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
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
