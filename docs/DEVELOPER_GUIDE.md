# 📖 PANDUAN DEVELOPER AIVALID

> **Versi:** 1.0  
> **Tanggal:** 15 Januari 2026  
> **Klasifikasi:** Developer Guide  
> **Audience:** Developer, AI Assistant

---

## ⚠️ PENTING: BACA SEBELUM MENGERJAKAN

Dokumen ini adalah **panduan wajib** untuk siapapun yang akan melanjutkan pengembangan AIValid, baik developer manusia maupun AI assistant. Ikuti aturan-aturan ini dengan ketat.

---

## 📋 DAFTAR ISI

1. [Prinsip Dasar](#1-prinsip-dasar)
2. [Struktur Proyek](#2-struktur-proyek)
3. [Konvensi Kode](#3-konvensi-kode)
4. [Alur Kerja Development](#4-alur-kerja-development)
5. [API Guidelines](#5-api-guidelines)
6. [Database Guidelines](#6-database-guidelines)
7. [Security Guidelines](#7-security-guidelines)
8. [Testing Guidelines](#8-testing-guidelines)
9. [Deployment](#9-deployment)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. PRINSIP DASAR

### 1.1 Arsitektur Microservices

```
JANGAN:
❌ Mencampur logic antar service
❌ Mengakses database service lain secara langsung
❌ Menduplikasi kode antar service

LAKUKAN:
✅ Komunikasi via HTTP/REST antar service
✅ Setiap service punya database sendiri
✅ Gunakan shared JWT untuk autentikasi
```

### 1.2 Separation of Concerns

| Layer | Tanggung Jawab | Contoh File |
|-------|----------------|-------------|
| **Handler** | HTTP request/response | `handlers/*.go` |
| **Service** | Business logic | `services/*.go` |
| **Repository** | Data access | Ent ORM (generated) |
| **DTO** | Data transfer | `dto/*.go` |
| **Validator** | Input validation | `validators/*.go` |

```go
// BENAR: Handler hanya handle HTTP
func (h *AuthHandler) Login(c *gin.Context) {
    var input dto.LoginInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(400, gin.H{"error": "Invalid input"})
        return
    }
    
    result, err := h.service.Login(c.Request.Context(), input)
    if err != nil {
        handleError(c, err)
        return
    }
    
    c.JSON(200, result)
}

// SALAH: Handler mengandung business logic
func (h *AuthHandler) Login(c *gin.Context) {
    // ❌ Jangan lakukan query database di handler
    user, _ := h.db.User.Query().Where(...).First(ctx)
    // ❌ Jangan lakukan hashing di handler
    hash, _ := bcrypt.GenerateFromPassword(...)
}
```

### 1.3 Error Handling

```go
// Gunakan custom error types
import apperrors "backend-gin/errors"

// Di service
if !user.EmailVerified {
    return nil, apperrors.ErrEmailNotVerified
}

// Di handler
func handleError(c *gin.Context, err error) {
    var appErr *apperrors.AppError
    if errors.As(err, &appErr) {
        c.JSON(appErr.HTTPStatus, gin.H{
            "error": appErr.Message,
            "code":  appErr.Code,
        })
        return
    }
    
    // Log unexpected errors
    logger.Error("Unexpected error", zap.Error(err))
    c.JSON(500, gin.H{"error": "Internal server error"})
}
```

---

## 2. STRUKTUR PROYEK

### 2.1 Monorepo Structure

```
aivalid/
├── backend/                 # Go Backend (Core API)
│   ├── main.go              # Entry point
│   ├── config/              # Configuration
│   ├── database/            # DB connections
│   ├── dto/                 # Request/Response structs
│   ├── ent/                 # Ent ORM
│   │   ├── schema/          # ⭐ Entity definitions
│   │   └── ...              # Generated code
│   ├── errors/              # Custom errors
│   ├── handlers/            # HTTP handlers
│   ├── middleware/          # Middleware chain
│   ├── services/            # Business logic
│   ├── tests/               # Tests
│   ├── utils/               # Utilities
│   └── validators/          # Input validators
│
├── feature-service/         # .NET Feature Service
│   └── src/
│       └── FeatureService.Api/
│           ├── Controllers/ # API endpoints
│           ├── Services/    # Business logic
│           ├── Models/      # Entity models
│           │   └── Entities/
│           ├── DTOs/        # Request/Response
│           ├── Validators/  # FluentValidation
│           └── Infrastructure/
│
├── frontend/                # Next.js Frontend
│   ├── app/                 # App Router pages
│   │   ├── (route)/         # Route groups
│   │   ├── api/             # API routes (BFF)
│   │   └── layout.js        # Root layout
│   ├── components/          # React components
│   │   └── ui/              # Base UI components
│   ├── lib/                 # Utilities & hooks
│   └── public/              # Static assets
│
└── docs/                    # Documentation
```

### 2.2 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Go Files** | snake_case | `auth_service_ent.go` |
| **Go Structs** | PascalCase | `LoginRequest` |
| **Go Functions** | PascalCase (public) | `CreateUser()` |
| **Go Variables** | camelCase | `userID` |
| **TypeScript Files** | camelCase | `featureApi.js` |
| **React Components** | PascalCase | `Header.js` |
| **CSS Classes** | kebab-case | `user-profile` |
| **API Endpoints** | kebab-case | `/api/auth/forgot-password` |
| **DB Tables** | snake_case (plural) | `users`, `validation_cases` |
| **DB Columns** | snake_case | `created_at` |
| **MongoDB Collections** | lowercase | `wallets`, `transactions` |

---

## 3. KONVENSI KODE

### 3.1 Go Backend

**Imports Order:**
```go
import (
    // Standard library
    "context"
    "fmt"
    "time"
    
    // Third-party
    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
    
    // Internal packages
    "backend-gin/ent"
    "backend-gin/services"
)
```

**Error Messages in Indonesian:**
```go
// User-facing errors in Indonesian
apperrors.ErrEmailAlreadyExists = &AppError{
    Code:       "AUTH002",
    Message:    "Email sudah terdaftar",
    HTTPStatus: 409,
}

// Log messages in English
logger.Error("Failed to create user", zap.Error(err))
```

**Handler Pattern:**
```go
func (h *Handler) ActionName(c *gin.Context) {
    // 1. Parse input
    var input dto.ActionInput
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(400, gin.H{"error": "Input tidak valid"})
        return
    }
    
    // 2. Get context values
    userID := c.GetInt("user_id")
    
    // 3. Call service
    result, err := h.service.Action(c.Request.Context(), userID, input)
    
    // 4. Handle errors
    if err != nil {
        handleError(c, err)
        return
    }
    
    // 5. Return response
    c.JSON(200, result)
}
```

### 3.2 .NET Feature Service

**Controller Pattern:**
```csharp
[HttpPost]
[Authorize]
[ProducesResponseType(typeof(ResponseDto), StatusCodes.Status200OK)]
[ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
public async Task<IActionResult> ActionName([FromBody] RequestDto request)
{
    // 1. Validate with FluentValidation (automatic)
    
    // 2. Get user from claims
    var userId = User.GetUserId();
    
    // 3. Call service
    var result = await _service.ActionAsync(userId, request);
    
    // 4. Return response
    return Ok(result);
}
```

**Service Pattern:**
```csharp
public class ExampleService : IExampleService
{
    private readonly IMongoCollection<Entity> _collection;
    private readonly ILogger<ExampleService> _logger;
    
    public ExampleService(MongoDbContext db, ILogger<ExampleService> logger)
    {
        _collection = db.GetCollection<Entity>("entities");
        _logger = logger;
    }
    
    public async Task<Entity> GetByIdAsync(string id)
    {
        return await _collection.Find(e => e.Id == id).FirstOrDefaultAsync();
    }
}
```

### 3.3 Next.js Frontend

**Component Pattern:**
```jsx
// components/ExampleComponent.jsx
'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/lib/UserContext'

export function ExampleComponent({ prop1, prop2 }) {
    const { user } = useUser()
    const [state, setState] = useState(null)
    
    useEffect(() => {
        // Side effects
    }, [])
    
    return (
        <div className="example-component">
            {/* JSX */}
        </div>
    )
}
```

**API Client Pattern:**
```javascript
// lib/api.js
export async function fetchJsonAuth(path, options = {}) {
    const token = await getValidToken()
    if (!token) {
        throw new Error("Sesi telah berakhir")
    }
    
    const res = await fetch(`${getApiBase()}${path}`, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
        },
    })
    
    if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Request failed")
    }
    
    return res.json()
}
```

**Custom Hook Pattern:**
```javascript
// lib/hooks.js
export function useExample(id) {
    const { data, error, isLoading, mutate } = useSWR(
        id ? `/api/examples/${id}` : null,
        fetchJsonAuth
    )
    
    return {
        example: data,
        error,
        isLoading,
        refresh: mutate,
    }
}
```

---

## 4. ALUR KERJA DEVELOPMENT

### 4.1 Branching Strategy

```
main                   # Production branch
├── develop            # Development branch
│   ├── feature/xxx    # Feature branches
│   ├── fix/xxx        # Bug fix branches
│   └── refactor/xxx   # Refactoring branches
└── hotfix/xxx         # Emergency fixes
```

### 4.2 Commit Messages

```
Format: <type>: <description>

Types:
- feat: Fitur baru
- fix: Bug fix
- refactor: Refactoring kode
- docs: Dokumentasi
- test: Testing
- chore: Maintenance

Examples:
- feat: add passkey authentication
- fix: resolve session_id required error
- refactor: extract auth middleware
- docs: update API documentation
```

### 4.3 Pull Request Checklist

```markdown
- [ ] Kode sudah di-lint dan format
- [ ] Test coverage tidak berkurang
- [ ] Tidak ada console.log/fmt.Println yang ketinggalan
- [ ] Error messages dalam Bahasa Indonesia
- [ ] API changes sudah didokumentasikan
- [ ] Security implications sudah dipertimbangkan
```

### 4.4 Development Workflow

```
1. Buat branch dari develop
   git checkout -b feature/new-feature develop

2. Develop dan commit
   git add -A
   git commit -m "feat: implement new feature"

3. Push dan buat PR
   git push origin feature/new-feature

4. Review dan merge ke develop

5. Deploy ke staging (develop → staging)

6. Test di staging

7. Merge develop → main untuk production
```

---

## 5. API GUIDELINES

### 5.1 REST Conventions

```
GET    /api/resources          # List resources
GET    /api/resources/:id      # Get single resource
POST   /api/resources          # Create resource
PUT    /api/resources/:id      # Update resource (full)
PATCH  /api/resources/:id      # Update resource (partial)
DELETE /api/resources/:id      # Delete resource
```

### 5.2 Response Format

```javascript
// Success Response
{
    "data": { ... },          // For single resource
    "data": [ ... ],          // For list
    "message": "Success"      // Optional
}

// Success with Pagination
{
    "data": [ ... ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 150,
        "total_pages": 8
    }
}

// Error Response
{
    "error": "Pesan error dalam Bahasa Indonesia",
    "code": "ERR_CODE",       // For programmatic handling
    "details": { ... }        // Optional additional info
}
```

### 5.3 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### 5.4 Authentication Headers

```
Authorization: Bearer <access_token>
X-Sudo-Token: <sudo_token>         # For sensitive operations
X-Device-Fingerprint: <fingerprint> # For device tracking
```

---

## 6. DATABASE GUIDELINES

### 6.1 PostgreSQL (Backend)

**Schema Changes dengan Ent:**
```bash
# 1. Edit schema file
# backend/ent/schema/example.go

# 2. Generate kode
cd backend
go generate ./ent

# 3. Jalankan migrasi
# Ent auto-migrate on startup
```

**Schema Pattern:**
```go
// ent/schema/example.go
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/edge"
    "entgo.io/ent/schema/index"
)

type Example struct {
    ent.Schema
}

func (Example) Fields() []ent.Field {
    return []ent.Field{
        field.String("name").
            NotEmpty().
            MaxLen(100),
        field.Text("description").
            Optional(),
        field.Int("user_id").
            Positive(),
        field.Time("created_at").
            Default(time.Now).
            Immutable(),
    }
}

func (Example) Edges() []ent.Edge {
    return []ent.Edge{
        edge.From("user", User.Type).
            Ref("examples").
            Field("user_id").
            Required().
            Unique(),
    }
}

func (Example) Indexes() []ent.Index {
    return []ent.Index{
        index.Fields("user_id"),
        index.Fields("name", "user_id").Unique(),
    }
}
```

### 6.2 MongoDB (Feature Service)

**Collection Naming:**
- Lowercase
- Plural
- Examples: `wallets`, `transactions`, `replies`

**Document Pattern:**
```csharp
// Models/Entities/Example.cs
public class Example
{
    [BsonId]
    public string Id { get; set; } = $"ex_{Ulid.NewUlid()}";
    
    [BsonElement("userId")]
    public uint UserId { get; set; }
    
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;
    
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

**Index Creation:**
```csharp
// In service constructor
var indexModel = new CreateIndexModel<Example>(
    Builders<Example>.IndexKeys.Ascending(e => e.UserId),
    new CreateIndexOptions { Unique = false }
);
_collection.Indexes.CreateOne(indexModel);
```

---

## 7. SECURITY GUIDELINES

### 7.1 WAJIB DIIKUTI

```
❌ JANGAN PERNAH:
- Menyimpan password dalam plain text
- Log data sensitif (password, token, PIN)
- Hardcode secret/credentials
- Menonaktifkan HTTPS
- Skip validasi input
- Menggunakan eval() atau SQL raw tanpa parameterized query
- Menampilkan stack trace ke user
- Menyimpan JWT secret di frontend

✅ SELALU:
- Gunakan bcrypt untuk password (cost ≥ 10)
- Gunakan PBKDF2 untuk PIN (iterations ≥ 310,000)
- Validasi semua input di server side
- Gunakan parameterized queries
- Set security headers
- Rate limit endpoint sensitif
- Log security events
- Require 2FA untuk financial operations
```

### 7.2 Input Validation

```go
// validators/auth_validator.go
type RegisterInput struct {
    Email    string `json:"email" validate:"required,email,max=255"`
    Password string `json:"password" validate:"required,min=8,max=72"`
    Username string `json:"username" validate:"omitempty,alphanum,min=3,max=20"`
}

func (r *RegisterInput) Validate() error {
    validate := validator.New()
    return validate.Struct(r)
}
```

### 7.3 Sensitive Data

```go
// Gunakan tag Sensitive di Ent schema
field.String("password_hash").
    NotEmpty().
    Sensitive()  // Tidak akan masuk ke JSON

field.String("totp_secret").
    Optional().
    Sensitive()
```

### 7.4 Rate Limiting Pattern

```go
// Untuk endpoint sensitif
var authLimiter = middleware.NewRateLimiter(10, time.Minute)

func RateLimit(limiter *RateLimiter) gin.HandlerFunc {
    return func(c *gin.Context) {
        if !limiter.Allow(c.ClientIP()) {
            c.AbortWithStatusJSON(429, gin.H{
                "error": "Terlalu banyak permintaan. Coba lagi nanti.",
            })
            return
        }
        c.Next()
    }
}
```

---

## 8. TESTING GUIDELINES

### 8.1 Test Structure

```
backend/tests/
├── unit/
│   ├── services/
│   │   └── auth_service_test.go
│   └── validators/
│       └── auth_validator_test.go
├── integration/
│   └── auth_flow_test.go
└── mocks/
    └── mock_services.go
```

### 8.2 Unit Test Pattern

```go
// tests/unit/services/auth_service_test.go
func TestRegister_Success(t *testing.T) {
    // Arrange
    ctx := context.Background()
    service := NewEntAuthService()
    input := validators.RegisterInput{
        Email:    "test@example.com",
        Password: "SecureP@ss123",
    }
    
    // Act
    result, err := service.Register(ctx, input)
    
    // Assert
    assert.NoError(t, err)
    assert.NotNil(t, result)
    assert.Equal(t, "test@example.com", result.Email)
}

func TestRegister_DuplicateEmail(t *testing.T) {
    // ... test duplicate email returns error
}
```

### 8.3 Running Tests

```bash
# Go Backend
cd backend
go test ./... -v                    # All tests
go test ./services/... -v           # Specific package
go test -coverprofile=coverage.out  # With coverage
go tool cover -html=coverage.out    # View coverage

# .NET Feature Service
cd feature-service
dotnet test                         # All tests
dotnet test --filter "Category=Unit" # Filtered

# Frontend
cd frontend
npm run lint                        # Lint check
npm run typecheck                   # Type check
```

---

## 9. DEPLOYMENT

### 9.1 Environment Variables

**Backend (.env):**
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@aivalid.id
SMTP_PASS=your-password

# Redis
REDIS_URL=redis://localhost:6379

# WebAuthn
WEBAUTHN_RP_ID=aivalid.id
WEBAUTHN_RP_ORIGINS=https://aivalid.id

# Frontend
FRONTEND_BASE_URL=https://aivalid.id
```

**Feature Service (.env):**
```env
# MongoDB
MONGODB__CONNECTIONSTRING=mongodb+srv://...
MONGODB__DATABASENAME=aivalid

# JWT (same as backend)
JWT__SECRET=your-secret-key
JWT__ISSUER=aivalid
JWT__AUDIENCE=aivalid-users

# CORS
CORS__ALLOWEDORIGINS__0=https://aivalid.id
```

### 9.2 Deployment Commands

```bash
# Backend (Go) — NOTE: host/user/path/service name harus diverifikasi per environment.
# Referensi evidence-only: docs/FACT_MAP_REPO_RUNTIME.md
ssh <user>@<vps-host>
cd <deploy-dir>
git pull origin main
cd backend
go build -o app .
sudo systemctl restart <go-backend-service>

# Feature Service (.NET) — NOTE: host/user/path/service name harus diverifikasi per environment.
ssh <user>@<vps-host>
cd <deploy-dir>
git pull origin main
cd feature-service/src/FeatureService.Api
dotnet publish -c Release
sudo systemctl restart <feature-service-name>

# Frontend (Vercel)
# Auto-deploy dari GitHub push ke main
```

### 9.3 Health Checks

```bash
# Backend
curl https://api.aivalid.id/health

# Feature Service
curl https://feature.aivalid.id/api/v1/health

# Check services
sudo systemctl status <go-backend-service>
sudo systemctl status <feature-service-name>
```

---

## 10. TROUBLESHOOTING

### 10.1 Common Issues

**Issue: Session expired error loop**
```
Cause: Token refresh failing
Solution:
1. Check JWT_SECRET sama di backend dan feature service
2. Check Redis connection
3. Clear browser localStorage
```

**Issue: CORS error**
```
Cause: Origin tidak di whitelist
Solution:
1. Add origin ke CORS_ALLOWED_ORIGINS
2. Restart service
```

**Issue: 502 Bad Gateway**
```
Cause: Service not running
Solution:
1. sudo systemctl status backend
2. Check logs: journalctl -u backend -f
3. Restart: sudo systemctl restart backend
```

**Issue: Database connection error**
```
Cause: Connection pool exhausted atau network
Solution:
1. Check DATABASE_URL format
2. Check connection limits
3. Restart service
```

### 10.2 Logging

```bash
# Backend logs
sudo journalctl -u backend -f

# Feature Service logs
sudo journalctl -u featureservice -f

# Nginx/Caddy logs
sudo tail -f /var/log/caddy/access.log
```

### 10.3 Debug Mode

```bash
# Go Backend (development only!)
GIN_MODE=debug go run main.go

# .NET Feature Service
ASPNETCORE_ENVIRONMENT=Development dotnet run
```

---

## 📞 KONTAK

| Role | Kontak |
|------|--------|
| Technical Issues | dev@aivalid.id |
| Security Issues | security@aivalid.id |
| Emergency | admin@aivalid.id |

---

*Dokumen ini adalah panduan wajib untuk pengembangan AIValid. Terakhir diperbarui: 10 Februari 2026.*
