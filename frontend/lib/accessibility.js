/**
 * Accessibility Utilities
 * Helper functions for ensuring WCAG 2.1 AA compliance
 */

/**
 * Parse a hex color string (#RGB, #RRGGBB, or #RRGGBBAA) into [R, G, B] in 0-255.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function parseHex(hex) {
  const h = hex.replace(/^#/, "");
  if (h.length === 3 || h.length === 4) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Compute relative luminance per WCAG 2.1 (§1.4.3).
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * @param {[number, number, number]} rgb - RGB channels 0-255
 * @returns {number} Luminance in [0, 1]
 */
function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Compute the contrast ratio between two hex colours.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number} Ratio (always >= 1)
 */
export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(parseHex(hex1));
  const l2 = relativeLuminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a colour pair meets WCAG AA contrast requirements.
 * @param {string} foreground - Hex colour (#RGB or #RRGGBB)
 * @param {string} background - Hex colour (#RGB or #RRGGBB)
 * @param {"normal"|"large"} [size="normal"] - Text size category
 * @returns {boolean} True when the ratio meets the AA threshold
 */
export function meetsContrastRatio(foreground, background, size = "normal") {
  const threshold = size === "large" ? 3 : 4.5;
  return contrastRatio(foreground, background) >= threshold;
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
