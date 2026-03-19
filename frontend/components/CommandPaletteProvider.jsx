"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Lazy load CommandPalette for better initial performance
const CommandPalette = dynamic(() => import("./CommandPalette"), {
  loading: () => null,
  ssr: false,
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

  const contextValue = useMemo(
    () => ({ isOpen, openCommandPalette, closeCommandPalette, toggleCommandPalette }),
    [isOpen, openCommandPalette, closeCommandPalette, toggleCommandPalette]
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      {isOpen ? <CommandPalette isOpen={isOpen} onClose={closeCommandPalette} /> : null}
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
