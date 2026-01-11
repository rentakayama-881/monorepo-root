"use client";

import { useEffect, useState } from "react";

/**
 * Back to Top Button
 * Shows when user scrolls down and allows quick return to top
 */
export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when page is scrolled down 300px
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", toggleVisibility);
    toggleVisibility(); // Check initial state

    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleKeyDown = (e) => {
    // Support Enter and Space keys for better accessibility
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      scrollToTop();
    }
  };

  return (
    <button
      onClick={scrollToTop}
      onKeyDown={handleKeyDown}
      className={`back-to-top ${isVisible ? "visible" : ""}`}
      aria-label="Back to top"
      type="button"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow press-effect">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </div>
    </button>
  );
}
