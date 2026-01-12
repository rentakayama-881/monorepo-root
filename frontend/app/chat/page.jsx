"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useTokenBalance,
  useChatSessions,
  useCreateChatSession,
  useChatMessages,
  useSendMessage,
  AI_SERVICE_TYPES,
  EXTERNAL_LLM_MODELS,
  HUGGINGFACE_MODEL,
} from "@/lib/useAIChat";
import { getToken } from "@/lib/auth";

export default function ChatPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState(HUGGINGFACE_MODEL.id);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const messagesEndRef = useRef(null);

  // Hooks
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useTokenBalance();
  const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useChatSessions();
  const { createSession, loading: creatingSession } = useCreateChatSession();
  const { messages, loading: messagesLoading, refetch: refetchMessages } = useChatMessages(selectedSessionId, { skip: !selectedSessionId });
  const { sendMessage, loading: sending } = useSendMessage();

  // Auth check
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login?redirect=/chat");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create new session
  const handleNewSession = async () => {
    const result = await createSession("New Chat", {
      serviceType: selectedModel === HUGGINGFACE_MODEL.id 
        ? AI_SERVICE_TYPES.HUGGINGFACE 
        : AI_SERVICE_TYPES.EXTERNAL_LLM,
      model: selectedModel,
    });

    if (result.success && result.sessionId) {
      setSelectedSessionId(result.sessionId);
      refetchSessions();
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedSessionId || sending) return;

    const content = newMessage.trim();
    setNewMessage("");

    const result = await sendMessage(selectedSessionId, content, {
      serviceType: selectedModel === HUGGINGFACE_MODEL.id 
        ? AI_SERVICE_TYPES.HUGGINGFACE 
        : AI_SERVICE_TYPES.EXTERNAL_LLM,
      model: selectedModel,
    });

    if (result.success) {
      refetchMessages();
      refetchBalance();
    }
  };

  // Get model info
  const getModelInfo = (modelId) => {
    if (modelId === HUGGINGFACE_MODEL.id) return HUGGINGFACE_MODEL;
    return EXTERNAL_LLM_MODELS.find((m) => m.id === modelId) || HUGGINGFACE_MODEL;
  };

  const currentModel = getModelInfo(selectedModel);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Chat Sessions */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <button
            onClick={handleNewSession}
            disabled={creatingSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {creatingSession ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Chat Baru
          </button>
        </div>

        {/* Token Balance */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Token:</span>
            {balanceLoading ? (
              <span className="animate-pulse bg-muted h-4 w-16 rounded" />
            ) : (
              <span className="font-medium text-foreground">
                {balance.tokens.toLocaleString()}
                {balance.freeTokensRemaining > 0 && (
                  <span className="text-xs text-green-500 ml-1">
                    (+{balance.freeTokensRemaining} free)
                  </span>
                )}
              </span>
            )}
          </div>
          <Link
            href="/account/tokens"
            className="text-xs text-primary hover:underline mt-1 block"
          >
            Beli Token →
          </Link>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-muted h-12 rounded-lg" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Belum ada chat. Mulai chat baru!
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedSessionId === session.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="font-medium text-sm truncate">
                    {session.title || "Chat"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {new Date(session.updatedAt).toLocaleDateString("id-ID")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-card">
          <div>
            <h1 className="font-semibold text-foreground">AI Chat</h1>
            <p className="text-xs text-muted-foreground">
              Powered by {currentModel.provider}
            </p>
          </div>

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <span>{currentModel.name}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showModelSelector && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {/* Free Model */}
                <div className="p-2 border-b border-border">
                  <button
                    onClick={() => {
                      setSelectedModel(HUGGINGFACE_MODEL.id);
                      setShowModelSelector(false);
                    }}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedModel === HUGGINGFACE_MODEL.id
                        ? "bg-primary/10"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{HUGGINGFACE_MODEL.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-600 rounded-full">
                        FREE
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {HUGGINGFACE_MODEL.description}
                    </p>
                  </button>
                </div>

                {/* Premium Models */}
                <div className="p-2">
                  <div className="text-xs text-muted-foreground px-2 mb-2">Premium Models</div>
                  {EXTERNAL_LLM_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelSelector(false);
                      }}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedModel === model.id
                          ? "bg-primary/10"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {model.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedSessionId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Selamat datang di AI Chat
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Tanyakan apa saja kepada AI. Pilih model yang sesuai dengan kebutuhan Anda.
                Model HuggingFace gratis untuk dicoba!
              </p>
            </div>
          ) : messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground">
                Mulai percakapan dengan mengirim pesan di bawah.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.tokensUsed && (
                      <p className="text-xs mt-1 opacity-70">
                        {msg.tokensUsed} tokens
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                selectedSessionId
                  ? "Ketik pesan..."
                  : "Buat chat baru untuk mulai..."
              }
              disabled={!selectedSessionId || sending}
              className="flex-1 px-4 py-3 border border-border bg-background rounded-lg outline-none text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!selectedSessionId || !newMessage.trim() || sending}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {sending ? (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
          
          {selectedSessionId && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Model: {currentModel.name} • 
              {selectedModel === HUGGINGFACE_MODEL.id 
                ? " Gratis" 
                : " Menggunakan token"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
