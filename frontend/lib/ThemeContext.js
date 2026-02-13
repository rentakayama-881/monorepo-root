"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { STORAGE_KEYS } from "./constants";

const ThemeContext = createContext({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

function writeThemeCookie(theme) {
  if (typeof document === "undefined") return;
  if (theme !== "light" && theme !== "dark" && theme !== "system") return;

  // Keep it JS-writeable (not HttpOnly) so the client can update it immediately.
  // SSR uses this to set the initial <html> class and avoid theme flash on refresh.
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `theme=${encodeURIComponent(theme)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function resolveThemeValue(theme) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function withoutThemeTransition(callback) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  callback();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
    });
  });
}

function applyResolvedTheme(resolved, disableTransition = false) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  };
  if (disableTransition) {
    withoutThemeTransition(apply);
    return;
  }
  apply();
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "system";
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) || "system";
    } catch {
      return "system";
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  // Update resolved theme based on current theme and system preference
  useEffect(() => {
    const updateResolvedTheme = () => {
      let resolved = theme;
      
      if (theme === "system") {
        resolved = resolveThemeValue("system");
      }

      setResolvedTheme(resolved);

      applyResolvedTheme(resolved, true);
    };

    updateResolvedTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Ensure SSR can render the right theme on subsequent requests.
  useEffect(() => {
    try {
      writeThemeCookie(theme);
    } catch (_) {}
  }, [theme]);

  const setTheme = (newTheme) => {
    const resolved = resolveThemeValue(newTheme);

    // Apply immediately for responsive UI
    applyResolvedTheme(resolved, true);
    setResolvedTheme(resolved);
    setThemeState(newTheme);
    
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
      writeThemeCookie(newTheme);
    } catch (error) {
      // localStorage unavailable (e.g., private browsing, quota exceeded)
      console.warn("Failed to save theme to localStorage:", error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
