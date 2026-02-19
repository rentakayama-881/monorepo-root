/**
 * Application constants
 * Centralized place for all constant values
 */

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    ME: "/api/user/me",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
    VERIFY_EMAIL: "/api/auth/verify-email",
  },
  // Wallet
  WALLET: {
    BALANCE: "/api/wallet/balance",
    DEPOSIT: "/api/wallet/deposit",
    WITHDRAW: "/api/withdrawals",
    SET_PIN: "/api/wallet/set-pin",
    CHANGE_PIN: "/api/wallet/change-pin",
  },
  // Transfers
  TRANSFERS: {
    LIST: "/api/transfers",
    SEARCH_USER: "/api/transfers/search-user",
    ACCEPT: (id) => `/api/transfers/${id}/accept`,
    DISPUTE: (id) => `/api/transfers/${id}/dispute`,
  },
  // Disputes
  DISPUTES: {
    LIST: "/api/disputes",
    DETAIL: (id) => `/api/disputes/${id}`,
    MESSAGE: (id) => `/api/disputes/${id}/message`,
    EVIDENCE: (id) => `/api/disputes/${id}/evidence`,
  },
  // Validation Cases
  VALIDATION_CASES: {
    LIST: "/api/validation-cases",
    CREATE: "/api/validation-cases",
    DETAIL: (id) => `/api/validation-cases/${id}`,
  },
  // Health
  HEALTH: "/api/health",
};

// Status Colors/Styles
export const STATUS_STYLES = {
  transfer: {
    held: "bg-warning/10 text-warning border-warning/30",
    released: "bg-success/10 text-success border-success/30",
    refunded: "bg-primary/10 text-primary border-primary/30",
    disputed: "bg-destructive/10 text-destructive border-destructive/30",
    expired: "bg-muted/60 text-muted-foreground border-border",
  },
  dispute: {
    negotiation: "bg-warning/10 text-warning border-warning/30",
    evidence: "bg-accent text-accent-foreground border-border",
    admin_review: "bg-primary/10 text-primary border-primary/30",
    resolved: "bg-success/10 text-success border-success/30",
  },
};

// Status Labels
export const STATUS_LABELS = {
  transfer: {
    held: "Held",
    released: "Released",
    refunded: "Refunded",
    disputed: "Disputed",
    expired: "Expired",
  },
  dispute: {
    open: "Active",
    resolved: "Resolved",
  },
  phase: {
    negotiation: "Negotiation",
    evidence: "Evidence Collection",
    admin_review: "Review Admin",
  },
};

// Validation Rules
export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 7,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
  },
  PIN: {
    LENGTH: 6,
  },
  TRANSFER: {
    MIN_AMOUNT: 10000,
    MAX_AMOUNT: 100000000,
    MIN_HOLD_DAYS: 1,
    MAX_HOLD_DAYS: 30,
  },
  DEPOSIT: {
    MIN_AMOUNT: 10000,
    MAX_AMOUNT: 100000000,
  },
  WITHDRAW: {
    MIN_AMOUNT: 50000,
    MAX_AMOUNT: 100000000,
  },
};

// Quick Amount Options
export const QUICK_AMOUNTS = {
  deposit: [50000, 100000, 200000, 500000, 1000000],
  withdraw: [100000, 250000, 500000, 1000000],
};

// Available Banks for Withdrawal
export const BANKS = [
  { code: "bca", name: "Bank Central Asia (BCA)" },
  { code: "bni", name: "Bank Negara Indonesia (BNI)" },
  { code: "bri", name: "Bank Rakyat Indonesia (BRI)" },
  { code: "mandiri", name: "Bank Mandiri" },
  { code: "cimb", name: "CIMB Niaga" },
  { code: "permata", name: "Bank Permata" },
  { code: "danamon", name: "Bank Danamon" },
  { code: "bsi", name: "Bank Syariah Indonesia (BSI)" },
];

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

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
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: "token",
  ADMIN_TOKEN: "admin_token",
  THEME: "theme",
  RECENT_SEARCHES: "recentSearches",
};

// Locked Categories (intake closed; cannot create new Validation Cases)
export const LOCKED_CATEGORIES = [
  "kolaborator-phd",
  "drama-korea",
];
