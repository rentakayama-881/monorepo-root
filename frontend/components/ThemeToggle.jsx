"use client";

import { useTheme } from "@/lib/ThemeContext";

/**
 * Theme Toggle Button
 * Allows users to switch between light, dark, and system themes
 */
export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors press-effect"
      aria-label={`Current theme: ${theme}. Click to change theme.`}
      title={`Theme: ${theme}`}
      type="button"
    >
      {resolvedTheme === "dark" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground"
        >
          <path d="M8 1v2M8 13v2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M1 8h2M13 8h2M3.5 12.5l1.5-1.5M11 5l1.5-1.5" />
          <circle cx="8" cy="8" r="3" fill="currentColor" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="text-foreground"
        >
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM4.5 7.5a3.5 3.5 0 0 1 6.95-.5h-6.9a3.5 3.5 0 0 0-.05.5z" />
        </svg>
      )}
    </button>
  );
}
