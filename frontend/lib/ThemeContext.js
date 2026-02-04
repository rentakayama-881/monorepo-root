"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { STORAGE_KEYS } from "./constants";

const ThemeContext = createContext({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

function resolveThemeValue(theme) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("system");
  const [resolvedTheme, setResolvedTheme] = useState("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "system";
      setThemeState(storedTheme);
    } catch (error) {
      // localStorage unavailable (e.g., private browsing)
      console.warn("localStorage unavailable, using default theme:", error);
      setThemeState("system");
    }
  }, []);

  // Update resolved theme based on current theme and system preference
  useEffect(() => {
    if (!mounted) return;

    const updateResolvedTheme = () => {
      let resolved = theme;
      
      if (theme === "system") {
        resolved = resolveThemeValue("system");
      }

      setResolvedTheme(resolved);

      // Update document class
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
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
  }, [theme, mounted]);

  const setTheme = (newTheme) => {
    if (!mounted) return;
    
    const root = document.documentElement;
    const resolved = resolveThemeValue(newTheme);

    // Apply immediately for responsive UI
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    setResolvedTheme(resolved);
    setThemeState(newTheme);
    
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    } catch (error) {
      // localStorage unavailable (e.g., private browsing, quota exceeded)
      console.warn("Failed to save theme to localStorage:", error);
    }
  };

  // Prevent flash of unstyled content
  if (!mounted) {
    return null;
  }

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
