# 🛡️ Backend Gin Middleware

> Dokumentasi middleware yang memproses request sebelum handler.

---

## 🎯 Apa itu Middleware?

Middleware adalah fungsi yang dieksekusi **sebelum** atau **sesudah** handler.

```
Request → Middleware 1 → Middleware 2 → Handler → Response
             ↓               ↓
         (logging)      (auth check)
```

---

## 📂 Daftar Middleware Files

| File | Deskripsi |
|------|-----------|
| `auth.go` | JWT authentication |
| `auth_optional.go` | Optional JWT check |
| `admin_auth.go` | Admin authentication |
| `jwt.go` | JWT parsing utilities |
| `rate_limit.go` | Basic rate limiting |
| `enhanced_rate_limit.go` | Advanced rate limiting |
| `request_size.go` | Body size limit |
| `security.go` | Security headers |
| `sudo.go` | Sudo mode check |

---

## 🔐 AuthMiddleware

Validates JWT token dan sets user context.

### Implementation

```go
// middleware/auth.go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Get token from header
        authHeader := c.GetHeader("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        
        // Parse and validate JWT
        claims, err := ParseJWT(tokenString)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "Token tidak valid"})
            return
        }
        
        // Validate token type
        if claims.TokenType != "" && claims.TokenType != TokenTypeAccess {
            c.AbortWithStatusJSON(401, gin.H{"error": "Token type tidak valid"})
            return
        }
        
        // Get user from database
        var user models.User
        if claims.UserID > 0 {
            err = database.DB.First(&user, claims.UserID).Error
        } else {
            err = database.DB.Where("email = ?", claims.Email).First(&user).Error
        }
        
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "User tidak ditemukan"})
            return
        }
        
        // Check if account is locked
        if isAccountLocked(user.ID) {
            c.AbortWithStatusJSON(403, gin.H{"error": "Akun dikunci"})
            return
        }
        
        // Set user info in context
        c.Set("userID", user.ID)
        c.Set("email", user.Email)
        c.Set("username", user.Username)
        c.Set("user", user)
        
        c.Next()
    }
}
```

### Usage

```go
// In main.go or route setup
api.GET("/protected", middleware.AuthMiddleware(), handler.ProtectedEndpoint)
```

### Accessing User in Handler

```go
func (h *Handler) ProtectedEndpoint(c *gin.Context) {
    userID := c.GetUint("userID")
    email := c.GetString("email")
    username := c.GetString("username")
    user := c.MustGet("user").(models.User)
    
    // Use user info...
}
```

---

## 🔓 OptionalAuthMiddleware

Same as AuthMiddleware but doesn't abort if no token.

```go
func OptionalAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            // No token - continue without user
            c.Next()
            return
        }
        
        // Same validation logic as AuthMiddleware
        // But on error, just continue without user
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        claims, err := ParseJWT(tokenString)
        if err != nil {
            c.Next()
            return
        }
        
        // Set user if valid
        var user models.User
        if err := database.DB.First(&user, claims.UserID).Error; err == nil {
            c.Set("userID", user.ID)
            c.Set("user", user)
        }
        
        c.Next()
    }
}
```

### Usage

```go
// Endpoint accessible by both guests and logged-in users
api.GET("/threads/:id/public", middleware.OptionalAuthMiddleware(), handler.GetPublicThread)
```

---

## 👑 AdminAuthMiddleware

Validates admin JWT with separate secret.

```go
func AdminAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
            return
        }
        
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        
        // Parse with ADMIN_JWT_SECRET
        claims, err := ParseAdminJWT(tokenString)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "Token admin tidak valid"})
            return
        }
        
        // Verify admin exists
        var admin models.Admin
        if err := database.DB.First(&admin, claims.AdminID).Error; err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "Admin tidak ditemukan"})
            return
        }
        
        c.Set("adminID", admin.ID)
        c.Set("admin", admin)
        
        c.Next()
    }
}
```

---

## ⏱️ Rate Limiting

### Basic Rate Limiter

```go
// middleware/rate_limit.go
type RateLimiter struct {
    visitors map[string]*visitor
    mu       sync.Mutex
    limit    int
    window   time.Duration
}

type visitor struct {
    count    int
    lastSeen time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
    rl := &RateLimiter{
        visitors: make(map[string]*visitor),
        limit:    limit,
        window:   window,
    }
    
    // Cleanup goroutine
    go rl.cleanup()
    
    return rl
}

func (rl *RateLimiter) Allow(ip string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()
    
    v, exists := rl.visitors[ip]
    if !exists || time.Since(v.lastSeen) > rl.window {
        rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
        return true
    }
    
    if v.count >= rl.limit {
        return false
    }
    
    v.count++
    v.lastSeen = time.Now()
    return true
}
```

### Usage as Middleware

```go
var loginLimiter = middleware.NewRateLimiter(10, time.Minute)

func LoginRateLimit() gin.HandlerFunc {
    return func(c *gin.Context) {
        if !loginLimiter.Allow(c.ClientIP()) {
            c.AbortWithStatusJSON(429, gin.H{
                "error": "Terlalu banyak percobaan. Silakan coba lagi nanti.",
            })
            return
        }
        c.Next()
    }
}
```

---

## 🔒 Security Headers

```go
// middleware/security.go
func SecurityHeadersMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Prevent clickjacking
        c.Header("X-Frame-Options", "DENY")
        
        // Prevent MIME sniffing
        c.Header("X-Content-Type-Options", "nosniff")
        
        // XSS protection
        c.Header("X-XSS-Protection", "1; mode=block")
        
        // Referrer policy
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        
        // Content Security Policy (basic)
        c.Header("Content-Security-Policy", "default-src 'self'")
        
        c.Next()
    }
}
```

---

## 🔐 Sudo Middleware

Requires sudo mode for critical actions.

```go
// middleware/sudo.go
func RequireSudo(sudoService *services.SudoService) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("userID")
        if userID == 0 {
            c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
            return
        }
        
        // Get sudo token from header
        sudoToken := c.GetHeader("X-Sudo-Token")
        if sudoToken == "" {
            c.AbortWithStatusJSON(403, gin.H{
                "error":       "Sudo mode required",
                "code":        "SUDO_REQUIRED",
                "requireSudo": true,
            })
            return
        }
        
        // Validate sudo token
        valid, err := sudoService.IsInSudoMode(userID, sudoToken)
        if err != nil || !valid {
            c.AbortWithStatusJSON(403, gin.H{
                "error":       "Sudo token expired or invalid",
                "code":        "SUDO_INVALID",
                "requireSudo": true,
            })
            return
        }
        
        c.Next()
    }
}
```

### Usage

```go
// Requires auth AND sudo
api.DELETE("/account", 
    middleware.AuthMiddleware(), 
    middleware.RequireSudo(sudoService), 
    handler.DeleteAccount,
)
```

---

## 📏 Request Size Limit

```go
// middleware/request_size.go
func MaxBodySize(maxBytes int64) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
        c.Next()
    }
}
```

### Usage

```go
// Limit upload to 5MB
api.PUT("/avatar", 
    middleware.AuthMiddleware(),
    middleware.MaxBodySize(5 * 1024 * 1024), 
    handler.UploadAvatar,
)
```

---

## 🔧 JWT Utilities

```go
// middleware/jwt.go

const (
    TokenTypeAccess  = "access"
    TokenTypeRefresh = "refresh"
)

type JWTClaims struct {
    UserID    uint   `json:"user_id"`
    Email     string `json:"email"`
    Username  string `json:"username"`
    TokenType string `json:"token_type"`
    jwt.RegisteredClaims
}

func GenerateTokenPair(user *models.User) (*TokenPair, error) {
    // Access token (short-lived)
    accessClaims := JWTClaims{
        UserID:    user.ID,
        Email:     user.Email,
        Username:  user.Username,
        TokenType: TokenTypeAccess,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            Issuer:    os.Getenv("JWT_ISSUER"),
            Audience:  []string{os.Getenv("JWT_AUDIENCE")},
        },
    }
    
    accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
    accessTokenString, err := accessToken.SignedString([]byte(os.Getenv("JWT_SECRET")))
    if err != nil {
        return nil, err
    }
    
    // Refresh token (long-lived)
    refreshClaims := JWTClaims{
        UserID:    user.ID,
        TokenType: TokenTypeRefresh,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    
    refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
    refreshTokenString, err := refreshToken.SignedString([]byte(os.Getenv("JWT_SECRET")))
    if err != nil {
        return nil, err
    }
    
    return &TokenPair{
        AccessToken:  accessTokenString,
        RefreshToken: refreshTokenString,
    }, nil
}

func ParseJWT(tokenString string) (*JWTClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
        return []byte(os.Getenv("JWT_SECRET")), nil
    })
    
    if err != nil {
        return nil, err
    }
    
    claims, ok := token.Claims.(*JWTClaims)
    if !ok || !token.Valid {
        return nil, errors.New("invalid token")
    }
    
    return claims, nil
}
```

---

## 🎯 Middleware Execution Order

```go
// main.go
router := gin.Default()

// 1. Global middlewares (run for ALL requests)
router.Use(middleware.SecurityHeadersMiddleware())
router.Use(cors.New(corsConfig))

// 2. Group-level middlewares
api := router.Group("/api")
{
    // These run AFTER global middlewares
    protected := api.Group("")
    protected.Use(middleware.AuthMiddleware())
    {
        // These endpoints require auth
        protected.GET("/me", handler.GetMe)
    }
}
```

**Execution Order**:
1. SecurityHeaders
2. CORS
3. AuthMiddleware (if protected)
4. Handler

---

## ▶️ Selanjutnya

- [../04-feature-service/30_FEATURE_SERVICE_OVERVIEW.md](../04-feature-service/30_FEATURE_SERVICE_OVERVIEW.md) - Feature Service
- [../05-database/40_DATABASE_OVERVIEW.md](../05-database/40_DATABASE_OVERVIEW.md) - Database
