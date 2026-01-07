# 🎮 Backend Gin Handlers

> Dokumentasi handlers yang memproses HTTP requests.

---

## 🎯 Apa itu Handler?

Handler adalah fungsi yang:
1. Menerima HTTP request dari user
2. Memvalidasi input
3. Memanggil service layer
4. Mengembalikan HTTP response

```
HTTP Request → Handler → Service → Database
                 ↓
           HTTP Response
```

---

## 📂 Daftar Handler Files

| File | Tanggung Jawab |
|------|----------------|
| `auth_handler.go` | Login, Register, Token refresh |
| `totp_handler.go` | 2FA TOTP operations |
| `passkey_handler.go` | WebAuthn/Passkey |
| `sudo_handler.go` | Sudo mode verification |
| `user_handler.go` | User profile operations |
| `account.go` | Account management |
| `username.go` | Username operations |
| `thread_handler.go` | Thread CRUD |
| `badge_detail.go` | Badge info |
| `badges.go` | Badge management |
| `user_badge_handler.go` | User-badge relations |
| `admin_handler.go` | Admin operations |
| `rag.go` | AI search/explain |
| `health.go` | Health check |

---

## 🔐 AuthHandler

### Struct Definition

```go
type AuthHandler struct {
    authService     *services.AuthService
    sessionService  *services.SessionService
    loginLimiter    *middleware.RateLimiter
    registerLimiter *middleware.RateLimiter
    verifyLimiter   *middleware.RateLimiter
    refreshLimiter  *middleware.RateLimiter
}
```

### Methods

#### Register

```go
func (h *AuthHandler) Register(c *gin.Context)
```

**Flow**:
1. Check rate limit
2. Parse JSON body ke `dto.RegisterRequest`
3. Validate input dengan `validators.RegisterInput`
4. Call `authService.RegisterWithDevice(...)`
5. Return 201 dengan message

**Error Handling**:
```go
if !h.registerLimiter.Allow(c.ClientIP()) {
    handleError(c, apperrors.ErrTooManyRequests)
    return
}
```

#### Login

```go
func (h *AuthHandler) Login(c *gin.Context)
```

**Flow**:
1. Check rate limit
2. Parse JSON body
3. Call `authService.LoginWithDevice(...)`
4. If 2FA required → return `tempToken`
5. If success → return JWT tokens

#### LoginTOTP

```go
func (h *AuthHandler) LoginTOTP(c *gin.Context)
```

Validates TOTP code dan exchanges temp token untuk JWT.

#### RefreshToken

```go
func (h *AuthHandler) RefreshToken(c *gin.Context)
```

**Flow**:
1. Parse refresh token dari body
2. Validate token
3. Check session validity
4. Generate new token pair
5. Return new tokens

---

## 🛡️ TOTPHandler

### Struct Definition

```go
type TOTPHandler struct {
    totpService *services.TOTPService
    logger      *zap.Logger
}
```

### Methods

#### Setup

```go
func (h *TOTPHandler) Setup(c *gin.Context)
```

**Returns**:
```json
{
  "secret": "BASE32SECRET",
  "qrCode": "data:image/png;base64,...",
  "recoveryKey": "XXXX-XXXX-XXXX-XXXX"
}
```

#### Verify

```go
func (h *TOTPHandler) Verify(c *gin.Context)
```

Verifies TOTP code dan enables 2FA.

#### GenerateBackupCodes

```go
func (h *TOTPHandler) GenerateBackupCodes(c *gin.Context)
```

Generates 10 one-time backup codes.

---

## 🔑 PasskeyHandler

### Struct Definition

```go
type PasskeyHandler struct {
    passkeyService *services.PasskeyService
    authService    *services.AuthService
    logger         *zap.Logger
}
```

### WebAuthn Flow

#### Begin Registration

```go
func (h *PasskeyHandler) BeginRegistration(c *gin.Context)
```

**Returns**: WebAuthn challenge untuk browser API.

#### Finish Registration

```go
func (h *PasskeyHandler) FinishRegistration(c *gin.Context)
```

**Receives**: Signed credential dari browser.

#### Begin Login

```go
func (h *PasskeyHandler) BeginLogin(c *gin.Context)
```

**Returns**: WebAuthn assertion options.

#### Finish Login

```go
func (h *PasskeyHandler) FinishLogin(c *gin.Context)
```

**Returns**: JWT tokens jika berhasil.

---

## 🔒 SudoHandler

### Struct Definition

```go
type SudoHandler struct {
    sudoService *services.SudoService
    logger      *zap.Logger
}
```

### Methods

#### Verify

```go
func (h *SudoHandler) Verify(c *gin.Context)
```

**Request**:
```json
{
  "method": "password",  // atau "totp"
  "credential": "user_password"
}
```

**Response**:
```json
{
  "sudoToken": "sudo_xxx",
  "expiresAt": "2026-01-07T10:30:00Z"
}
```

#### GetStatus

```go
func (h *SudoHandler) GetStatus(c *gin.Context)
```

Checks if user is in sudo mode.

---

## 📝 ThreadHandler

### Struct Definition

```go
type ThreadHandler struct {
    threadService services.ThreadServiceInterface
}
```

### Methods

#### CreateThread

```go
func (h *ThreadHandler) CreateThread(c *gin.Context)
```

**Request**:
```json
{
  "title": "Thread Title",
  "categoryId": 1,
  "summary": "Short summary",
  "contentJson": { ... }
}
```

**Validation**:
- Title: 10-200 characters
- Summary: max 500 characters
- CategoryId: must exist

#### GetThreadDetail

```go
func (h *ThreadHandler) GetThreadDetail(c *gin.Context)
```

**Auth Required**: Yes

Returns full thread dengan author info.

#### GetPublicThreadDetail

```go
func (h *ThreadHandler) GetPublicThreadDetail(c *gin.Context)
```

**Auth Required**: No

Returns thread tanpa sensitive data.

#### UpdateThread

```go
func (h *ThreadHandler) UpdateThread(c *gin.Context)
```

**Auth Required**: Yes (must be author)

---

## 👤 UserHandler

### Struct Definition

```go
type UserHandler struct {
    userService *services.UserService
}
```

### Methods

#### GetUserInfo

```go
func (h *UserHandler) GetUserInfo(c *gin.Context)
```

**Auth Required**: Yes

Returns current user's full info.

#### GetPublicUserProfile

```go
func (h *UserHandler) GetPublicUserProfile(c *gin.Context)
```

**Auth Required**: No

Returns public profile by username.

---

## 📂 Account Handlers

Defined in `account.go`:

#### GetMyAccountHandler

```go
func GetMyAccountHandler(c *gin.Context)
```

Returns detailed account info.

#### UpdateMyAccountHandler

```go
func UpdateMyAccountHandler(c *gin.Context)
```

Updates account settings.

#### DeleteAccountHandler

```go
func DeleteAccountHandler(c *gin.Context)
```

**Requires**: Auth + Sudo mode

Soft-deletes account.

---

## 🔍 RAG Handlers

Defined in `rag.go`:

#### SearchThreadsHandler

```go
func SearchThreadsHandler(c *gin.Context)
```

**Query Params**: `q` (search query)

Uses embedding-based search.

#### ExplainThreadHandler

```go
func ExplainThreadHandler(c *gin.Context)
```

**Rate Limited**: 2/minute

AI explains thread content.

---

## ⚠️ Error Handling Pattern

```go
func handleError(c *gin.Context, err error) {
    // Check if it's an AppError
    if appErr, ok := err.(*apperrors.AppError); ok {
        c.JSON(appErr.StatusCode, gin.H{
            "error": appErr.Message,
            "code":  appErr.Code,
        })
        return
    }

    // Unknown error - log and return generic message
    logger.Error("Unhandled error", zap.Error(err))
    c.JSON(http.StatusInternalServerError, gin.H{
        "error": "Terjadi kesalahan internal"
    })
}
```

---

## 🎯 Handler Best Practices

### 1. Input Validation First

```go
func (h *Handler) CreateSomething(c *gin.Context) {
    var req dto.CreateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        handleError(c, apperrors.ErrInvalidInput)
        return
    }
    
    // Validate with custom validators
    if err := validators.ValidateCreate(req); err != nil {
        handleError(c, err)
        return
    }
    
    // Then call service
    result, err := h.service.Create(req)
    // ...
}
```

### 2. Get User from Context

```go
func (h *Handler) MyEndpoint(c *gin.Context) {
    // User ID from JWT middleware
    userID := c.GetUint("userID")
    
    // Email from JWT
    email := c.GetString("email")
    
    // Username
    username := c.GetString("username")
}
```

### 3. Rate Limiting

```go
func NewHandler() *Handler {
    return &Handler{
        limiter: middleware.NewRateLimiter(10, time.Minute),
    }
}

func (h *Handler) Endpoint(c *gin.Context) {
    if !h.limiter.Allow(c.ClientIP()) {
        handleError(c, apperrors.ErrTooManyRequests)
        return
    }
    // ...
}
```

---

## ▶️ Selanjutnya

- [23_BACKEND_GIN_SERVICES.md](./23_BACKEND_GIN_SERVICES.md) - Service layer
- [24_BACKEND_GIN_MIDDLEWARE.md](./24_BACKEND_GIN_MIDDLEWARE.md) - Middlewares
