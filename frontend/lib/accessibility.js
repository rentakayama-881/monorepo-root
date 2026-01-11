/**
 * Accessibility Utilities
 * Helper functions for ensuring WCAG 2.1 AA compliance
 */

/**
 * Check if a color contrast ratio meets WCAG AA standards
 * Note: This is a placeholder for actual contrast checking.
 * In production, use a proper contrast checker library like 'color-contrast-checker'
 * or implement the WCAG luminance calculation algorithm.
 * @param {string} foreground - Foreground color in hex
 * @param {string} background - Background color in hex
 * @returns {boolean} - True if contrast ratio >= 4.5:1
 */
export function meetsContrastRatio(foreground, background) {
  // TODO: Implement actual contrast checking when needed
  // For now, we assume design tokens already meet WCAG AA requirements
  // This function is kept as a placeholder for future implementation
  console.warn('meetsContrastRatio is a placeholder. Use a proper contrast checker library for production.');
  return true;
}

/**
 * Generate accessible label from text
 * @param {string} text - Text to convert
 * @returns {string} - Accessible label
 */
export function generateAriaLabel(text) {
  return text.replace(/[^\w\s]/g, "").trim();
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export function announceToScreenReader(message, priority = "polite") {
  if (typeof window === "undefined") return;

  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Trap focus within an element (for modals)
 * @param {HTMLElement} element - Element to trap focus within
 * @returns {Function} - Cleanup function
 */
export function trapFocus(element) {
  if (!element) return () => {};

  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  element.addEventListener("keydown", handleTabKey);

  // Focus first element
  firstElement?.focus();

  return () => {
    element.removeEventListener("keydown", handleTabKey);
  };
}

/**
 * Screen reader only class (hide visually but keep for screen readers)
 */
export const SR_ONLY_CLASS = "sr-only";

/**
 * Get heading level based on context
 * Ensures proper heading hierarchy
 */
export function getHeadingLevel(currentLevel = 1, increment = 1) {
  return Math.min(Math.max(currentLevel + increment, 1), 6);
}
