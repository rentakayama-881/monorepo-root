"use client";

import { createContext, useContext, useState, useCallback } from "react";
import dynamic from "next/dynamic";

// Lazy load CommandPalette for better initial performance
const CommandPalette = dynamic(() => import("./CommandPalette"), {
  loading: () => null,
  ssr: false,
  // Handle loading errors gracefully
  onError: (error) => {
    console.error("Failed to load CommandPalette:", error);
  },
});

const CommandPaletteContext = createContext({
  isOpen: false,
  openCommandPalette: () => {},
  closeCommandPalette: () => {},
  toggleCommandPalette: () => {},
});

export function CommandPaletteProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openCommandPalette = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        openCommandPalette,
        closeCommandPalette,
        toggleCommandPalette,
      }}
    >
      {children}
      <CommandPalette isOpen={isOpen} onClose={closeCommandPalette} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}
