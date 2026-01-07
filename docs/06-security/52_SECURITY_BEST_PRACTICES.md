# 🛡️ Security Best Practices

> Panduan keamanan untuk development dan production.

---

## 🔐 Password Security

### Requirements

```
Minimum 8 characters
At least 1 uppercase letter
At least 1 lowercase letter
At least 1 number
At least 1 special character (!@#$%^&*)
```

### Storage

```go
// NEVER store plain text passwords
// Use bcrypt with cost factor 12
hashedPassword, err := bcrypt.GenerateFromPassword(
    []byte(password), 
    12,  // cost factor
)
```

### Validation

```go
func ValidatePassword(password string) error {
    if len(password) < 8 {
        return errors.New("password min 8 characters")
    }
    
    var hasUpper, hasLower, hasNumber, hasSpecial bool
    
    for _, char := range password {
        switch {
        case unicode.IsUpper(char):
            hasUpper = true
        case unicode.IsLower(char):
            hasLower = true
        case unicode.IsDigit(char):
            hasNumber = true
        case unicode.IsPunct(char) || unicode.IsSymbol(char):
            hasSpecial = true
        }
    }
    
    if !hasUpper || !hasLower || !hasNumber || !hasSpecial {
        return errors.New("password must include uppercase, lowercase, number, and special character")
    }
    
    return nil
}
```

---

## 🛡️ Input Validation

### Always Validate

```go
// ❌ Bad - No validation
func CreateThread(c *gin.Context) {
    var req ThreadRequest
    c.BindJSON(&req)
    db.Create(&req)  // Dangerous!
}

// ✅ Good - With validation
func CreateThread(c *gin.Context) {
    var req dto.CreateThreadRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        handleError(c, apperrors.ErrInvalidInput)
        return
    }
    
    // Validate with custom validators
    if err := validators.ValidateThread(req); err != nil {
        handleError(c, err)
        return
    }
    
    // Sanitize HTML/XSS
    req.Title = sanitize(req.Title)
    
    // Now safe to use
    thread, err := service.CreateThread(req)
}
```

### Sanitization

```go
import "github.com/microcosm-cc/bluemonday"

var policy = bluemonday.UGCPolicy()

func sanitize(input string) string {
    return policy.Sanitize(input)
}
```

---

## 🔒 SQL Injection Prevention

### Always Use Parameterized Queries

```go
// ❌ NEVER do this - SQL Injection vulnerable
query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)
db.Raw(query).Scan(&user)

// ✅ Always use parameterized queries
db.Where("email = ?", email).First(&user)

// ✅ Or with Ent
client.User.Query().
    Where(user.EmailEQ(email)).
    Only(ctx)
```

---

## 🌐 CORS Configuration

### Production Settings

```go
func buildCORSConfig() cors.Config {
    config := cors.DefaultConfig()
    
    // Only allow specific origins
    config.AllowOrigins = []string{
        "https://alephdraad.fun",
        "https://www.alephdraad.fun",
    }
    
    // Restrict methods
    config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
    
    // Restrict headers
    config.AllowHeaders = []string{
        "Origin",
        "Content-Type",
        "Authorization",
        "X-Sudo-Token",
    }
    
    // Don't allow credentials from any origin
    config.AllowCredentials = true
    
    return config
}
```

---

## 📝 Security Headers

### Essential Headers

```go
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Prevent clickjacking
        c.Header("X-Frame-Options", "DENY")
        
        // Prevent MIME sniffing
        c.Header("X-Content-Type-Options", "nosniff")
        
        // Enable XSS filter
        c.Header("X-XSS-Protection", "1; mode=block")
        
        // Control referrer
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        
        // Content Security Policy
        c.Header("Content-Security-Policy", 
            "default-src 'self'; "+
            "script-src 'self'; "+
            "style-src 'self' 'unsafe-inline'; "+
            "img-src 'self' data: https:; "+
            "connect-src 'self' https://*.alephdraad.fun")
        
        // HSTS (HTTPS only)
        c.Header("Strict-Transport-Security", 
            "max-age=31536000; includeSubDomains; preload")
        
        c.Next()
    }
}
```

---

## 🔑 Secret Management

### DO

```bash
# Use environment variables
JWT_SECRET=${JWT_SECRET}

# Use secret managers
# - Railway Secrets
# - Vercel Environment Variables
# - AWS Secrets Manager
# - HashiCorp Vault
```

### DON'T

```go
// ❌ NEVER hardcode secrets
const jwtSecret = "my_super_secret_key"

// ❌ NEVER commit secrets
// Check .gitignore includes:
// .env
// .env.local
// *.pem
// *.key
```

### Secret Rotation

```
1. Generate new secret
2. Update in secret manager
3. Deploy new version
4. Verify working
5. Invalidate old tokens (if JWT secret changed)
```

---

## 📊 Rate Limiting

### Implementation

```go
// Per-endpoint rate limits
var rateLimits = map[string]RateLimit{
    "login":    {Limit: 10, Window: time.Minute},
    "register": {Limit: 5, Window: time.Minute},
    "api":      {Limit: 100, Window: time.Minute},
}

// Per-user vs per-IP
func getRateLimitKey(c *gin.Context, endpoint string) string {
    if userID := c.GetUint("userID"); userID > 0 {
        return fmt.Sprintf("rate:%s:user:%d", endpoint, userID)
    }
    return fmt.Sprintf("rate:%s:ip:%s", endpoint, c.ClientIP())
}
```

---

## 📝 Audit Logging

### What to Log

```go
type AuditEvent struct {
    Timestamp   time.Time
    UserID      uint
    Action      string    // "login", "password_change", etc.
    Resource    string    // "user", "thread", etc.
    ResourceID  string
    IP          string
    UserAgent   string
    Success     bool
    Details     map[string]interface{}
}

// Log security events
func LogSecurityEvent(event AuditEvent) {
    logger.Info("Security event",
        zap.Time("timestamp", event.Timestamp),
        zap.Uint("user_id", event.UserID),
        zap.String("action", event.Action),
        zap.String("ip", event.IP),
        zap.Bool("success", event.Success),
    )
    
    // Also store in database for audit trail
    db.Create(&event)
}
```

### Events to Audit

| Event | Severity |
|-------|----------|
| Login success | Info |
| Login failure | Warning |
| Password change | High |
| 2FA enabled/disabled | High |
| Account deletion | Critical |
| Admin actions | Critical |

---

## ✅ Security Checklist

### Development

```
[ ] Never commit secrets
[ ] Use HTTPS even locally (for WebAuthn)
[ ] Validate all inputs
[ ] Use parameterized queries
[ ] Sanitize outputs
[ ] Log security events
```

### Pre-deployment

```
[ ] Security headers configured
[ ] CORS properly restricted
[ ] Rate limiting enabled
[ ] Secrets in environment variables
[ ] Dependencies updated
[ ] No debug endpoints exposed
```

### Production

```
[ ] HTTPS enforced
[ ] HSTS enabled
[ ] Error messages don't leak info
[ ] Logs don't contain secrets
[ ] Monitoring alerts configured
[ ] Incident response plan ready
```

---

## ▶️ Selanjutnya

- [../07-aleph-assistant/60_ALEPH_OVERVIEW.md](../07-aleph-assistant/60_ALEPH_OVERVIEW.md) - Aleph Assistant
- [../08-deployment/70_DEPLOYMENT_OVERVIEW.md](../08-deployment/70_DEPLOYMENT_OVERVIEW.md) - Deployment
