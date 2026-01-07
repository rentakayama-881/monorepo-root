# 🤖 Aleph Assistant Overview

> Dokumentasi lengkap Aleph Assistant - fitur AI Chat di Alephdraad.

---

## 🎯 Apa itu Aleph Assistant?

**Aleph Assistant** adalah asisten AI yang terintegrasi di Alephdraad, memungkinkan pengguna untuk:

- Bertanya dan berdiskusi dengan AI
- Mendapatkan bantuan coding
- Menjelaskan konsep teknis
- Brainstorming ide

---

## 💰 Model Bisnis: Token-Based

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ALEPH ASSISTANT PRICING                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  FREE TIER                                                          │
│  ───────────                                                        │
│  Model: Llama 3.3 70B (via HuggingFace)                            │
│  Cost: GRATIS (0 tokens)                                           │
│  Limit: Rate limited oleh HuggingFace                              │
│  Speed: Lebih lambat                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PAID TIER                                                          │
│  ──────────                                                         │
│  Models: GPT-4o, Claude, Gemini, DeepSeek, dll                     │
│  Cost: Tokens per message                                           │
│  Limit: Sesuai saldo token                                         │
│  Speed: Cepat                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Paket Token

| Paket | Tokens | Bonus | Harga | Total Tokens |
|-------|--------|-------|-------|--------------|
| **Starter** | 10,000 | 500 | Rp 50.000 | 10,500 |
| **Pro** | 50,000 | 5,000 | Rp 200.000 | 55,000 |
| **Business** | 200,000 | 30,000 | Rp 600.000 | 230,000 |
| **Enterprise** | 1,000,000 | 200,000 | Rp 2.500.000 | 1,200,000 |

### Contoh Penggunaan Token

| Aktivitas | Perkiraan Tokens |
|-----------|------------------|
| Chat pendek (1-2 kalimat) | 50-100 tokens |
| Chat sedang (1 paragraf) | 100-300 tokens |
| Chat panjang (beberapa paragraf) | 300-800 tokens |
| Request kode kompleks | 500-2000 tokens |

**Estimasi dengan paket Starter (10,500 tokens)**:
- ~100 chat pendek, atau
- ~35 chat sedang, atau
- ~15 chat panjang

---

## 🤖 Model AI Tersedia

### Free Tier

| Model | Provider | Keterangan |
|-------|----------|------------|
| Llama 3.3 70B Instruct | HuggingFace | Open source, powerful |

### Paid Tier

| Model ID | Nama | Provider | Cost/1K Tokens |
|----------|------|----------|----------------|
| `gpt-4o` | GPT-4o | OpenAI | ~150 |
| `gpt-4o-mini` | GPT-4o Mini | OpenAI | ~30 |
| `claude-3.5-sonnet` | Claude 3.5 Sonnet | Anthropic | ~200 |
| `claude-3-haiku` | Claude 3 Haiku | Anthropic | ~40 |
| `gemini-pro` | Gemini Pro | Google | ~100 |
| `gemini-flash` | Gemini Flash | Google | ~25 |
| `deepseek-chat` | DeepSeek Chat | DeepSeek | ~20 |
| `deepseek-coder` | DeepSeek Coder | DeepSeek | ~25 |

---

## 🔄 Alur Penggunaan

### 1. User Membuka Aleph Chat

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ALEPH CHAT UI                                 │
│  ───────────────────────────────────────────────────────────────    │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Chat History    │  │  New Chat                                │  │
│  │                 │  │                                          │  │
│  │ • Diskusi JWT   │  │  Select Model:                          │  │
│  │ • Belajar React │  │  ○ Llama 3.3 (Free)                     │  │
│  │ • Ide Startup   │  │  ○ GPT-4o (Paid)                        │  │
│  │                 │  │  ○ Claude 3.5 (Paid)                    │  │
│  │                 │  │  ○ More...                               │  │
│  │                 │  │                                          │  │
│  │                 │  │  Token Balance: 10,500 🪙               │  │
│  │                 │  │                                          │  │
│  └─────────────────┘  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Memulai Chat Baru

```javascript
// Frontend
const { createSession } = useChatSessions();

const handleNewChat = async () => {
  const session = await createSession({
    title: "New Chat",
    serviceType: "huggingface", // atau "external_llm"
    model: null                 // atau "gpt-4o" untuk paid
  });
  
  router.push(`/chat/${session.id}`);
};
```

### 3. Mengirim Pesan

```javascript
// Frontend
const { sendMessage, sending } = useChatSession(sessionId);

const handleSend = async () => {
  try {
    const response = await sendMessage(userInput);
    
    // response = {
    //   messageId: "msg_01...",
    //   content: "AI response...",
    //   tokensUsed: 225,
    //   remainingBalance: 9775
    // }
    
    setUserInput("");
    toast.success(`Used ${response.tokensUsed} tokens`);
    
  } catch (err) {
    if (err.code === "INSUFFICIENT_TOKENS") {
      showBuyTokensModal();
    } else {
      toast.error(err.message);
    }
  }
};
```

---

## 📊 Database Schema

### Chat Session

```javascript
// MongoDB: chat_sessions
{
  "_id": "cht_01HN5QRST7890",
  "userId": 456,
  "title": "Diskusi tentang JWT",
  "serviceType": "huggingface",  // atau "external_llm"
  "model": null,                 // model ID jika external_llm
  "messageCount": 12,
  "totalTokensUsed": 2450,
  "lastMessageAt": ISODate("..."),
  "createdAt": ISODate("...")
}
```

### Chat Message

```javascript
// MongoDB: chat_messages
{
  "_id": "msg_01HN5UVWX1234",
  "sessionId": "cht_01HN5QRST7890",
  "role": "user",              // atau "assistant"
  "content": "Jelaskan tentang JWT",
  "tokensUsed": 0,             // 0 untuk user, >0 untuk assistant
  "createdAt": ISODate("...")
}
```

---

## 🔌 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/v1/chat/tokens/balance` | Cek saldo token |
| `GET` | `/api/v1/chat/tokens/packages` | List paket token |
| `POST` | `/api/v1/chat/tokens/purchase` | Beli token |
| `GET` | `/api/v1/chat/sessions` | List chat sessions |
| `POST` | `/api/v1/chat/sessions` | Buat session baru |
| `GET` | `/api/v1/chat/sessions/:id` | Detail session + messages |
| `POST` | `/api/v1/chat/sessions/:id/messages` | Kirim pesan |
| `DELETE` | `/api/v1/chat/sessions/:id` | Hapus session |

---

## 🤗 Integrasi HuggingFace (Free Tier)

### Konfigurasi

```csharp
// appsettings.json
{
  "HuggingFace": {
    "ApiKey": "hf_xxxxxxxxxxxx",
    "Model": "meta-llama/Llama-3.3-70B-Instruct",
    "BaseUrl": "https://api-inference.huggingface.co"
  }
}
```

### API Call

```csharp
// HuggingFaceService.cs
public async Task<(string Response, int TokensUsed)> GenerateResponseAsync(
    List<ChatMessage> history,
    string userMessage)
{
    var prompt = BuildLlamaPrompt(history, userMessage);
    
    var request = new {
        inputs = prompt,
        parameters = new {
            max_new_tokens = 2048,
            temperature = 0.7,
            top_p = 0.9,
            do_sample = true
        }
    };
    
    // POST to HuggingFace API
    var response = await _httpClient.PostAsJsonAsync(
        $"{_settings.BaseUrl}/models/{_settings.Model}",
        request
    );
    
    // Parse response
    var result = await response.Content.ReadFromJsonAsync<List<HfResponse>>();
    return (result[0].GeneratedText, 0); // Free tier = 0 tokens
}
```

---

## 🌐 Integrasi External LLM (Paid Tier)

### Arsitektur via n8n Webhook

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Feature Service │────▶│   n8n Workflow   │────▶│   LLM Provider   │
│                  │     │                  │     │                  │
│  POST /webhook   │     │  Route by model  │     │  OpenAI/Claude   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### n8n Webhook Request

```json
POST https://n8n.yourdomain.com/webhook/aleph-chat

{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are Aleph, a helpful assistant." },
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hi there!" },
    { "role": "user", "content": "Explain JWT please" }
  ],
  "temperature": 0.7,
  "maxTokens": 2048
}
```

### n8n Webhook Response

```json
{
  "content": "JWT (JSON Web Token) is...",
  "tokensUsed": 256,
  "model": "gpt-4o",
  "provider": "openai"
}
```

---

## 💳 Pembelian Token

### Flow

```
1. User klik "Buy Tokens"
2. Pilih paket (Starter/Pro/Business/Enterprise)
3. Konfirmasi pembelian
4. Saldo wallet dikurangi
5. Token ditambahkan ke balance
6. Transaction record created
```

### API

```javascript
// Frontend
const { purchaseTokens, loading } = usePurchaseTokens();

const handlePurchase = async (packageId) => {
  try {
    const result = await purchaseTokens(packageId);
    toast.success(`${result.tokensAdded} tokens ditambahkan!`);
  } catch (err) {
    toast.error(err.message);
  }
};
```

---

## ⚠️ Error Handling

### Token Tidak Cukup

```javascript
// Response dari API
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

### Handling di Frontend

```javascript
try {
  await sendMessage(input);
} catch (err) {
  if (err.code === "INSUFFICIENT_TOKENS") {
    setShowPurchaseModal(true);
  } else if (err.code === "AI_SERVICE_UNAVAILABLE") {
    toast.error("Layanan AI sedang tidak tersedia. Coba lagi nanti.");
  } else {
    toast.error(err.message);
  }
}
```

---

## 🎨 UI Components

### Token Balance Widget

```jsx
function TokenBalanceWidget() {
  const { balance, loading } = useTokenBalance();
  
  return (
    <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1 rounded-full">
      <span className="text-yellow-600">🪙</span>
      <span className="font-medium">
        {loading ? "..." : balance.tokens.toLocaleString()}
      </span>
      <span className="text-sm text-gray-500">tokens</span>
    </div>
  );
}
```

### Model Selector

```jsx
function ModelSelector({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <optgroup label="Free">
        <option value="huggingface">🆓 Llama 3.3 70B</option>
      </optgroup>
      <optgroup label="Premium">
        <option value="gpt-4o">💎 GPT-4o</option>
        <option value="claude-3.5-sonnet">💎 Claude 3.5 Sonnet</option>
        <option value="gemini-pro">💎 Gemini Pro</option>
      </optgroup>
    </select>
  );
}
```

---

## 📈 Metrics & Analytics

### Tracked Metrics

- Total tokens purchased (per user, global)
- Total tokens used (per model)
- Average tokens per conversation
- Most popular models
- User retention (chat session frequency)
- Revenue per token package

---

## ▶️ Selanjutnya

- [61_ALEPH_USAGE_GUIDE.md](./61_ALEPH_USAGE_GUIDE.md) - Panduan penggunaan
- [62_ALEPH_TOKEN_PRICING.md](./62_ALEPH_TOKEN_PRICING.md) - Pricing detail
- [../08-deployment/70_DEPLOYMENT_OVERVIEW.md](../08-deployment/70_DEPLOYMENT_OVERVIEW.md) - Deployment
