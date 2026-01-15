import { NextResponse } from "next/server";

// HuggingFace Inference API
const HF_MODEL = "meta-llama/Llama-3.3-70B-Instruct";
const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

export async function POST(request) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { message: "Messages diperlukan" },
        { status: 400 }
      );
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "HUGGINGFACE_API_KEY tidak dikonfigurasi" },
        { status: 500 }
      );
    }

    // Build prompt for Llama
    const systemPrompt = `Kamu adalah Aleph Assistant, asisten AI yang ramah dan membantu dari Alephdraad - komunitas cryptocurrency dan blockchain Indonesia. 
Kamu ahli dalam cryptocurrency, blockchain, DeFi, trading, dan teknologi Web3.
Jawab dengan bahasa Indonesia yang baik dan mudah dipahami.
Berikan jawaban yang informatif, akurat, dan membantu.`;

    // Format messages for Llama chat template
    let prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${systemPrompt}<|eot_id|>`;

    for (const msg of messages) {
      const role = msg.role === "assistant" ? "assistant" : "user";
      prompt += `<|start_header_id|>${role}<|end_header_id|>

${msg.content}<|eot_id|>`;
    }

    prompt += `<|start_header_id|>assistant<|end_header_id|>

`;

    // Call HuggingFace Inference API
    const response = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("HuggingFace API Error:", error);
      
      // Handle rate limiting or model loading
      if (response.status === 503) {
        return NextResponse.json(
          { message: "Model sedang loading, coba lagi dalam beberapa detik" },
          { status: 503 }
        );
      }
      
      throw new Error(error.error || "HuggingFace API error");
    }

    const data = await response.json();
    
    // Extract generated text
    let assistantMessage = "";
    if (Array.isArray(data) && data[0]?.generated_text) {
      assistantMessage = data[0].generated_text.trim();
    } else if (data.generated_text) {
      assistantMessage = data.generated_text.trim();
    } else {
      assistantMessage = "Maaf, saya tidak dapat memproses permintaan Anda saat ini.";
    }

    // Clean up any trailing special tokens
    assistantMessage = assistantMessage
      .replace(/<\|eot_id\|>/g, "")
      .replace(/<\|end_of_text\|>/g, "")
      .trim();

    return NextResponse.json({
      content: assistantMessage,
      model: HF_MODEL,
    });

  } catch (error) {
    console.error("Assistant API Error:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
