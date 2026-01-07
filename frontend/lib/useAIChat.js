/**
 * Custom hooks for AI Chat API (Feature Service)
 * Handles token balance, chat sessions, and messages
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchFeature, fetchFeatureAuth, FEATURE_ENDPOINTS } from "./featureApi";
import { getToken } from "./auth";
import logger from "./logger";

/**
 * Available AI service types
 */
export const AI_SERVICE_TYPES = {
  HUGGINGFACE: "huggingface",
  EXTERNAL_LLM: "external_llm",
};

/**
 * Available external LLM models
 */
export const EXTERNAL_LLM_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Most capable GPT model" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", description: "Fast and efficient" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", description: "Advanced reasoning" },
  { id: "claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic", description: "Quick responses" },
  { id: "gemini-pro", name: "Gemini Pro", provider: "Google", description: "Multimodal AI" },
  { id: "gemini-flash", name: "Gemini Flash", provider: "Google", description: "Ultra fast" },
  { id: "deepseek-v3", name: "Deepseek V3", provider: "Deepseek", description: "Open source powerhouse" },
  { id: "llama-3-70b", name: "Llama 3 70B", provider: "Meta", description: "Open source large model" },
  { id: "mistral-large", name: "Mistral Large", provider: "Mistral", description: "European excellence" },
];

/**
 * HuggingFace model info
 */
export const HUGGINGFACE_MODEL = {
  id: "meta-llama/Llama-3.3-70B-Instruct",
  name: "Llama 3.3 70B",
  provider: "HuggingFace",
  description: "Free tier - Powerful open source model",
};

/**
 * Hook for fetching AI token balance
 * @param {object} options
 * @param {boolean} options.skip - Skip initial fetch
 * @returns {{ balance, loading, error, refetch }}
 */
export function useTokenBalance(options = {}) {
  const [balance, setBalance] = useState({ tokens: 0, freeTokensRemaining: 0 });
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState(null);

  const fetchBalance = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.AI.TOKEN_BALANCE);

      if (result.success) {
        setBalance({
          tokens: result.data?.balance || 0,
          freeTokensRemaining: result.data?.freeTokensRemaining || 0,
        });
      } else {
        throw new Error(result.message || "Gagal memuat saldo token");
      }
    } catch (err) {
      logger.error("Token Balance Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!options.skip) {
      fetchBalance();
    }
  }, [options.skip, fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}

/**
 * Hook for fetching token packages
 * @returns {{ packages, loading, error }}
 */
export function useTokenPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPackages() {
      try {
        const result = await fetchFeature(FEATURE_ENDPOINTS.AI.TOKEN_PACKAGES);

        if (result.success) {
          setPackages(result.data || []);
        }
      } catch (err) {
        logger.error("Token Packages Error:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPackages();
  }, []);

  return { packages, loading, error };
}

/**
 * Hook for purchasing tokens
 * @returns {{ purchaseTokens, loading, error, success }}
 */
export function usePurchaseTokens() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const purchaseTokens = useCallback(async (packageId) => {
    const token = getToken();
    if (!token) {
      throw new Error("Silakan login untuk membeli token");
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.AI.TOKEN_PURCHASE, {
        method: "POST",
        body: JSON.stringify({ packageId }),
      });

      if (result.success) {
        setSuccess(true);
        return result.data;
      } else {
        throw new Error(result.message || "Gagal membeli token");
      }
    } catch (err) {
      logger.error("Purchase Tokens Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { purchaseTokens, loading, error, success };
}

/**
 * Hook for fetching chat sessions
 * @param {object} options
 * @param {string} options.serviceType - Filter by service type
 * @param {boolean} options.skip - Skip initial fetch
 * @returns {{ sessions, loading, error, refetch }}
 */
export function useChatSessions(options = {}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (options.serviceType) {
        queryParams.set("serviceType", options.serviceType);
      }

      const endpoint = `${FEATURE_ENDPOINTS.AI.SESSIONS}?${queryParams}`;
      const result = await fetchFeatureAuth(endpoint);

      if (result.success) {
        setSessions(result.data || []);
      } else {
        throw new Error(result.message || "Gagal memuat sesi chat");
      }
    } catch (err) {
      logger.error("Chat Sessions Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.serviceType]);

  useEffect(() => {
    if (!options.skip) {
      fetchSessions();
    }
  }, [options.skip, fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}

/**
 * Hook for creating a new chat session
 * @returns {{ createSession, loading, error }}
 */
export function useCreateChatSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createSession = useCallback(async (serviceType, model = null, title = null) => {
    const token = getToken();
    if (!token) {
      throw new Error("Silakan login untuk memulai chat");
    }

    setLoading(true);
    setError(null);

    try {
      const body = { serviceType };
      if (model) body.model = model;
      if (title) body.title = title;

      const result = await fetchFeatureAuth(FEATURE_ENDPOINTS.AI.SESSIONS, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (result.success) {
        return result.data; // { sessionId }
      } else {
        throw new Error(result.message || "Gagal membuat sesi chat");
      }
    } catch (err) {
      logger.error("Create Session Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createSession, loading, error };
}

/**
 * Hook for sending a message in a chat session
 * @returns {{ sendMessage, loading, error }}
 */
export function useSendMessage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (sessionId, content) => {
    const token = getToken();
    if (!token) {
      throw new Error("Silakan login untuk mengirim pesan");
    }

    if (!content || content.trim().length === 0) {
      throw new Error("Pesan tidak boleh kosong");
    }

    if (content.length > 10000) {
      throw new Error("Pesan terlalu panjang (maks 10.000 karakter)");
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeatureAuth(
        FEATURE_ENDPOINTS.AI.SEND_MESSAGE(sessionId),
        {
          method: "POST",
          body: JSON.stringify({ content }),
          timeout: 60000, // AI responses can take longer
        }
      );

      if (result.success) {
        return result.data; // { messageId, content, tokensUsed, remainingBalance, processingTimeMs }
      } else {
        throw new Error(result.message || "Gagal mengirim pesan");
      }
    } catch (err) {
      logger.error("Send Message Error:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendMessage, loading, error };
}

/**
 * Hook for fetching chat messages
 * @param {string} sessionId
 * @param {object} options
 * @returns {{ messages, loading, error, refetch }}
 */
export function useChatMessages(sessionId, options = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState(null);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) return;

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeatureAuth(
        FEATURE_ENDPOINTS.AI.SESSION_MESSAGES(sessionId)
      );

      if (result.success) {
        setMessages(result.data || []);
      } else {
        throw new Error(result.message || "Gagal memuat pesan");
      }
    } catch (err) {
      logger.error("Chat Messages Error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!options.skip && sessionId) {
      fetchMessages();
    }
  }, [sessionId, options.skip, fetchMessages]);

  return { messages, loading, error, refetch: fetchMessages };
}

/**
 * Hook for fetching AI service status
 * @returns {{ status, loading, error }}
 */
export function useAIServiceStatus() {
  const [status, setStatus] = useState({ huggingface: false, externalLlm: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const result = await fetchFeature(FEATURE_ENDPOINTS.AI.SERVICE_STATUS);

        if (result.success) {
          setStatus({
            huggingface: result.data?.huggingface || false,
            externalLlm: result.data?.externalLlm || false,
          });
        }
      } catch (err) {
        logger.error("AI Service Status Error:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  return { status, loading, error };
}
