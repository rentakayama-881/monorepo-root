# ⚙️ Feature Service - Services

> Dokumentasi service layer Feature Service yang berisi business logic.

---

## 📂 Service Overview

| Service | Interface | Deskripsi |
|---------|-----------|-----------|
| `ReplyService` | `IReplyService` | Reply CRUD operations |
| `ReactionService` | `IReactionService` | Reaction management |
| `WalletService` | `IWalletService` | Wallet & balance |
| `TokenService` | `ITokenService` | AI token management |
| `ChatService` | `IChatService` | Chat session orchestration |
| `HuggingFaceService` | `IHuggingFaceService` | Free AI via HuggingFace |
| `ExternalLlmService` | `IExternalLlmService` | Paid AI via n8n webhook |
| `DocumentService` | `IDocumentService` | Document storage |
| `ReportService` | `IReportService` | Content reports |
| `UserWarningService` | `IUserWarningService` | User warnings |
| `DeviceBanService` | `IDeviceBanService` | Device banning |
| `AdminModerationService` | `IAdminModerationService` | Admin operations |

---

## 💬 ReplyService

### Interface

```csharp
public interface IReplyService
{
    Task<Reply> CreateReplyAsync(string threadId, CreateReplyDto dto, int userId, string username);
    Task<PaginatedResult<Reply>> GetRepliesAsync(string threadId, PaginationParams pagination);
    Task<Reply> UpdateReplyAsync(string threadId, string replyId, UpdateReplyDto dto, int userId);
    Task<bool> DeleteReplyAsync(string threadId, string replyId, int userId, bool isAdmin = false);
    Task<Reply?> GetReplyByIdAsync(string replyId);
}
```

### Key Implementation Details

```csharp
public class ReplyService : IReplyService
{
    private readonly IMongoCollection<Reply> _replies;
    private const int MaxDepth = 3;

    public async Task<Reply> CreateReplyAsync(
        string threadId, 
        CreateReplyDto dto, 
        int userId, 
        string username)
    {
        // Validate parent reply if provided
        int depth = 0;
        if (!string.IsNullOrEmpty(dto.ParentReplyId))
        {
            var parent = await GetReplyByIdAsync(dto.ParentReplyId);
            if (parent == null)
                throw new NotFoundException("Parent reply not found");
            
            if (parent.Depth >= MaxDepth)
                throw new ValidationException("Max nesting depth reached");
            
            depth = parent.Depth + 1;
        }

        var reply = new Reply
        {
            Id = GenerateId(),
            ThreadId = threadId,
            Content = dto.Content,
            UserId = userId,
            Username = username,
            ParentReplyId = dto.ParentReplyId,
            Depth = depth,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _replies.InsertOneAsync(reply);
        return reply;
    }
}
```

---

## 👍 ReactionService

### Interface

```csharp
public interface IReactionService
{
    Task<ReactionSummary> GetSummaryAsync(string threadId);
    Task<string?> GetUserReactionAsync(string threadId, int userId);
    Task AddReactionAsync(string threadId, int userId, string reactionType);
    Task RemoveReactionAsync(string threadId, int userId);
}
```

### Reaction Types

```csharp
public static class ReactionTypes
{
    public const string Like = "like";
    public const string Love = "love";
    public const string Fire = "fire";
    public const string Laugh = "laugh";
    public const string Sad = "sad";

    public static readonly string[] All = { Like, Love, Fire, Laugh, Sad };
}
```

### Implementation Pattern

```csharp
public async Task AddReactionAsync(string threadId, int userId, string reactionType)
{
    if (!ReactionTypes.All.Contains(reactionType))
        throw new ValidationException("Invalid reaction type");

    // Remove existing reaction first (one per user per thread)
    await RemoveReactionAsync(threadId, userId);

    var reaction = new Reaction
    {
        Id = GenerateId(),
        ThreadId = threadId,
        UserId = userId,
        Type = reactionType,
        CreatedAt = DateTime.UtcNow
    };

    await _reactions.InsertOneAsync(reaction);
}
```

---

## 💰 WalletService

### Interface

```csharp
public interface IWalletService
{
    Task<Wallet> GetOrCreateWalletAsync(int userId);
    Task<decimal> GetBalanceAsync(int userId);
    Task<Wallet> AddBalanceAsync(int userId, decimal amount, string description);
    Task<Wallet> DeductBalanceAsync(int userId, decimal amount, string description);
    Task<PaginatedResult<Transaction>> GetTransactionsAsync(int userId, PaginationParams pagination);
}
```

### Auto-Create Wallet

```csharp
public async Task<Wallet> GetOrCreateWalletAsync(int userId)
{
    var wallet = await _wallets.Find(w => w.UserId == userId).FirstOrDefaultAsync();
    
    if (wallet == null)
    {
        wallet = new Wallet
        {
            Id = GenerateId(),
            UserId = userId,
            Balance = 0,
            TokenBalance = 0,
            CreatedAt = DateTime.UtcNow
        };
        await _wallets.InsertOneAsync(wallet);
    }
    
    return wallet;
}
```

---

## 🎫 TokenService

### Interface

```csharp
public interface ITokenService
{
    Task<TokenBalance> GetBalanceAsync(int userId);
    Task<List<TokenPackage>> GetPackagesAsync();
    Task<PurchaseResult> PurchaseTokensAsync(int userId, string packageId);
    Task<bool> DeductTokensAsync(int userId, int amount, string description);
    Task<bool> HasSufficientTokensAsync(int userId, int amount);
}
```

### Token Packages

```csharp
private static readonly List<TokenPackage> Packages = new()
{
    new TokenPackage
    {
        Id = "pkg_starter",
        Name = "Starter",
        TokenAmount = 10000,
        PriceIdr = 50000,
        BonusTokens = 500,
        Description = "Paket untuk pemula"
    },
    new TokenPackage
    {
        Id = "pkg_pro",
        Name = "Pro",
        TokenAmount = 50000,
        PriceIdr = 200000,
        BonusTokens = 5000,
        Description = "Paket untuk pengguna aktif"
    },
    new TokenPackage
    {
        Id = "pkg_business",
        Name = "Business",
        TokenAmount = 200000,
        PriceIdr = 600000,
        BonusTokens = 30000,
        Description = "Paket untuk bisnis"
    }
};
```

---

## 🤖 ChatService

Orchestrates chat sessions and AI providers.

### Interface

```csharp
public interface IChatService
{
    Task<ChatSession> CreateSessionAsync(int userId, CreateSessionDto dto);
    Task<PaginatedResult<ChatSession>> GetSessionsAsync(int userId, PaginationParams pagination);
    Task<ChatSession> GetSessionWithMessagesAsync(string sessionId, int userId);
    Task<SendMessageResult> SendMessageAsync(string sessionId, int userId, string content);
    Task DeleteSessionAsync(string sessionId, int userId);
}
```

### Send Message Flow

```csharp
public async Task<SendMessageResult> SendMessageAsync(
    string sessionId, 
    int userId, 
    string content)
{
    var session = await GetSessionAsync(sessionId, userId);
    
    // Get conversation history for context
    var messages = await GetSessionMessagesAsync(sessionId);
    
    // Choose AI provider based on session type
    string response;
    int tokensUsed;
    
    if (session.ServiceType == "huggingface")
    {
        // Free tier - HuggingFace
        (response, tokensUsed) = await _huggingFaceService.GenerateResponseAsync(
            messages, 
            content
        );
    }
    else
    {
        // Paid tier - External LLM via n8n
        // Check token balance first
        if (!await _tokenService.HasSufficientTokensAsync(userId, EstimatedTokens))
            throw new InsufficientTokensException();
        
        (response, tokensUsed) = await _externalLlmService.GenerateResponseAsync(
            session.Model,
            messages, 
            content
        );
        
        // Deduct tokens
        await _tokenService.DeductTokensAsync(userId, tokensUsed, $"Chat: {session.Id}");
    }
    
    // Save messages
    var userMessage = new ChatMessage
    {
        Id = GenerateId(),
        SessionId = sessionId,
        Role = "user",
        Content = content,
        CreatedAt = DateTime.UtcNow
    };
    
    var assistantMessage = new ChatMessage
    {
        Id = GenerateId(),
        SessionId = sessionId,
        Role = "assistant",
        Content = response,
        TokensUsed = tokensUsed,
        CreatedAt = DateTime.UtcNow
    };
    
    await _messages.InsertManyAsync(new[] { userMessage, assistantMessage });
    
    // Update session
    await UpdateSessionLastMessageAsync(sessionId);
    
    return new SendMessageResult
    {
        MessageId = assistantMessage.Id,
        Content = response,
        TokensUsed = tokensUsed,
        RemainingBalance = await _tokenService.GetBalanceAsync(userId)
    };
}
```

---

## 🤗 HuggingFaceService

Free AI tier menggunakan HuggingFace Inference API.

### Configuration

```csharp
public class HuggingFaceSettings
{
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "meta-llama/Llama-3.3-70B-Instruct";
    public string BaseUrl { get; set; } = "https://api-inference.huggingface.co";
}
```

### Implementation

```csharp
public class HuggingFaceService : IHuggingFaceService
{
    private readonly HttpClient _httpClient;
    private readonly HuggingFaceSettings _settings;

    public async Task<(string Response, int TokensUsed)> GenerateResponseAsync(
        List<ChatMessage> history,
        string userMessage)
    {
        // Build prompt with conversation history
        var prompt = BuildPrompt(history, userMessage);
        
        var request = new
        {
            inputs = prompt,
            parameters = new
            {
                max_new_tokens = 2048,
                temperature = 0.7,
                top_p = 0.9,
                do_sample = true
            }
        };
        
        var response = await _httpClient.PostAsJsonAsync(
            $"{_settings.BaseUrl}/models/{_settings.Model}",
            request
        );
        
        var result = await response.Content.ReadFromJsonAsync<HuggingFaceResponse>();
        
        return (result.GeneratedText, EstimateTokens(result.GeneratedText));
    }
}
```

---

## 💎 ExternalLlmService

Paid AI tier via n8n webhook (GPT-4o, Claude, Gemini, dll).

### Configuration

```csharp
public class ExternalLlmSettings
{
    public string WebhookUrl { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 180;
}
```

### Implementation

```csharp
public class ExternalLlmService : IExternalLlmService
{
    private readonly HttpClient _httpClient;
    private readonly ExternalLlmSettings _settings;

    public async Task<(string Response, int TokensUsed)> GenerateResponseAsync(
        string model,
        List<ChatMessage> history,
        string userMessage)
    {
        // Prepare request for n8n webhook
        var request = new
        {
            model = model, // "gpt-4o", "claude-3.5-sonnet", etc.
            messages = history.Select(m => new { role = m.Role, content = m.Content })
                .Append(new { role = "user", content = userMessage })
                .ToArray()
        };
        
        var response = await _httpClient.PostAsJsonAsync(_settings.WebhookUrl, request);
        
        if (!response.IsSuccessStatusCode)
            throw new ExternalServiceException("External LLM service unavailable");
        
        var result = await response.Content.ReadFromJsonAsync<ExternalLlmResponse>();
        
        return (result.Content, result.TokensUsed);
    }
}
```

---

## 🚨 ReportService

### Interface

```csharp
public interface IReportService
{
    Task<Report> SubmitReportAsync(int userId, CreateReportDto dto);
    Task<PaginatedResult<Report>> GetPendingReportsAsync(PaginationParams pagination);
    Task<Report> ResolveReportAsync(string reportId, int adminId, ResolveReportDto dto);
    Task<List<ReportReason>> GetReasonsAsync();
}
```

---

## 🔒 DeviceBanService

### Interface

```csharp
public interface IDeviceBanService
{
    Task<bool> IsDeviceBannedAsync(string fingerprint);
    Task BanDeviceAsync(string fingerprint, int adminId, string reason, DateTime? expiresAt = null);
    Task UnbanDeviceAsync(string fingerprint);
}
```

---

## ⚠️ UserWarningService

### Interface

```csharp
public interface IUserWarningService
{
    Task<Warning> IssueWarningAsync(int userId, int adminId, CreateWarningDto dto);
    Task<List<Warning>> GetUserWarningsAsync(int userId);
    Task<int> GetWarningCountAsync(int userId);
}
```

---

## 🎯 Service Patterns

### Dependency Injection

```csharp
// In Program.cs
builder.Services.AddScoped<IReplyService, ReplyService>();
builder.Services.AddScoped<IReactionService, ReactionService>();
// etc.
```

### Error Handling

```csharp
public class ServiceException : Exception
{
    public int StatusCode { get; }
    public string Code { get; }
    
    public ServiceException(string message, int statusCode = 400, string code = "ERROR")
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
    }
}

public class NotFoundException : ServiceException
{
    public NotFoundException(string message) 
        : base(message, 404, "NOT_FOUND") { }
}

public class InsufficientTokensException : ServiceException
{
    public InsufficientTokensException() 
        : base("Token tidak mencukupi", 402, "INSUFFICIENT_TOKENS") { }
}
```

---

## ▶️ Selanjutnya

- [33_FEATURE_SERVICE_AI_INTEGRATION.md](./33_FEATURE_SERVICE_AI_INTEGRATION.md) - AI integration detail
- [../05-database/40_DATABASE_OVERVIEW.md](../05-database/40_DATABASE_OVERVIEW.md) - Database
