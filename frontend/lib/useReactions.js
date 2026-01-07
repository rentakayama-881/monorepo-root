/**
 * Custom hooks for Reactions API (Feature Service)
 * Handles reaction summary, add, and remove operations
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchFeature, fetchFeatureAuth, FEATURE_ENDPOINTS } from "./featureApi";
import { getToken } from "./auth";
import logger from "./logger";

/**
 * Available reaction types
 */
export const REACTION_TYPES = ["like", "love", "fire", "sad", "laugh"];

/**
 * Reaction emoji mapping
 */
export const REACTION_EMOJIS = {
  like: "👍",
  love: "❤️",
  fire: "🔥",
  sad: "😢",
  laugh: "😂",
};

/**
 * Reaction labels (Indonesian)
 */
export const REACTION_LABELS = {
  like: "Suka",
  love: "Cinta",
  fire: "Keren",
  sad: "Sedih",
  laugh: "Lucu",
};

/**
 * Hook for fetching reaction summary and managing reactions
 * @param {string} threadId - Thread ID
 * @param {object} options - Options
 * @param {boolean} options.skip - Skip initial fetch
 * @returns {{ reactions, userReaction, totalCount, loading, error, addReaction, removeReaction, refetch }}
 */
export function useReactions(threadId, options = {}) {
  const [reactions, setReactions] = useState({}); // { like: 5, love: 3, ... }
  const [userReaction, setUserReaction] = useState(null); // Current user's reaction
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetchSummary = useCallback(async () => {
    if (!threadId) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = FEATURE_ENDPOINTS.REACTIONS.SUMMARY(threadId);
      const result = await fetchFeature(endpoint);

      if (result.success) {
        setReactions(result.data?.counts || {});
        setTotalCount(result.data?.totalCount || 0);
        setUserReaction(result.data?.userReaction || null);
      } else {
        throw new Error(result.message || "Gagal memuat reaksi");
      }
    } catch (err) {
      logger.error(`Reactions Error [${threadId}]:`, err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  const addReaction = useCallback(
    async (reactionType) => {
      const token = getToken();
      if (!token) {
        throw new Error("Silakan login untuk memberi reaksi");
      }

      if (!REACTION_TYPES.includes(reactionType)) {
        throw new Error("Tipe reaksi tidak valid");
      }

      setIsSubmitting(true);

      // Optimistic update
      const prevReactions = { ...reactions };
      const prevUserReaction = userReaction;
      const prevTotalCount = totalCount;

      // If user already has a reaction, decrement old one
      if (userReaction && userReaction !== reactionType) {
        setReactions((prev) => ({
          ...prev,
          [userReaction]: Math.max(0, (prev[userReaction] || 0) - 1),
          [reactionType]: (prev[reactionType] || 0) + 1,
        }));
      } else if (!userReaction) {
        setReactions((prev) => ({
          ...prev,
          [reactionType]: (prev[reactionType] || 0) + 1,
        }));
        setTotalCount((prev) => prev + 1);
      }
      setUserReaction(reactionType);

      try {
        const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.REACTIONS.ADD(threadId), {
          method: "POST",
          body: JSON.stringify({ reactionType }),
        });

        if (!result.success) {
          throw new Error(result.message || "Gagal memberi reaksi");
        }

        return true;
      } catch (err) {
        // Rollback on error
        setReactions(prevReactions);
        setUserReaction(prevUserReaction);
        setTotalCount(prevTotalCount);
        logger.error("Add Reaction Error:", err.message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [threadId, reactions, userReaction, totalCount]
  );

  const removeReaction = useCallback(async () => {
    const token = getToken();
    if (!token) {
      throw new Error("Silakan login untuk menghapus reaksi");
    }

    if (!userReaction) return;

    setIsSubmitting(true);

    // Optimistic update
    const prevReactions = { ...reactions };
    const prevUserReaction = userReaction;
    const prevTotalCount = totalCount;

    setReactions((prev) => ({
      ...prev,
      [userReaction]: Math.max(0, (prev[userReaction] || 0) - 1),
    }));
    setTotalCount((prev) => Math.max(0, prev - 1));
    setUserReaction(null);

    try {
      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.REACTIONS.REMOVE(threadId), {
        method: "DELETE",
      });

      if (!result.success) {
        throw new Error(result.message || "Gagal menghapus reaksi");
      }

      return true;
    } catch (err) {
      // Rollback on error
      setReactions(prevReactions);
      setUserReaction(prevUserReaction);
      setTotalCount(prevTotalCount);
      logger.error("Remove Reaction Error:", err.message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [threadId, reactions, userReaction, totalCount]);

  const toggleReaction = useCallback(
    async (reactionType) => {
      if (userReaction === reactionType) {
        return removeReaction();
      }
      return addReaction(reactionType);
    },
    [userReaction, addReaction, removeReaction]
  );

  useEffect(() => {
    if (!options.skip && threadId) {
      fetchSummary();
    }
  }, [threadId, options.skip, fetchSummary]);

  return {
    reactions,
    userReaction,
    totalCount,
    loading,
    error,
    isSubmitting,
    addReaction,
    removeReaction,
    toggleReaction,
    refetch: fetchSummary,
  };
}
