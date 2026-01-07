# 🔌 Feature Service Overview

> Dokumentasi Feature Service - microservice ASP.NET Core untuk fitur sosial dan finansial.

---

## 🎯 Apa itu Feature Service?

Feature Service adalah **microservice kedua** Alephdraad yang dibangun menggunakan:
- **Bahasa**: C# 12
- **Framework**: ASP.NET Core 8
- **Database**: MongoDB
- **Validation**: FluentValidation
- **Logging**: Serilog
- **Docs**: Swagger/OpenAPI

---

## 📋 Tanggung Jawab Feature Service

| Domain | Fitur |
|--------|-------|
| **Social** | Replies, Reactions |
| **Finance** | Wallets, Transfers, Withdrawals |
| **AI Chat** | Aleph Assistant, Token management |
| **Moderation** | Reports, Warnings, Device bans |
| **Documents** | User document storage |

---

## 📂 Struktur Folder

```
feature-service/
├── docker-compose.yml       # Docker compose untuk dev
├── Dockerfile               # Docker image
├── FeatureService.sln       # Solution file
│
└── src/
    └── FeatureService.Api/
        ├── Program.cs           # Entry point
        ├── appsettings.json     # Config
        │
        ├── Controllers/         # HTTP endpoints
        │   ├── ChatController.cs
        │   ├── DocumentController.cs
        │   ├── ReportController.cs
        │   ├── HealthController.cs
        │   ├── AdminModerationController.cs
        │   ├── Social/
        │   │   ├── RepliesController.cs
        │   │   └── ReactionsController.cs
        │   └── Finance/
        │       ├── WalletsController.cs
        │       ├── TransfersController.cs
        │       ├── DisputesController.cs
        │       └── WithdrawalsController.cs
        │
        ├── DTOs/                # Data Transfer Objects
        │
        ├── Infrastructure/      # Technical concerns
        │   ├── MongoDB/         # Database context
        │   └── Auth/            # JWT utilities
        │
        ├── Middleware/          # HTTP pipeline
        │
        ├── Models/              # Data models
        │
        ├── Services/            # Business logic
        │   ├── ReplyService.cs
        │   ├── ReactionService.cs
        │   ├── WalletService.cs
        │   ├── TokenService.cs
        │   ├── ChatService.cs
        │   ├── HuggingFaceService.cs
        │   ├── ExternalLlmService.cs
        │   ├── DocumentService.cs
        │   ├── ReportService.cs
        │   ├── UserWarningService.cs
        │   ├── DeviceBanService.cs
        │   └── AdminModerationService.cs
        │
        └── Validators/          # Input validation
```

---

## 🔄 Request Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        HTTP Request                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Middleware Pipeline                          │
│  1. CorrelationId                                                │
│  2. RequestLogging                                               │
│  3. ErrorHandling                                                │
│  4. Authentication (JWT)                                         │
│  5. Authorization                                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Controller                                  │
│  • Model binding                                                 │
│  • Validation (FluentValidation)                                 │
│  • Call service                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Service                                     │
│  • Business logic                                                │
│  • MongoDB operations                                            │
│  • External API calls                                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       MongoDB                                     │
│  • Document storage                                              │
│  • BSON serialization                                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔌 Integrasi dengan Sistem Lain

```
┌─────────────────────────────────────────────────────────────────┐
│                      Feature Service                             │
└─────────────────────────────────────────────────────────────────┘
         │                    │                        │
         │ Shared JWT         │ HTTP                   │ HTTP
         ▼                    ▼                        ▼
┌─────────────────┐  ┌─────────────────┐    ┌─────────────────────┐
│   Backend Gin   │  │   HuggingFace   │    │   n8n Webhook       │
│   (User data)   │  │   (Free AI)     │    │   (Paid AI)         │
└─────────────────┘  └─────────────────┘    └─────────────────────┘
```

**Catatan Penting**: 
- Feature Service **tidak punya user database sendiri**
- User data diambil dari JWT token (shared secret dengan Backend Gin)
- Feature Service hanya menyimpan data yang terkait fiturnya (replies, wallets, etc.)

---

## 🛠️ Registered Services

```csharp
// Social
builder.Services.AddScoped<IReplyService, ReplyService>();
builder.Services.AddScoped<IReactionService, ReactionService>();

// Finance
builder.Services.AddScoped<IWalletService, WalletService>();
// TODO: TransferService

// Moderation
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IDeviceBanService, DeviceBanService>();
builder.Services.AddScoped<IUserWarningService, UserWarningService>();
builder.Services.AddScoped<IAdminModerationService, AdminModerationService>();

// Documents
builder.Services.AddScoped<IDocumentService, DocumentService>();

// AI Chat
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IHuggingFaceService, HuggingFaceService>();
builder.Services.AddScoped<IExternalLlmService, ExternalLlmService>();
```

---

## 🔧 Environment Variables

| Variable | Deskripsi | Contoh |
|----------|-----------|--------|
| `ASPNETCORE_URLS` | Server URL | `http://+:5000` |
| `MONGODB__CONNECTIONSTRING` | MongoDB connection | `mongodb://...` |
| `MONGODB__DATABASENAME` | Database name | `alephdraad_features` |
| `JWT__SECRET` | JWT secret (HARUS sama dengan Backend Gin) | `super_secret_key` |
| `JWT__ISSUER` | JWT issuer | `alephdraad-api` |
| `JWT__AUDIENCE` | JWT audience | `alephdraad-users` |
| `CORS__ALLOWEDORIGINS__0` | Allowed CORS origin | `https://alephdraad.fun` |
| `HUGGINGFACE__APIKEY` | HuggingFace API key | `hf_xxx` |
| `HUGGINGFACE__MODEL` | HuggingFace model ID | `meta-llama/Llama-3.3-70B-Instruct` |
| `EXTERNALLM__WEBHOOKURL` | n8n webhook URL | `https://n8n.../webhook/...` |

---

## 🏃 Menjalankan Feature Service

### Development

```bash
cd feature-service/src/FeatureService.Api
dotnet restore
dotnet run

# Akses Swagger UI
open http://localhost:5000/swagger
```

### Docker

```bash
cd feature-service
docker-compose up -d
```

### Build Production

```bash
dotnet publish -c Release -o ./publish
```

---

## 📊 Health Check

```
GET /health
```

**Response**:
```json
{
  "status": "Healthy",
  "results": {
    "mongodb": {
      "status": "Healthy"
    }
  }
}
```

---

## ▶️ Selanjutnya

- [31_FEATURE_SERVICE_ENDPOINTS.md](./31_FEATURE_SERVICE_ENDPOINTS.md) - API endpoints
- [32_FEATURE_SERVICE_SERVICES.md](./32_FEATURE_SERVICE_SERVICES.md) - Service layer
- [33_FEATURE_SERVICE_AI_INTEGRATION.md](./33_FEATURE_SERVICE_AI_INTEGRATION.md) - AI integration
