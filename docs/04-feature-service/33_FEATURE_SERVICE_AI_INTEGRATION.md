# 🤖 AI Integration - Aleph Assistant

> Dokumentasi lengkap integrasi AI untuk Aleph Assistant.

---

## 🎯 Arsitektur AI

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ALEPH ASSISTANT                             │
│                    (AI Chat di Alephdraad)                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ChatService                                   │
│  • Orchestrates AI providers                                        │
│  • Manages chat sessions                                            │
│  • Token deduction                                                  │
└─────────────────────────────────────────────────────────────────────┘
              │                                        │
              ▼                                        ▼
┌───────────────────────────┐          ┌────────────────────────────┐
│   HuggingFaceService      │          │   ExternalLlmService       │
│   (FREE TIER)             │          │   (PAID TIER)              │
│                           │          │                            │
│   • Llama 3.3 70B         │          │   • GPT-4o                 │
│   • Unlimited usage       │          │   • Claude 3.5 Sonnet      │
│   • No token cost         │          │   • Gemini Pro             │
│                           │          │   • DeepSeek               │
│   Cons:                   │          │   • Dan lainnya            │
│   • Slower response       │          │                            │
│   • Rate limited          │          │   via n8n webhook          │
└───────────────────────────┘          └────────────────────────────┘
              │                                        │
              ▼                                        ▼
┌───────────────────────────┐          ┌────────────────────────────┐
│   HuggingFace API         │          │   n8n Workflow             │
│   api-inference.hf.co     │          │   → Routes to provider     │
└───────────────────────────┘          └────────────────────────────┘
```

---

## 💰 Model Token Pricing

### Free Tier (HuggingFace)

| Model | Provider | Token Cost | Notes |
|-------|----------|------------|-------|
| Llama 3.3 70B | HuggingFace | **0** | Free unlimited |

### Paid Tier (External LLM)

| Model ID | Name | Provider | Cost per 1K Tokens |
|----------|------|----------|-------------------|
| `gpt-4o` | GPT-4o | OpenAI | ~150 tokens |
| `gpt-4o-mini` | GPT-4o Mini | OpenAI | ~30 tokens |
| `claude-3.5-sonnet` | Claude 3.5 Sonnet | Anthropic | ~200 tokens |
| `claude-3-haiku` | Claude 3 Haiku | Anthropic | ~40 tokens |
| `gemini-pro` | Gemini Pro | Google | ~100 tokens |
| `gemini-flash` | Gemini Flash | Google | ~25 tokens |
| `deepseek-chat` | DeepSeek Chat | DeepSeek | ~20 tokens |
| `deepseek-coder` | DeepSeek Coder | DeepSeek | ~25 tokens |
| `mistral-large` | Mistral Large | Mistral | ~80 tokens |

**Note**: Harga dalam "tokens" internal Alephdraad, bukan token API asli.

---

## 📦 Token Packages

| Package | Tokens | Bonus | Price (IDR) | Total Tokens |
|---------|--------|-------|-------------|--------------|
| Starter | 10,000 | 500 | Rp 50.000 | 10,500 |
| Pro | 50,000 | 5,000 | Rp 200.000 | 55,000 |
| Business | 200,000 | 30,000 | Rp 600.000 | 230,000 |
| Enterprise | 1,000,000 | 200,000 | Rp 2.500.000 | 1,200,000 |

---

## 🔄 Chat Flow

### 1. Create Session

```
User → POST /api/v1/chat/sessions
       {
         "title": "Diskusi JWT",
         "serviceType": "huggingface",  // atau "external_llm"
         "model": null                  // untuk huggingface, atau "gpt-4o" untuk paid
       }
       
       ← 201 Created
       {
         "id": "cht_01HN5...",
         "title": "Diskusi JWT",
         ...
       }
```

### 2. Send Message (Free Tier)

```
User → POST /api/v1/chat/sessions/{id}/messages
       { "content": "Jelaskan tentang JWT" }

ChatService:
  1. Get session (verify ownership)
  2. Get conversation history
  3. Call HuggingFaceService.GenerateResponseAsync()
  4. Save user message + AI response
  5. Return response (no token deduction)
  
       ← 200 OK
       {
         "messageId": "msg_01HN5...",
         "content": "JWT adalah...",
         "tokensUsed": 0,
         "remainingBalance": { "tokens": 10000 }
       }
```

### 3. Send Message (Paid Tier)

```
User → POST /api/v1/chat/sessions/{id}/messages
       { "content": "Buatkan kode Python untuk JWT" }

ChatService:
  1. Get session (verify ownership, get model)
  2. Check token balance ≥ estimated cost
  3. Get conversation history
  4. Call ExternalLlmService.GenerateResponseAsync(model, ...)
  5. Calculate actual tokens used
  6. Deduct tokens from wallet
  7. Save messages
  8. Return response
  
       ← 200 OK
       {
         "messageId": "msg_01HN5...",
         "content": "```python\nimport jwt...",
         "tokensUsed": 450,
         "remainingBalance": { "tokens": 9550 }
       }
```

---

## 🤗 HuggingFace Integration

### Configuration

```json
// appsettings.json
{
  "HuggingFace": {
    "ApiKey": "hf_xxxxxxxxxxxx",
    "Model": "meta-llama/Llama-3.3-70B-Instruct",
    "BaseUrl": "https://api-inference.huggingface.co"
  }
}
```

### API Request

```csharp
POST https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct

Headers:
  Authorization: Bearer hf_xxxxxxxxxxxx
  Content-Type: application/json

Body:
{
  "inputs": "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are Aleph, a helpful AI assistant...<|eot_id|><|start_header_id|>user<|end_header_id|>\n\nJelaskan tentang JWT<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
  "parameters": {
    "max_new_tokens": 2048,
    "temperature": 0.7,
    "top_p": 0.9,
    "do_sample": true,
    "return_full_text": false
  }
}
```

### Response

```json
[
  {
    "generated_text": "JWT (JSON Web Token) adalah standar terbuka (RFC 7519)..."
  }
]
```

---

## 🌐 External LLM via n8n

### n8n Workflow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        n8n Workflow                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Webhook Trigger                               │
│  POST https://n8n.yourdomain.com/webhook/aleph-chat              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Router Node                                   │
│  Switch based on "model" field                                   │
└──────────────────────────────────────────────────────────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
   │ OpenAI │  │ Claude │  │ Gemini │  │DeepSeek│
   │  Node  │  │  Node  │  │  Node  │  │  Node  │
   └────────┘  └────────┘  └────────┘  └────────┘
        │           │           │           │
        └───────────┴───────────┴───────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Response Formatter                              │
│  Normalize response format                                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Respond to Webhook                              │
│  { content, tokensUsed, model }                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Request to n8n

```csharp
POST https://n8n.yourdomain.com/webhook/aleph-chat

Body:
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are Aleph, a helpful assistant." },
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hi! How can I help?" },
    { "role": "user", "content": "Explain JWT in simple terms" }
  ],
  "temperature": 0.7,
  "maxTokens": 2048
}
```

### Response from n8n

```json
{
  "content": "JWT is like a digital passport...",
  "tokensUsed": 256,
  "model": "gpt-4o",
  "provider": "openai"
}
```

---

## 💾 Data Models

### ChatSession

```csharp
public class ChatSession
{
    public string Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; }
    public string ServiceType { get; set; }  // "huggingface" | "external_llm"
    public string? Model { get; set; }        // null for huggingface, model id for external
    public int MessageCount { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

### ChatMessage

```csharp
public class ChatMessage
{
    public string Id { get; set; }
    public string SessionId { get; set; }
    public string Role { get; set; }      // "user" | "assistant" | "system"
    public string Content { get; set; }
    public int TokensUsed { get; set; }   // 0 for user messages
    public DateTime CreatedAt { get; set; }
}
```

### TokenTransaction

```csharp
public class TokenTransaction
{
    public string Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; }       // "purchase" | "usage" | "refund"
    public int Amount { get; set; }        // positive for credit, negative for debit
    public string Description { get; set; }
    public string? ReferenceId { get; set; } // e.g., session ID
    public DateTime CreatedAt { get; set; }
}
```

---

## ⚠️ Error Handling

### Token Insufficient

```json
{
  "success": false,
  "error": "Token tidak mencukupi. Saldo: 50, Dibutuhkan: ~200",
  "code": "INSUFFICIENT_TOKENS",
  "data": {
    "currentBalance": 50,
    "estimatedCost": 200
  }
}
```

### AI Service Unavailable

```json
{
  "success": false,
  "error": "Layanan AI sedang tidak tersedia. Silakan coba lagi.",
  "code": "AI_SERVICE_UNAVAILABLE"
}
```

### Rate Limited (HuggingFace)

```json
{
  "success": false,
  "error": "Terlalu banyak permintaan. Silakan tunggu beberapa saat.",
  "code": "RATE_LIMITED"
}
```

---

## 🔧 Environment Variables

```bash
# HuggingFace (Free Tier)
HUGGINGFACE__APIKEY=hf_xxxxxxxxxxxxxxxxxxxx
HUGGINGFACE__MODEL=meta-llama/Llama-3.3-70B-Instruct

# External LLM (Paid Tier)
EXTERNALLM__WEBHOOKURL=https://n8n.yourdomain.com/webhook/aleph-chat
EXTERNALLM__TIMEOUT=180
```

---

## 🎯 Best Practices

### 1. Always Check Token Balance

```csharp
// Before calling paid API
var balance = await _tokenService.GetBalanceAsync(userId);
var estimatedCost = EstimateTokenCost(model, messageLength);

if (balance.Tokens < estimatedCost)
    throw new InsufficientTokensException(balance.Tokens, estimatedCost);
```

### 2. Implement Retry Logic

```csharp
public async Task<string> CallWithRetryAsync(Func<Task<string>> apiCall, int maxRetries = 3)
{
    for (int i = 0; i < maxRetries; i++)
    {
        try
        {
            return await apiCall();
        }
        catch (HttpRequestException) when (i < maxRetries - 1)
        {
            await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, i)));
        }
    }
    throw new ExternalServiceException("Service unavailable after retries");
}
```

### 3. Truncate Context for Long Conversations

```csharp
private List<ChatMessage> TruncateHistory(List<ChatMessage> messages, int maxTokens = 4000)
{
    var result = new List<ChatMessage>();
    int tokenCount = 0;
    
    // Always include system message
    var systemMsg = messages.FirstOrDefault(m => m.Role == "system");
    if (systemMsg != null)
    {
        result.Add(systemMsg);
        tokenCount += EstimateTokens(systemMsg.Content);
    }
    
    // Add messages from newest to oldest
    foreach (var msg in messages.Where(m => m.Role != "system").Reverse())
    {
        var msgTokens = EstimateTokens(msg.Content);
        if (tokenCount + msgTokens > maxTokens)
            break;
        
        result.Insert(1, msg); // Insert after system message
        tokenCount += msgTokens;
    }
    
    return result;
}
```

---

## ▶️ Selanjutnya

- [../07-aleph-assistant/60_ALEPH_OVERVIEW.md](../07-aleph-assistant/60_ALEPH_OVERVIEW.md) - Aleph Assistant detail
- [../05-database/40_DATABASE_OVERVIEW.md](../05-database/40_DATABASE_OVERVIEW.md) - Database
