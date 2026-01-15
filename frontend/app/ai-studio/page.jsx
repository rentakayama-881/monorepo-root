"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

// Only 2 models - Claude Sonnet 4.5 and GPT-4o
const AI_MODELS = [
  { 
    id: "claude-sonnet-4.5", 
    name: "Claude Sonnet 4.5", 
    provider: "Anthropic",
    description: "Advanced reasoning and analysis with exceptional nuance",
    color: "from-orange-500 to-amber-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  { 
    id: "gpt-4o", 
    name: "GPT-4o", 
    provider: "OpenAI",
    description: "Most capable multimodal model for complex tasks",
    color: "from-emerald-500 to-teal-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    ),
  },
];

export default function AIStudioPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hoveredModel, setHoveredModel] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login?redirect=/ai-studio");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const handleSelectModel = (modelId) => {
    // Navigate to chat page with selected model
    router.push(`/ai-studio/chat?model=${modelId}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-3">AI Studio</h1>
        <p className="text-lg text-muted-foreground">
          Pilih model AI untuk memulai chat
        </p>
      </div>

      {/* Model Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        {AI_MODELS.map((model) => (
          <button
            key={model.id}
            onClick={() => handleSelectModel(model.id)}
            onMouseEnter={() => setHoveredModel(model.id)}
            onMouseLeave={() => setHoveredModel(null)}
            className={`
              relative group rounded-2xl border-2 p-8 text-left transition-all duration-300
              ${hoveredModel === model.id 
                ? "border-primary shadow-xl scale-[1.02]" 
                : "border-border hover:border-primary/50"
              }
              bg-card overflow-hidden
            `}
          >
            {/* Gradient Background */}
            <div 
              className={`absolute inset-0 bg-gradient-to-br ${model.color} opacity-0 group-hover:opacity-5 transition-opacity`}
            />
            
            {/* Content */}
            <div className="relative z-10">
              {/* Icon */}
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${model.color} flex items-center justify-center text-white mb-6`}>
                {model.icon}
              </div>

              {/* Model Info */}
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-foreground mb-1">
                  {model.name}
                </h3>
                <span className="text-sm text-muted-foreground">
                  by {model.provider}
                </span>
              </div>

              <p className="text-muted-foreground mb-6">
                {model.description}
              </p>

              {/* CTA */}
              <div className={`
                inline-flex items-center gap-2 font-medium transition-colors
                ${hoveredModel === model.id ? "text-primary" : "text-muted-foreground"}
              `}>
                <span>Mulai Chat</span>
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-12 text-sm text-muted-foreground text-center">
        Token AI digunakan untuk setiap pesan. <a href="/account/tokens" className="text-primary hover:underline">Beli token</a>
      </p>
    </div>
  );
}
