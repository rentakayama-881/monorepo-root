/**
 * Custom hooks for Replies API (Feature Service)
 * Handles CRUD operations with cursor pagination
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchFeature, fetchFeatureAuth, FEATURE_ENDPOINTS } from "./featureApi";
import { getToken } from "./auth";
import logger from "./logger";

/**
 * Hook for fetching replies with cursor pagination
 * @param {string} threadId - Thread ID
 * @param {object} options - Options
 * @param {number} options.limit - Items per page (default: 20, max: 100)
 * @param {boolean} options.skip - Skip initial fetch
 * @returns {{ replies, loading, error, hasMore, loadMore, refetch, isLoadingMore }}
 */
export function useReplies(threadId, options = {}) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(!options.skip);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetchReplies = useCallback(
    async (cursor = null, append = false) => {
      if (!threadId) return;

      const opts = optionsRef.current;
      const limit = opts.limit || 20;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const queryParams = new URLSearchParams({ limit: String(limit) });
        if (cursor) {
          queryParams.set("cursor", cursor);
        }

        const endpoint = `${FEATURE_ENDPOINTS.REPLIES.LIST(threadId)}?${queryParams}`;
        const result = await fetchFeature(endpoint);

        if (result.success) {
          const newReplies = result.data || [];
          setReplies((prev) => (append ? [...prev, ...newReplies] : newReplies));
          setHasMore(result.meta?.hasMore || false);
          setNextCursor(result.meta?.nextCursor || null);
        } else {
          throw new Error(result.message || "Gagal memuat balasan");
        }
      } catch (err) {
        logger.error(`Replies Error [${threadId}]:`, err.message);
        if (!append) {
          setError(err.message);
        }
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [threadId]
  );

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoadingMore) {
      fetchReplies(nextCursor, true);
    }
  }, [nextCursor, isLoadingMore, fetchReplies]);

  const refetch = useCallback(() => {
    setNextCursor(null);
    fetchReplies(null, false);
  }, [fetchReplies]);

  useEffect(() => {
    if (!options.skip && threadId) {
      fetchReplies();
    }
  }, [threadId, options.skip, fetchReplies]);

  return { replies, loading, error, hasMore, loadMore, refetch, isLoadingMore };
}

/**
 * Hook for creating a reply
 * @returns {{ createReply, loading, error }}
 */
export function useCreateReply() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createReply = useCallback(async (threadId, content, parentReplyId = null) => {
    const token = getToken();
    if (!token) {
      const err = new Error("Silakan login untuk membalas");
      setError(err.message);
      throw err;
    }

    setLoading(true);
    setError(null);

    try {
      const body = { content };
      if (parentReplyId) {
        body.parentReplyId = parentReplyId;
      }

      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.REPLIES.CREATE(threadId), {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Feature Service returns ReplyResponse directly (not wrapped in {success, data})
      // If we got here without error, the request was successful
      if (result && result.id) {
        return result; // Return the reply object directly
      } else if (result && result.success === false) {
        throw new Error(result.message || "Gagal mengirim balasan");
      } else {
        return result; // Return whatever we got
      }
    } catch (err) {
      logger.error("Create Reply Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createReply, loading, error };
}

/**
 * Hook for updating a reply
 * @returns {{ updateReply, loading, error }}
 */
export function useUpdateReply() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateReply = useCallback(async (threadId, replyId, content) => {
    const token = getToken();
    if (!token) {
      const err = new Error("Silakan login untuk mengedit balasan");
      setError(err.message);
      throw err;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeatureAuth(
        FEATURE_ENDPOINTS.REPLIES.UPDATE(threadId, replyId),
        {
          method: "PATCH",
          body: JSON.stringify({ content }),
        }
      );

      // Feature Service returns ReplyResponse directly on success
      // If we got here without error, the request was successful
      if (result && result.id) {
        return result;
      } else if (result && result.success === false) {
        throw new Error(result.message || "Gagal mengupdate balasan");
      } else {
        return result || true;
      }
    } catch (err) {
      logger.error("Update Reply Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateReply, loading, error };
}

/**
 * Hook for deleting a reply
 * @returns {{ deleteReply, loading, error }}
 */
export function useDeleteReply() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteReply = useCallback(async (threadId, replyId) => {
    const token = getToken();
    if (!token) {
      const err = new Error("Silakan login untuk menghapus balasan");
      setError(err.message);
      throw err;
    }

    setLoading(true);
    setError(null);

    try {
      await fetchFeatureAuth(FEATURE_ENDPOINTS.REPLIES.DELETE(threadId, replyId), {
        method: "DELETE",
      });
      return true;
    } catch (err) {
      logger.error("Delete Reply Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteReply, loading, error };
}
