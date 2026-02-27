/**
 * Formatting utilities
 * Centralized formatters for dates, currency, etc.
 */

import { DATE_FORMATS } from "./constants";

/**
 * Format number as Indonesian Rupiah currency
 * @param {number} value - The value to format
 * @param {boolean} showSymbol - Whether to show "Rp" prefix
 * @returns {string}
 */
export function formatCurrency(value, showSymbol = true) {
  if (value === null || value === undefined) return "-";
  const formatted = Number(value).toLocaleString("id-ID");
  return showSymbol ? `Rp ${formatted}` : formatted;
}

/**
 * Alias for formatCurrency – used across validation-case pages.
 * @param {number} amount
 * @returns {string}
 */
export const formatIDR = formatCurrency;

/**
 * Parse currency input (remove non-digit characters)
 * @param {string} value - The input value
 * @returns {number}
 */
export function parseCurrencyInput(value) {
  const cleaned = String(value).replace(/\D/g, "");
  return parseInt(cleaned, 10) || 0;
}

/**
 * Format currency input for display (with thousand separators)
 * @param {string} value - The input value
 * @returns {string}
 */
export function formatCurrencyInput(value) {
  const num = parseCurrencyInput(value);
  if (isNaN(num) || num === 0) return "";
  return num.toLocaleString("id-ID");
}

/**
 * Format date for display
 * @param {string|Date} date - The date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(date, options = DATE_FORMATS.DISPLAY) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("id-ID", options);
  } catch {
    return "-";
  }
}

/**
 * Format date with time
 * @param {string|Date} date - The date to format
 * @returns {string}
 */
export function formatDateTime(date) {
  return formatDate(date, DATE_FORMATS.DISPLAY_WITH_TIME);
}

/**
 * Format relative time (e.g., "2 jam yang lalu")
 * @param {string|Date} date - The date to format
 * @returns {string}
 */
export function formatRelativeTime(date) {
  if (!date) return "-";
  
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  if (diffHour < 24) return `${diffHour} jam yang lalu`;
  if (diffDay < 7) return `${diffDay} hari yang lalu`;
  
  return formatDate(date, DATE_FORMATS.SHORT);
}

/**
 * Format deadline/countdown
 * @param {string|Date} deadline - The deadline date
 * @returns {{ text: string, isExpired: boolean, isUrgent: boolean }}
 */
export function formatDeadline(deadline) {
  if (!deadline) return { text: "-", isExpired: false, isUrgent: false };
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate - now;
  
  if (diffMs < 0) {
    return { text: "Kedaluwarsa", isExpired: true, isUrgent: false };
  }
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  
  let text;
  if (diffDays > 0) {
    text = `${diffDays} hari ${remainingHours} jam`;
  } else if (diffHours > 0) {
    text = `${diffHours} jam`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    text = `${diffMinutes} menit`;
  }
  
  return {
    text,
    isExpired: false,
    isUrgent: diffHours < 24,
  };
}

/**
 * Truncate text with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
export function truncateText(text, maxLength = 50) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Format username for display (handle null)
 * @param {string|null} username - The username
 * @param {string} fallback - Fallback text
 * @returns {string}
 */
export function formatUsername(username, fallback = "Anonymous") {
  return username || fallback;
}

/**
 * Get initials from username
 * @param {string} username - The username
 * @returns {string}
 */
export function getInitials(username) {
  if (!username) return "?";
  return username.slice(0, 2).toUpperCase();
}
