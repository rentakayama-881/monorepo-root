# 💰 Aleph Token Pricing

> Dokumentasi detail sistem harga dan token Aleph Assistant.

---

## 🎯 Konsep Token

**Token** adalah unit mata uang internal Alephdraad untuk penggunaan AI.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TOKEN ECONOMY                                 │
│                                                                      │
│   IDR (Rupiah)  ──────▶  Token  ──────▶  AI Usage                   │
│   (Pembelian)            (Balance)       (Consumption)               │
│                                                                      │
│   Rp 50.000     ──────▶  10,500  ──────▶  ~100 messages             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Paket Token

### Tabel Paket

| ID | Nama | Base Tokens | Bonus | Total | Harga (IDR) | Per Token |
|----|------|-------------|-------|-------|-------------|-----------|
| `pkg_starter` | Starter | 10,000 | 500 (5%) | 10,500 | Rp 50.000 | Rp 4.76 |
| `pkg_pro` | Pro | 50,000 | 5,000 (10%) | 55,000 | Rp 200.000 | Rp 3.64 |
| `pkg_business` | Business | 200,000 | 30,000 (15%) | 230,000 | Rp 600.000 | Rp 2.61 |
| `pkg_enterprise` | Enterprise | 1,000,000 | 200,000 (20%) | 1,200,000 | Rp 2.500.000 | Rp 2.08 |

### Benefit per Tier

| Paket | Bonus % | Target User |
|-------|---------|-------------|
| Starter | 5% | Coba-coba, casual user |
| Pro | 10% | Active user, freelancer |
| Business | 15% | Tim kecil, startup |
| Enterprise | 20% | Perusahaan, heavy user |

---

## 🤖 Model Pricing

### Free Tier (Gratis)

| Model | Provider | Token Cost | Notes |
|-------|----------|------------|-------|
| Llama 3.3 70B | HuggingFace | **0** | Unlimited, tapi rate limited |

### Paid Tier (Berbayar)

| Model ID | Nama | Provider | Input/1K | Output/1K | Avg/Message |
|----------|------|----------|----------|-----------|-------------|
| `gpt-4o` | GPT-4o | OpenAI | 50 | 150 | ~200 |
| `gpt-4o-mini` | GPT-4o Mini | OpenAI | 10 | 30 | ~40 |
| `claude-3.5-sonnet` | Claude 3.5 Sonnet | Anthropic | 60 | 180 | ~240 |
| `claude-3-haiku` | Claude 3 Haiku | Anthropic | 10 | 40 | ~50 |
| `gemini-pro` | Gemini Pro | Google | 40 | 120 | ~160 |
| `gemini-flash` | Gemini Flash | Google | 8 | 25 | ~33 |
| `deepseek-chat` | DeepSeek Chat | DeepSeek | 8 | 20 | ~28 |
| `deepseek-coder` | DeepSeek Coder | DeepSeek | 10 | 25 | ~35 |
| `mistral-large` | Mistral Large | Mistral | 30 | 90 | ~120 |
| `mistral-medium` | Mistral Medium | Mistral | 20 | 60 | ~80 |

**Note**: Harga dalam "tokens" internal Alephdraad, bukan token API asli provider.

---

## 📊 Estimasi Penggunaan

### Per Jenis Percakapan

| Jenis | Input Tokens | Output Tokens | Total (GPT-4o) |
|-------|--------------|---------------|----------------|
| Chat pendek | 50-100 | 50-100 | ~75-150 |
| Pertanyaan teknis | 100-200 | 200-500 | ~150-400 |
| Request kode | 200-500 | 500-1500 | ~300-1000 |
| Diskusi panjang | 500-1000 | 500-1000 | ~400-800 |
| Analisis dokumen | 1000-5000 | 500-2000 | ~600-3000 |

### Contoh dengan Paket Starter (10,500 tokens)

Menggunakan GPT-4o (avg 200 tokens/message):

| Skenario | Messages | Total Tokens |
|----------|----------|--------------|
| Chat casual | ~50 messages | 10,000 |
| Coding help | ~30 messages | 9,000 |
| Analisis | ~15 messages | 9,000 |

---

## 💳 Flow Pembelian

### 1. Cek Saldo

```javascript
GET /api/v1/chat/tokens/balance

Response:
{
  "success": true,
  "data": {
    "tokens": 500,
    "freeTokensRemaining": 0
  }
}
```

### 2. Lihat Paket

```javascript
GET /api/v1/chat/tokens/packages

Response:
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "pkg_starter",
        "name": "Starter",
        "tokenAmount": 10000,
        "bonusTokens": 500,
        "priceIdr": 50000,
        "description": "Paket untuk pemula"
      },
      // ...
    ]
  }
}
```

### 3. Beli Paket

```javascript
POST /api/v1/chat/tokens/purchase
{
  "packageId": "pkg_starter"
}

Response:
{
  "success": true,
  "data": {
    "transactionId": "txn_01HN5...",
    "package": {
      "id": "pkg_starter",
      "name": "Starter"
    },
    "tokensAdded": 10500,
    "amountCharged": 50000,
    "newBalance": {
      "tokens": 11000,
      "walletBalance": 100000
    }
  }
}
```

---

## 📈 Pricing Strategy

### Mengapa Token-Based?

1. **Transparansi**: User tahu exactly berapa yang dipakai
2. **Flexibility**: Bisa beli sesuai kebutuhan
3. **Fair**: Bayar sesuai usage, tidak flat rate
4. **Scalable**: Bisa adjust harga per model

### Margin Calculation

```
Provider Cost (GPT-4o example):
- Input: $2.50 / 1M tokens
- Output: $10.00 / 1M tokens

Alephdraad Pricing:
- Input: 50 tokens / 1K = Rp 50 (dari Rp 5000/1K)
- Output: 150 tokens / 1K = Rp 150

Margin: ~40-60% (untuk infrastructure, support, profit)
```

---

## 🔄 Token Deduction Flow

### Backend Logic

```csharp
public async Task<SendMessageResult> SendMessageAsync(
    string sessionId, 
    int userId, 
    string content)
{
    var session = await GetSessionAsync(sessionId);
    
    // 1. Estimate token cost
    int estimatedCost = EstimateTokenCost(session.Model, content.Length);
    
    // 2. Check balance
    var balance = await _tokenService.GetBalanceAsync(userId);
    if (balance.Tokens < estimatedCost)
    {
        throw new InsufficientTokensException(balance.Tokens, estimatedCost);
    }
    
    // 3. Call AI provider
    var (response, actualTokens) = await CallAIProvider(session, content);
    
    // 4. Deduct tokens (using actual usage)
    await _tokenService.DeductTokensAsync(
        userId, 
        actualTokens, 
        $"Chat message in session {sessionId}"
    );
    
    // 5. Return result
    return new SendMessageResult
    {
        MessageId = messageId,
        Content = response,
        TokensUsed = actualTokens,
        RemainingBalance = await _tokenService.GetBalanceAsync(userId)
    };
}
```

---

## ⚠️ Edge Cases

### Token Tidak Cukup Mid-Conversation

```javascript
// User punya 100 tokens, tapi AI response butuh 200
// Solusi: Gunakan estimasi konservatif + buffer

const BUFFER_MULTIPLIER = 1.5;
const estimatedCost = baseEstimate * BUFFER_MULTIPLIER;

if (balance < estimatedCost) {
  throw new InsufficientTokensException();
}
```

### Refund untuk Error

```csharp
try
{
    var response = await CallAIProvider(request);
    await DeductTokens(userId, response.TokensUsed);
}
catch (AIProviderException ex)
{
    // Tidak deduct tokens jika provider error
    throw new ServiceException("AI service error. No tokens charged.");
}
```

---

## 📊 Transaction History

### MongoDB Document

```javascript
// Collection: transactions
{
  "_id": "txn_01HN5...",
  "userId": 456,
  "type": "token_usage",
  "tokenAmount": -225,           // Negative for usage
  "description": "GPT-4o chat in session cht_01HN5...",
  "referenceId": "msg_01HN5...",
  "referenceType": "chat_message",
  "balanceBefore": 10500,
  "balanceAfter": 10275,
  "createdAt": ISODate("...")
}
```

### Query History

```javascript
GET /api/v1/chat/tokens/history?limit=10

Response:
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn_01HN5...",
        "type": "token_usage",
        "amount": -225,
        "description": "GPT-4o chat",
        "createdAt": "2026-01-07T10:00:00Z"
      },
      {
        "id": "txn_01HN4...",
        "type": "token_purchase",
        "amount": 10500,
        "description": "Paket Starter",
        "createdAt": "2026-01-07T09:00:00Z"
      }
    ],
    "hasMore": true,
    "cursor": "..."
  }
}
```

---

## 🎁 Free Tokens

### New User Bonus

```csharp
// Saat user pertama kali mengakses chat
public async Task<Wallet> GetOrCreateWalletAsync(int userId)
{
    var wallet = await _wallets.Find(w => w.UserId == userId).FirstOrDefaultAsync();
    
    if (wallet == null)
    {
        wallet = new Wallet
        {
            UserId = userId,
            TokenBalance = 500, // 500 free tokens untuk user baru
            FreeTokensRemaining = 500
        };
        await _wallets.InsertOneAsync(wallet);
        
        // Create transaction record
        await CreateTransaction(userId, 500, "token_bonus", "Welcome bonus tokens");
    }
    
    return wallet;
}
```

### Promo Codes (Future)

```javascript
POST /api/v1/chat/tokens/redeem
{
  "code": "WELCOME2026"
}

Response:
{
  "success": true,
  "data": {
    "tokensAdded": 1000,
    "message": "Selamat! 1000 tokens ditambahkan ke akun Anda."
  }
}
```

---

## 💡 Rekomendasi untuk User

### Hemat Token

1. **Gunakan Free Tier** untuk pertanyaan sederhana
2. **Pilih model yang sesuai**:
   - Simple questions → GPT-4o Mini / Gemini Flash
   - Complex coding → GPT-4o / Claude Sonnet
   - Cost-effective → DeepSeek Chat
3. **Be concise** - prompt yang pendek = lebih murah
4. **Reuse sessions** - context sudah ada, tidak perlu ulang

### Kapan Upgrade Paket

| Kondisi | Rekomendasi |
|---------|-------------|
| Casual user, 1-5 chats/hari | Starter |
| Active user, 10+ chats/hari | Pro |
| Tim 2-5 orang | Business |
| Heavy usage, enterprise | Enterprise |

---

## ▶️ Selanjutnya

- [../08-deployment/70_DEPLOYMENT_OVERVIEW.md](../08-deployment/70_DEPLOYMENT_OVERVIEW.md) - Deployment
- [../09-improvements/80_IMPROVEMENT_SUGGESTIONS.md](../09-improvements/80_IMPROVEMENT_SUGGESTIONS.md) - Saran perbaikan
