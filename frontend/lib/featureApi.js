/**
 * Feature Service API Client
 * For ASP.NET Core backend (MongoDB) - handles reports, documents, wallets, etc.
 */

import { useState, useEffect, useCallback } from "react";
import { getValidToken, refreshAccessToken } from "./tokenRefresh";
import { clearToken } from "./auth";

/**
 * Get Feature Service base URL
 */
export function getFeatureApiBase() {
  return (
    process.env.NEXT_PUBLIC_FEATURE_SERVICE_URL ||
    "https://feature.aivalid.id"
  );
}

function hasHeader(headers, key) {
  if (!headers) return false;
  const target = String(key || "").toLowerCase();
  return Object.keys(headers).some((k) => String(k).toLowerCase() === target);
}

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function buildRequestHeaders(baseHeaders = {}, extraHeaders = {}, body) {
  const merged = {
    ...baseHeaders,
    ...extraHeaders,
  };

  if (isFormDataBody(body)) {
    // Let browser set proper multipart/form-data boundary automatically.
    for (const key of Object.keys(merged)) {
      if (String(key).toLowerCase() === "content-type") {
        delete merged[key];
      }
    }
    return merged;
  }

  if (!hasHeader(merged, "Content-Type")) {
    merged["Content-Type"] = "application/json";
  }

  return merged;
}

function shouldAttachIdempotencyKey(path, method) {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;

  // Only attach where Feature Service expects idempotency keys (finance/security writes).
  return (
    typeof path === "string" &&
    (path.startsWith("/api/v1/wallets/") ||
      path.startsWith("/api/v1/guarantees") ||
      path.startsWith("/api/v1/disputes"))
  );
}

function generateIdempotencyKey() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `idem_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function safeToString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractFeatureServiceError(data) {
  // Feature Service standard error:
  // { success:false, error:{ code, message, details }, meta:{ requestId, timestamp } }
  const apiError = data?.error;
  if (apiError && typeof apiError === "object") {
    return {
      code: apiError.code,
      message: safeToString(apiError.message),
      details: apiError.details,
      requestId: data?.meta?.requestId,
    };
  }

  // Legacy/other shapes
  return {
    code: data?.code,
    message: safeToString(data?.message || data?.error),
    details: data?.details,
    requestId: data?.requestId || data?.meta?.requestId,
  };
}

/**
 * Feature Service API endpoints
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
    const resolvedHeaders = buildRequestHeaders({}, rest.headers || {}, rest.body);
    const res = await fetch(`${getFeatureApiBase()}${path}`, {
      ...rest,
      headers: resolvedHeaders,
      signal: controller.signal,
    });

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const extracted = extractFeatureServiceError(data);
      const message =
        extracted.message || res.statusText || `Request failed with status ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = extracted.code;
      error.details = extracted.details;
      error.requestId = extracted.requestId;
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
    let token = await getValidToken();
    if (!token) {
      const error = new Error("Your session has expired. Please sign in again.");
      error.status = 401;
      error.code = "session_expired";
      throw error;
    }

    const method = rest.method || "GET";

    const performAuthedRequest = async (accessToken) => {
      const requestHeaders = buildRequestHeaders(
        { Authorization: `Bearer ${accessToken}` },
        headers,
        rest.body
      );

      if (shouldAttachIdempotencyKey(path, method) && !hasHeader(requestHeaders, "X-Idempotency-Key")) {
        requestHeaders["X-Idempotency-Key"] = generateIdempotencyKey();
      }

      return fetch(`${getFeatureApiBase()}${path}`, {
        ...rest,
        headers: {
          ...requestHeaders,
        },
        signal: controller.signal,
      });
    };

    let res = await performAuthedRequest(token);

    // Token can be revoked while still considered valid by local expiry clock.
    if (res.status === 401) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        token = refreshedToken;
        res = await performAuthedRequest(token);
      }
    }

    let data;
    try {
      data = await res.clone().json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const extracted = extractFeatureServiceError(data);
      const message =
        extracted.message || res.statusText || `Request failed with status ${res.status}`;

      // Handle auth errors
      if (res.status === 401) {
        clearToken();
        const error = new Error(message || "Your session has expired. Please sign in again.");
        error.status = 401;
        error.code = extracted.code || "session_expired";
        error.details = extracted.details;
        error.requestId = extracted.requestId;
        throw error;
      }

      if (res.status === 403) {
        const error = new Error(message || "Access denied.");
        error.status = 403;
        error.code = extracted.code || "forbidden";
        error.details = extracted.details;
        error.requestId = extracted.requestId;
        throw error;
      }

      const error = new Error(message);
      error.status = res.status;
      error.code = extracted.code;
      error.details = extracted.details;
      error.requestId = extracted.requestId;
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

export function unwrapFeatureData(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if ("data" in payload) {
    return payload.data;
  }

  if ("Data" in payload) {
    return payload.Data;
  }

  if ("result" in payload) {
    return payload.result;
  }

  if ("Result" in payload) {
    return payload.Result;
  }

  return payload;
}

export function extractFeatureItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.Items)) {
    return payload.Items;
  }

  // Admin moderation paginated responses can use bans/Bans
  if (Array.isArray(payload.bans)) {
    return payload.bans;
  }

  if (Array.isArray(payload.Bans)) {
    return payload.Bans;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.Results)) {
    return payload.Results;
  }

  if (Array.isArray(payload.transfers)) {
    return payload.transfers;
  }

  if (Array.isArray(payload.Transfers)) {
    return payload.Transfers;
  }

  if (Array.isArray(payload.disputes)) {
    return payload.disputes;
  }

  if (Array.isArray(payload.Disputes)) {
    return payload.Disputes;
  }

  if (Array.isArray(payload.deposits)) {
    return payload.deposits;
  }

  if (Array.isArray(payload.Deposits)) {
    return payload.Deposits;
  }

  if (Array.isArray(payload.messages)) {
    return payload.messages;
  }

  if (Array.isArray(payload.Messages)) {
    return payload.Messages;
  }

  if (Array.isArray(payload.evidence)) {
    return payload.evidence;
  }

  if (Array.isArray(payload.Evidence)) {
    return payload.Evidence;
  }

  return [];
}

function extractTotalCount(payload, fallbackLength) {
  if (payload && typeof payload === "object") {
    if (typeof payload.totalCount === "number") {
      return payload.totalCount;
    }

    if (typeof payload.TotalCount === "number") {
      return payload.TotalCount;
    }

    if (typeof payload.total === "number") {
      return payload.total;
    }

    if (typeof payload.Total === "number") {
      return payload.Total;
    }
  }

  return fallbackLength;
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
      const response = await fetchFeatureAuth(FEATURE_ENDPOINTS.WALLETS.ME);
      const data = unwrapFeatureData(response);
      setWallet(data && typeof data === "object" ? data : null);
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
      const response = await fetchFeatureAuth(url);
      const data = unwrapFeatureData(response);
      const items = extractFeatureItems(data);
      setTransactions(items);
      setTotalCount(extractTotalCount(data, items.length));
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
      const response = await fetchFeatureAuth(url);
      const data = unwrapFeatureData(response);
      const items = extractFeatureItems(data);
      setTransfers(items);
      setTotalCount(extractTotalCount(data, items.length));
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
      const response = await fetchFeatureAuth(url);
      const data = unwrapFeatureData(response);
      const items = extractFeatureItems(data);
      setWithdrawals(items);
      setTotalCount(extractTotalCount(data, items.length));
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
      const response = await fetchFeatureAuth(url);
      const data = unwrapFeatureData(response);
      const items = extractFeatureItems(data);
      setDisputes(items);
      setTotalCount(extractTotalCount(data, items.length));
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
