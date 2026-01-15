/**
 * Feature Service API Client
 * For ASP.NET Core backend (MongoDB) - handles replies, reactions, reports, AI chat, etc.
 */

import { useState, useEffect, useCallback } from "react";
import { getValidToken } from "./tokenRefresh";
import { clearToken } from "./auth";

/**
 * Get Feature Service base URL
 */
export function getFeatureApiBase() {
  return process.env.NEXT_PUBLIC_FEATURE_API_URL || "http://localhost:5000";
}

/**
 * Feature Service API endpoints
 */
export const FEATURE_ENDPOINTS = {
  // Health
  HEALTH: "/api/v1/health",

  // Replies
  REPLIES: {
    LIST: (threadId) => `/api/v1/threads/${threadId}/replies`,
    CREATE: (threadId) => `/api/v1/threads/${threadId}/replies`,
    UPDATE: (threadId, replyId) => `/api/v1/threads/${threadId}/replies/${replyId}`,
    DELETE: (threadId, replyId) => `/api/v1/threads/${threadId}/replies/${replyId}`,
  },

  // Reactions
  REACTIONS: {
    SUMMARY: (threadId) => `/api/v1/threads/${threadId}/reactions/summary`,
    ADD: (threadId) => `/api/v1/threads/${threadId}/reactions`,
    REMOVE: (threadId) => `/api/v1/threads/${threadId}/reactions`,
  },

  // Reports
  REPORTS: {
    CREATE: "/api/v1/reports",
    LIST: "/api/v1/reports/my",
    DETAIL: (id) => `/api/v1/reports/${id}`,
    REASONS: "/api/v1/reports/reasons",
  },

  // Documents
  DOCUMENTS: {
    LIST: "/api/v1/documents",
    UPLOAD: "/api/v1/documents",
    DETAIL: (id) => `/api/v1/documents/${id}`,
    DOWNLOAD: (id) => `/api/v1/documents/${id}/download`,
    DELETE: (id) => `/api/v1/documents/${id}`,
    STATS: "/api/v1/documents/stats",
    PUBLIC: (userId) => `/api/v1/documents/user/${userId}`,
    CATEGORIES: "/api/v1/documents/categories",
  },

  // AI Chat
  AI: {
    TOKEN_BALANCE: "/api/v1/chat/tokens/balance",
    TOKEN_PACKAGES: "/api/v1/chat/tokens/packages",
    TOKEN_PURCHASE: "/api/v1/chat/tokens/purchase",
    TOKEN_USAGE: "/api/v1/chat/tokens/usage",
    SESSIONS: "/api/v1/chat/sessions",
    SESSION_DETAIL: (id) => `/api/v1/chat/sessions/${id}`,
    SESSION_MESSAGES: (id) => `/api/v1/chat/sessions/${id}/messages`,
    SEND_MESSAGE: (id) => `/api/v1/chat/sessions/${id}/messages`,
    ARCHIVE_SESSION: (id) => `/api/v1/chat/sessions/${id}/archive`,
    DELETE_SESSION: (id) => `/api/v1/chat/sessions/${id}`,
    SERVICE_STATUS: "/api/v1/chat/service-status",
  },

  // Wallets
  WALLETS: {
    ME: "/api/v1/wallets/me",
    PIN_STATUS: "/api/v1/wallets/pin/status",
    PIN_SET: "/api/v1/wallets/pin/set",
    PIN_CHANGE: "/api/v1/wallets/pin/change",
    PIN_VERIFY: "/api/v1/wallets/pin/verify",
    TRANSACTIONS: "/api/v1/wallets/transactions",
    AI_CHAT_SPEND: "/api/v1/wallets/ai-chat/spend",
  },

  // Transfers (Escrow)
  TRANSFERS: {
    LIST: "/api/v1/wallets/transfers",
    CREATE: "/api/v1/wallets/transfers",
    DETAIL: (id) => `/api/v1/wallets/transfers/${id}`,
    BY_CODE: (code) => `/api/v1/wallets/transfers/code/${code}`,
    RELEASE: (id) => `/api/v1/wallets/transfers/${id}/release`,
    CANCEL: (id) => `/api/v1/wallets/transfers/${id}/cancel`,
    SEARCH_USER: "/api/v1/wallets/transfers/search-user",
  },

  // Withdrawals
  WITHDRAWALS: {
    LIST: "/api/v1/wallets/withdrawals",
    CREATE: "/api/v1/wallets/withdrawals",
    DETAIL: (id) => `/api/v1/wallets/withdrawals/${id}`,
    CANCEL: (id) => `/api/v1/wallets/withdrawals/${id}/cancel`,
  },

  // Disputes
  DISPUTES: {
    LIST: "/api/v1/wallets/disputes",
    CREATE: "/api/v1/wallets/disputes",
    DETAIL: (id) => `/api/v1/wallets/disputes/${id}`,
    RESPOND: (id) => `/api/v1/wallets/disputes/${id}/respond`,
  },

  // Admin Moderation
  ADMIN: {
    DASHBOARD: "/api/v1/admin/moderation/dashboard",
    REPORTS: "/api/v1/admin/moderation/reports",
    REPORT_ACTION: (id) => `/api/v1/admin/moderation/reports/${id}/action`,
    DEVICE_BANS: "/api/v1/admin/moderation/device-bans",
    DEVICE_BAN_DETAIL: (id) => `/api/v1/admin/moderation/device-bans/${id}`,
    WARNINGS: (userId) => `/api/v1/admin/moderation/users/${userId}/warnings`,
    HIDE_CONTENT: "/api/v1/admin/moderation/content/hide",
    UNHIDE_CONTENT: (id) => `/api/v1/admin/moderation/content/${id}/unhide`,
    HIDDEN_CONTENT: "/api/v1/admin/moderation/content/hidden",
    AUDIT_LOGS: "/api/v1/admin/moderation/audit-logs",
  },
};

/**
 * Fetch from Feature Service (no auth required)
 */
export async function fetchFeature(path, options = {}) {
  const { timeout = 15000, signal, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeout);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
  }

  try {
    const res = await fetch(`${getFeatureApiBase()}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...rest.headers,
      },
      signal: controller.signal,
    });

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const message = data?.message || data?.error || res.statusText || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data?.code;
      error.details = data?.details;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.message && err.status) {
      throw err;
    }

    if (controller.signal.aborted) {
      throw new Error("Request timed out. Please try again.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request cancelled.");
    }

    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error("Unable to connect to Feature Service. Please check your internet connection.");
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Authenticated fetch from Feature Service
 * Uses the same JWT token from Go backend
 */
export async function fetchFeatureAuth(path, options = {}) {
  const { timeout = 15000, signal, headers = {}, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeout);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
  }

  try {
    // Get valid token (refreshes if needed via Go backend)
    const token = await getValidToken();
    if (!token) {
      const error = new Error("Your session has expired. Please sign in again.");
      error.status = 401;
      error.code = "session_expired";
      throw error;
    }

    const res = await fetch(`${getFeatureApiBase()}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      signal: controller.signal,
    });

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      // Handle auth errors
      if (res.status === 401) {
        clearToken();
        const error = new Error(data?.message || data?.error || "Your session has expired. Please sign in again.");
        error.status = 401;
        error.code = data?.code || "session_expired";
        error.details = data?.details;
        throw error;
      }

      if (res.status === 403) {
        const error = new Error(data?.message || data?.error || "Access denied.");
        error.status = 403;
        error.code = data?.code || "forbidden";
        error.details = data?.details;
        throw error;
      }

      const message = data?.message || data?.error || res.statusText || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data?.code;
      error.details = data?.details;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.message && err.status) {
      throw err;
    }

    if (controller.signal.aborted) {
      throw new Error("Request timed out. Please try again.");
    }
    if (err?.name === "AbortError") {
      throw new Error("Request cancelled.");
    }

    if (err?.name === "TypeError" || err?.message?.includes("fetch")) {
      throw new Error("Unable to connect to Feature Service. Please check your internet connection.");
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ==================== Wallet Hooks ====================

/**
 * Hook to fetch wallet info
 */
export function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
      setWallet(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return { wallet, loading, error, refetch: fetchWallet };
}

/**
 * Hook to fetch wallet transactions
 */
export function useWalletTransactions({ page = 1, pageSize = 20, type } = {}) {
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = FEATURE_ENDPOINTS.WALLETS.TRANSACTIONS + "?page=" + page + "&pageSize=" + pageSize;
      if (type) url += "&type=" + type;
      const data = await featureFetch(url);
      setTransactions(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, totalCount, loading, error, refetch: fetchTransactions };
}

/**
 * Hook to fetch transfers (escrow)
 */
export function useTransfers({ page = 1, pageSize = 20, status } = {}) {
  const [transfers, setTransfers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = FEATURE_ENDPOINTS.TRANSFERS.LIST + "?page=" + page + "&pageSize=" + pageSize;
      if (status) url += "&status=" + status;
      const data = await featureFetch(url);
      setTransfers(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  return { transfers, totalCount, loading, error, refetch: fetchTransfers };
}
/**
 * Hook to fetch withdrawals
 */
export function useWithdrawals({ page = 1, pageSize = 20, status } = {}) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = FEATURE_ENDPOINTS.WITHDRAWALS.LIST + "?page=" + page + "&pageSize=" + pageSize;
      if (status) url += "&status=" + status;
      const data = await featureFetch(url);
      setWithdrawals(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  return { withdrawals, totalCount, loading, error, refetch: fetchWithdrawals };
}

/**
 * Hook to fetch disputes
 */
export function useDisputes({ page = 1, pageSize = 20, status } = {}) {
  const [disputes, setDisputes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = FEATURE_ENDPOINTS.DISPUTES.LIST + "?page=" + page + "&pageSize=" + pageSize;
      if (status) url += "&status=" + status;
      const data = await featureFetch(url);
      setDisputes(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  return { disputes, totalCount, loading, error, refetch: fetchDisputes };
}