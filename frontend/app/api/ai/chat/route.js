import { NextResponse } from "next/server";

// LLM Provider configurations with pricing (in IDR per request)
const LLM_CONFIGS = {
  "claude-sonnet-4.5": {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    endpoint: "https://api.anthropic.com/v1/messages",
    priceIdr: 500, // Rp 500 per request
  },
  "gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    endpoint: "https://api.openai.com/v1/chat/completions",
    priceIdr: 400, // Rp 400 per request
  },
};

// Feature Service URL
const FEATURE_SERVICE_URL = process.env.NEXT_PUBLIC_FEATURE_API_URL || "http://localhost:5000";

export async function POST(request) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const body = await request.json();
    const { model: modelId, messages } = body;

    if (!modelId || !messages || messages.length === 0) {
      return NextResponse.json(
        { message: "Model dan messages diperlukan" },
        { status: 400 }
      );
    }

    const config = LLM_CONFIGS[modelId];
    if (!config) {
      return NextResponse.json(
        { message: "Model tidak ditemukan" },
        { status: 400 }
      );
    }

    // Step 1: Deduct from wallet via Feature Service
    const spendResponse = await fetch(`${FEATURE_SERVICE_URL}/api/v1/wallets/ai-chat/spend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: config.priceIdr,
        model: modelId,
      }),
    });

    if (!spendResponse.ok) {
      const errorData = await spendResponse.json();
      return NextResponse.json(
        { message: errorData.message || "Gagal memproses pembayaran. Pastikan saldo wallet mencukupi." },
        { status: spendResponse.status }
      );
    }

    const spendData = await spendResponse.json();

    // Step 2: Call LLM API
    let response;
    let assistantMessage;

    if (config.provider === "anthropic") {
      // Call Anthropic API
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { message: "ANTHROPIC_API_KEY tidak dikonfigurasi" },
          { status: 500 }
        );
      }

      // Convert messages format for Anthropic
      const anthropicMessages = messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          messages: anthropicMessages,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Anthropic API error");
      }

      const data = await response.json();
      assistantMessage = data.content?.[0]?.text || "Tidak ada respons";

    } else if (config.provider === "openai") {
      // Call OpenAI API
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { message: "OPENAI_API_KEY tidak dikonfigurasi" },
          { status: 500 }
        );
      }

      response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "OpenAI API error");
      }

      const data = await response.json();
      assistantMessage = data.choices?.[0]?.message?.content || "Tidak ada respons";
    }

    return NextResponse.json({
      content: assistantMessage,
      model: modelId,
      priceIdr: config.priceIdr,
      walletBalance: spendData.newBalance,
    });

  } catch (error) {
    console.error("AI Chat API Error:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
