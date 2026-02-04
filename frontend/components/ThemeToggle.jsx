"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/ThemeContext";

/**
 * Theme Switcher (Vercel-style)
 * Clear menu for Light / Dark / System
 */
export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  const options = [
    { value: "light", label: "Light", icon: SunIcon },
    { value: "dark", label: "Dark", icon: MoonIcon },
    { value: "system", label: "System", icon: SystemIcon },
  ];

  const ButtonIcon = resolvedTheme === "dark" ? MoonIcon : SunIcon;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors press-effect"
        aria-label={`Theme: ${theme}`}
        aria-haspopup="menu"
        aria-expanded={open}
        type="button"
      >
        <ButtonIcon className="h-4 w-4 text-foreground" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-[var(--radius)] border bg-popover shadow-lg animate-scale-in"
          role="menu"
          aria-label="Theme"
        >
          <div className="p-1">
            {options.map(({ value, label, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTheme(value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                    active ? "bg-accent text-foreground" : "text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{label}</span>
                  </span>
                  {active ? <CheckIcon className="h-4 w-4 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SunIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v2.25M12 18.75V21M4.22 4.22l1.59 1.59M18.19 18.19l1.59 1.59M3 12h2.25M18.75 12H21M4.22 19.78l1.59-1.59M18.19 5.81l1.59-1.59" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function MoonIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function SystemIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.5Z" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function CheckIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
