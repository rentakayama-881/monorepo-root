/**
 * Feature Service API endpoint constants.
 * Extracted from featureApi.js for modularity.
 */

export const FEATURE_ENDPOINTS = {
  // Health
  HEALTH: "/api/v1/health",

  // Documents
  DOCUMENTS: {
    LIST: "/api/v1/documents",
    UPLOAD: "/api/v1/documents",
    DETAIL: (id) => `/api/v1/documents/${id}`,
    VIEW: (id) => `/api/v1/documents/${id}/view`,
    DOWNLOAD: (id) => `/api/v1/documents/${id}/download`,
    DELETE: (id) => `/api/v1/documents/${id}`,
    STATS: "/api/v1/documents/stats",
    PUBLIC: (userId) => `/api/v1/documents/user/${userId}`,
    CATEGORIES: "/api/v1/documents/categories",
  },

  // Wallets
  WALLETS: {
    ME: "/api/v1/wallets/me",
    PIN_STATUS: "/api/v1/wallets/pin/status",
    PIN_SET: "/api/v1/wallets/pin/set",
    PIN_VERIFY: "/api/v1/wallets/pin/verify",
    TRANSACTIONS: "/api/v1/wallets/transactions",
    DEPOSITS: "/api/v1/wallets/deposits",
    DEPOSITS_PENDING: "/api/v1/wallets/deposits/pending",
    DEPOSIT_STATUS: (id) => `/api/v1/wallets/deposits/${id}/status`,
    DEPOSIT_CANCEL: (id) => `/api/v1/wallets/deposits/${id}/cancel`,
  },

  // Transfers (Escrow)
  TRANSFERS: {
    LIST: "/api/v1/wallets/transfers",
    CREATE: "/api/v1/wallets/transfers",
    DETAIL: (id) => `/api/v1/wallets/transfers/${id}`,
    BY_CODE: (code) => `/api/v1/wallets/transfers/code/${code}`,
    RELEASE: (id) => `/api/v1/wallets/transfers/${id}/release`,
    CANCEL: (id) => `/api/v1/wallets/transfers/${id}/cancel`,
    REJECT: (id) => `/api/v1/wallets/transfers/${id}/reject`,
    SEARCH_USER: "/api/v1/wallets/transfers/search-user",
  },

  // Withdrawals
  WITHDRAWALS: {
    LIST: "/api/v1/wallets/withdrawals",
    CREATE: "/api/v1/wallets/withdrawals",
    DETAIL: (id) => `/api/v1/wallets/withdrawals/${id}`,
    CANCEL: (id) => `/api/v1/wallets/withdrawals/${id}/cancel`,
    CURRENCIES: "/api/v1/wallets/withdrawals/currencies",
  },

  // Disputes
  DISPUTES: {
    LIST: "/api/v1/disputes",
    CREATE: "/api/v1/disputes",
    DETAIL: (id) => `/api/v1/disputes/${id}`,
    RESPOND: (id) => `/api/v1/disputes/${id}/respond`,
    MESSAGES: (id) => `/api/v1/disputes/${id}/messages`,
    EVIDENCE: (id) => `/api/v1/disputes/${id}/evidence`,
  },

  // Admin Moderation
  ADMIN: {
    DASHBOARD: "/api/v1/admin/moderation/dashboard",
    DEVICE_BANS: "/api/v1/admin/moderation/device-bans",
    DEVICE_BAN_DETAIL: (id) => `/api/v1/admin/moderation/device-bans/${id}`,
    WARNINGS: (userId) => `/api/v1/admin/moderation/users/${userId}/warnings`,
    HIDE_CONTENT: "/api/v1/admin/moderation/content/hide",
    UNHIDE_CONTENT: (id) => `/api/v1/admin/moderation/content/${id}/unhide`,
    HIDDEN_CONTENT: "/api/v1/admin/moderation/content/hidden",
    AUDIT_LOGS: "/api/v1/admin/moderation/audit-logs",
  },
};
