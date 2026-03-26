import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeContext";

// Mock dependencies
jest.mock("../constants", () => ({
  STORAGE_KEYS: { THEME: "theme" },
}));

jest.mock("../logger", () => ({
  warn: jest.fn(),
}));

// Helper component that consumes the context
function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>Set Dark</button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset documentElement classes
    document.documentElement.classList.remove("light", "dark", "theme-switching");
    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it("ThemeProvider renders children", () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("useTheme provides theme, resolvedTheme, and setTheme", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toBeInTheDocument();
    expect(screen.getByTestId("resolved")).toBeInTheDocument();
  });

  it("defaults to system theme when localStorage is empty", () => {
    localStorage.getItem.mockReturnValue(null);

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("reads stored theme from localStorage on init", () => {
    localStorage.getItem.mockReturnValue("dark");

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });
});
