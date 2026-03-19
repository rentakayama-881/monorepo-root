/**
 * Active shared constants that are still referenced across multiple frontend surfaces.
 * Endpoint contracts and feature-specific labels live in dedicated modules.
 */

// Date/Time Formats
export const DATE_FORMATS = {
  DISPLAY: {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
  DISPLAY_WITH_TIME: {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  SHORT: {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  SHORT_WITH_TIME: {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: "token",
  ADMIN_TOKEN: "admin_token",
  THEME: "theme",
  RECENT_SEARCHES: "recentSearches",
};

// Locked Categories (intake closed; cannot create new Validation Cases)
export const LOCKED_CATEGORIES = ["kolaborator-phd", "drama-korea"];
