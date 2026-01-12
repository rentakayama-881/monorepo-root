"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import {
  useTokenBalance,
  AI_SERVICE_TYPES,
  EXTERNAL_LLM_MODELS,
  HUGGINGFACE_MODEL,
} from "@/lib/useAIChat";

const AI_TOOLS = [
  {
    id: "chat",
    name: "AI Chat",
    description: "Interactive chat with AI models for conversations, Q&A, and general assistance",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    href: "/chat",
    color: "from-blue-500 to-indigo-600",
    available: true,
  },
  {
    id: "ai-search",
    name: "AI Search",
    description: "Semantic search powered by AI to find threads and content intelligently",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    href: "/ai-search",
    color: "from-emerald-500 to-teal-600",
    available: true,
  },
  {
    id: "image-gen",
    name: "Image Generation",
    description: "Create images from text descriptions using advanced AI models",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    href: null,
    color: "from-purple-500 to-pink-600",
    available: false,
    comingSoon: true,
  },
  {
    id: "code-assist",
    name: "Code Assistant",
    description: "AI-powered code generation, review, and debugging assistance",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    href: null,
    color: "from-orange-500 to-red-600",
    available: false,
    comingSoon: true,
  },
  {
    id: "summarize",
    name: "Thread Summarizer",
    description: "Automatically summarize long threads and discussions",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: null,
    color: "from-cyan-500 to-blue-600",
    available: false,
    comingSoon: true,
  },
  {
    id: "translate",
    name: "Translator",
    description: "Translate content between languages with AI precision",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    href: null,
    color: "from-violet-500 to-purple-600",
    available: false,
    comingSoon: true,
  },
];

export default function AIStudioPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedModel, setSelectedModel] = useState(HUGGINGFACE_MODEL.id);
  
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useTokenBalance();

  // Auth check
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login?redirect=/ai-studio");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const allModels = [HUGGINGFACE_MODEL, ...EXTERNAL_LLM_MODELS];
  const currentModel = allModels.find(m => m.id === selectedModel) || HUGGINGFACE_MODEL;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">AI Studio</h1>
              <p className="text-muted-foreground mt-1">
                Explore AI-powered tools to enhance your experience
              </p>
            </div>
            
            {/* Token Balance Card */}
            <div className="hidden sm:flex items-center gap-4 bg-background rounded-xl border border-border px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Token Balance</p>
                  {balanceLoading ? (
                    <div className="h-5 w-20 animate-pulse bg-muted rounded" />
                  ) : (
                    <p className="font-semibold text-foreground">
                      {balance.tokens.toLocaleString()}
                      {balance.freeTokensRemaining > 0 && (
                        <span className="text-xs text-green-500 ml-1">
                          +{balance.freeTokensRemaining} free
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/account/tokens"
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Buy Tokens
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Mobile Token Balance */}
        <div className="sm:hidden mb-6 bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Token Balance</p>
                {balanceLoading ? (
                  <div className="h-6 w-24 animate-pulse bg-muted rounded" />
                ) : (
                  <p className="text-lg font-semibold text-foreground">
                    {balance.tokens.toLocaleString()}
                    {balance.freeTokensRemaining > 0 && (
                      <span className="text-sm text-green-500 ml-1">
                        +{balance.freeTokensRemaining} free
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/account/tokens"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Buy
            </Link>
          </div>
        </div>

        {/* Model Selector */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Select AI Model</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  selectedModel === model.id
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/50 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{model.name}</span>
                  {selectedModel === model.id && (
                    <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{model.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    model.type === "free" 
                      ? "bg-green-500/10 text-green-600" 
                      : "bg-amber-500/10 text-amber-600"
                  }`}>
                    {model.type === "free" ? "Free" : `${model.tokenCost} tokens/msg`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* AI Tools Grid */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">AI Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {AI_TOOLS.map((tool) => (
              <div
                key={tool.id}
                className={`relative group rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 ${
                  tool.available
                    ? "hover:shadow-lg hover:border-primary/50 hover:-translate-y-1"
                    : "opacity-60"
                }`}
              >
                {/* Gradient Header */}
                <div className={`h-24 bg-gradient-to-br ${tool.color} p-4 flex items-end`}>
                  <div className="text-white/90">
                    {tool.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-foreground">{tool.name}</h3>
                    {tool.comingSoon && (
                      <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tool.description}
                  </p>

                  {tool.available && tool.href && (
                    <Link
                      href={tool.href}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      Open Tool
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>

                {/* Disabled Overlay */}
                {!tool.available && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px]" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-foreground">6</p>
            <p className="text-sm text-muted-foreground">AI Tools</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{allModels.length}</p>
            <p className="text-sm text-muted-foreground">AI Models</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-green-500">2</p>
            <p className="text-sm text-muted-foreground">Available Now</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">4</p>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
