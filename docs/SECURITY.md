# 🔐 DOKUMENTASI KEAMANAN

> **Versi:** 1.0  
> **Tanggal:** 15 Januari 2026  
> **Klasifikasi:** Security Documentation  
> **Level:** Confidential

---

## 📋 DAFTAR ISI

1. [Overview Keamanan](#1-overview-keamanan)
2. [Authentication](#2-authentication)
3. [Authorization](#3-authorization)
4. [Data Protection](#4-data-protection)
5. [Network Security](#5-network-security)
6. [Financial Security](#6-financial-security)
7. [Incident Response](#7-incident-response)
8. [Compliance](#8-compliance)

---

## 1. OVERVIEW KEAMANAN

### 1.1 Security Posture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEFENSE IN DEPTH                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 7: Application Security                                   │
│  ├─ Input validation                                             │
│  ├─ Output encoding                                              │
│  ├─ CSRF protection                                              │
│  └─ Rate limiting                                                │
│                                                                  │
│  Layer 6: Session Security                                       │
│  ├─ JWT with short expiry                                        │
│  ├─ Refresh token rotation                                       │
│  ├─ Session binding                                              │
│  └─ Device fingerprinting                                        │
│                                                                  │
│  Layer 5: Authentication                                         │
│  ├─ Password hashing (bcrypt)                                    │
│  ├─ WebAuthn/Passkeys                                            │
│  ├─ TOTP 2FA                                                     │
│  └─ Backup codes                                                 │
│                                                                  │
│  Layer 4: Authorization                                          │
│  ├─ Role-based access                                            │
│  ├─ Resource ownership                                           │
│  └─ Sudo mode for sensitive ops                                  │
│                                                                  │
│  Layer 3: Transport Security                                     │
│  ├─ TLS 1.3 only                                                 │
│  ├─ HSTS headers                                                 │
│  └─ Certificate pinning (mobile)                                 │
│                                                                  │
│  Layer 2: Infrastructure                                         │
│  ├─ WAF (Cloudflare)                                             │
│  ├─ DDoS protection                                              │
│  └─ IP allowlisting                                              │
│                                                                  │
│  Layer 1: Physical                                               │
│  ├─ Cloud provider security                                      │
│  └─ Access controls                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Security Principles

| Principle | Implementation |
|-----------|----------------|
| **Least Privilege** | Users only get necessary permissions |
| **Defense in Depth** | Multiple security layers |
| **Fail Secure** | Errors default to deny |
| **Separation of Duties** | Admin vs User vs Financial |
| **Audit Trail** | All sensitive actions logged |

---

## 2. AUTHENTICATION

### 2.1 Password Authentication

**Hashing Algorithm:** bcrypt with cost factor 10

```go
// Password hashing
hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

// Password verification
err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
```

**Password Requirements:**
- Minimum 8 characters
- Maximum 72 characters (bcrypt limit)
- No complexity requirements (NIST 800-63B compliant)
- Checked against common password lists

### 2.2 WebAuthn/Passkey Authentication

```
┌──────────────────────────────────────────────────────────────────┐
│                    WEBAUTHN FLOW                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Registration:                                                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │
│  │ Client  │───▶│ Backend │───▶│  Redis  │───▶│ Client  │        │
│  │         │    │ (Begin) │    │(Session)│    │(Create) │        │
│  └─────────┘    └─────────┘    └─────────┘    └────┬────┘        │
│                                                     │             │
│                                                     ▼             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │
│  │ Backend │◀───│ Client  │◀───│Biometric│◀───│Authn'tor│        │
│  │(Finish) │    │(Finish) │    │  Check  │    │ Create  │        │
│  └────┬────┘    └─────────┘    └─────────┘    └─────────┘        │
│       │                                                           │
│       ▼                                                           │
│  ┌─────────┐                                                      │
│  │   DB    │ Store: credential_id, public_key, counter            │
│  └─────────┘                                                      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Security Features:**
- Challenge stored in Redis (5 min TTL)
- Session ID binding prevents replay attacks
- Counter validation prevents cloning attacks
- Unique credential per device

**Code Implementation:**
```go
// Generate registration options
options, session, err := s.webauthn.BeginRegistration(user)

// Store session in Redis
sessionKey := fmt.Sprintf("webauthn:reg:%d", userID)
s.redis.Set(ctx, sessionKey, session, 5*time.Minute)

// Verify and complete registration
credential, err := s.webauthn.FinishRegistration(user, session, response)
```

### 2.3 TOTP Two-Factor Authentication

**Standard:** RFC 6238 (TOTP)

```
┌─────────────────────────────────────────────────────────────────┐
│                      TOTP SETUP FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User requests 2FA setup                                      │
│     POST /auth/totp/setup                                        │
│     Response: { secret, qr_code, pending_token }                 │
│                                                                  │
│  2. User scans QR code with authenticator app                    │
│     Google Authenticator, Authy, 1Password, etc.                 │
│                                                                  │
│  3. User verifies with TOTP code                                 │
│     POST /auth/totp/verify                                       │
│     Body: { code: "123456", pending_token }                      │
│                                                                  │
│  4. Backend validates and enables                                │
│     - Verify code matches secret                                 │
│     - Generate 8 backup codes                                    │
│     - Enable totp_enabled flag                                   │
│     - Return backup codes (show once)                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Configuration:**
```go
type TOTPConfig struct {
    Issuer       string        // "AIValid"
    Algorithm    string        // SHA1
    Digits       int           // 6
    Period       uint          // 30 seconds
    Skew         uint          // 1 (allows ±1 period)
    SecretSize   int           // 20 bytes
}
```

**Backup Codes:**
- 8 one-time use codes
- Stored as bcrypt hashes
- Each code: 8 alphanumeric characters
- Cannot be regenerated without disabling 2FA

### 2.4 Session Management

**Token Structure:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      JWT TOKEN DESIGN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ACCESS TOKEN (15 minutes)                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Header:  { alg: "HS256", typ: "JWT" }                       │ │
│  │ Payload: {                                                   │ │
│  │   user_id: 123,                                              │ │
│  │   email: "user@example.com",                                 │ │
│  │   jti: "unique-session-id",  // Links to DB session         │ │
│  │   type: "access",                                            │ │
│  │   iat: 1705123456,                                           │ │
│  │   exp: 1705124356            // 15 min                       │ │
│  │ }                                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  REFRESH TOKEN (7 days)                                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Payload: {                                                   │ │
│  │   user_id: 123,                                              │ │
│  │   type: "refresh",                                           │ │
│  │   iat: 1705123456,                                           │ │
│  │   exp: 1705728256            // 7 days                       │ │
│  │ }                                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Session Table (PostgreSQL):**
```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    access_token_jti VARCHAR(64) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(20),
    device_name VARCHAR(100),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Session Validation:**
```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. Extract and validate JWT
        claims, err := ParseJWT(token)
        
        // 2. Check token type
        if claims.TokenType != "access" {
            abort(c, "invalid token type")
            return
        }
        
        // 3. Validate session in database
        session, err := db.Session.Query().
            Where(session.AccessTokenJtiEQ(claims.JTI)).
            First(ctx)
        
        // 4. Check not revoked and not expired
        if session.RevokedAt != nil || session.ExpiresAt.Before(time.Now()) {
            abort(c, "session invalid")
            return
        }
        
        // 5. Check account lock
        if lock := checkAccountLock(userID); lock != nil {
            abort(c, "account locked")
            return
        }
        
        // 6. Update last used
        session.Update().SetLastUsedAt(time.Now()).Exec(ctx)
        
        c.Next()
    }
}
```

### 2.5 Account Lockout

**Login Failure Tracking:**
```go
type LoginTracker struct {
    maxAttempts     int           // 5
    lockoutDuration time.Duration // 30 minutes
}

func (t *LoginTracker) RecordFailure(email, ip string) {
    key := fmt.Sprintf("login_fail:%s", email)
    count := t.redis.Incr(ctx, key)
    
    if count == 1 {
        t.redis.Expire(ctx, key, t.lockoutDuration)
    }
    
    if count >= t.maxAttempts {
        t.lockAccount(email, "Too many failed login attempts")
    }
}
```

**Session Lock Table:**
```sql
CREATE TABLE session_locks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    reason TEXT,
    locked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    unlocked_at TIMESTAMP,
    unlocked_by INTEGER,  -- Admin who unlocked
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. AUTHORIZATION

### 3.1 Role-Based Access Control

**Roles:**
| Role | Permissions |
|------|-------------|
| `user` | Read/create content, manage own profile |
| `moderator` | + Hide content, warn users |
| `admin` | + Full access, manage users, view audit |
| `super_admin` | + Manage admins, critical operations |

**Admin Authentication:**
```go
// Separate admin table with independent credentials
type Admin struct {
    ID           int
    Email        string
    PasswordHash string
    Role         string  // admin, super_admin
    TOTPEnabled  bool
    TOTPSecret   string
}

// Admin login requires 2FA
func AdminLogin(email, password, totpCode string) (*Token, error) {
    admin := db.Admin.Query().Where(admin.EmailEQ(email)).First(ctx)
    
    if !admin.TOTPEnabled {
        return nil, errors.New("2FA required for admin accounts")
    }
    
    if !verifyTOTP(admin.TOTPSecret, totpCode) {
        return nil, errors.New("invalid 2FA code")
    }
    
    return generateAdminToken(admin)
}
```

### 3.2 Resource Authorization

```go
// Verify ownership before modification
func (h *ThreadHandler) Update(c *gin.Context) {
    threadID := c.Param("id")
    userID := c.GetInt("user_id")
    
    thread, _ := h.service.GetThread(threadID)
    
    // Check ownership
    if thread.UserID != userID {
        // Check if admin
        if !isAdmin(userID) {
            c.AbortWithStatus(403)
            return
        }
    }
    
    // Proceed with update
    h.service.UpdateThread(threadID, input)
}
```

### 3.3 Sudo Mode

**For sensitive operations requiring re-authentication:**

```go
// Sudo session (15 min validity)
type SudoSession struct {
    ID        string
    UserID    int
    CreatedAt time.Time
    ExpiresAt time.Time
}

// Request sudo mode
func (h *SudoHandler) CreateSudo(c *gin.Context) {
    var input SudoRequest
    c.BindJSON(&input)
    
    // Verify password again
    user, _ := h.service.GetUser(c.GetInt("user_id"))
    if !verifyPassword(user.PasswordHash, input.Password) {
        c.JSON(401, gin.H{"error": "Invalid password"})
        return
    }
    
    // If 2FA enabled, verify
    if user.TOTPEnabled && !verifyTOTP(user.TOTPSecret, input.TOTPCode) {
        c.JSON(401, gin.H{"error": "Invalid 2FA code"})
        return
    }
    
    // Create sudo session
    sudo := h.service.CreateSudoSession(user.ID, 15*time.Minute)
    c.JSON(200, gin.H{"sudo_token": sudo.ID})
}

// Middleware to require sudo
func RequireSudo() gin.HandlerFunc {
    return func(c *gin.Context) {
        sudoToken := c.GetHeader("X-Sudo-Token")
        
        sudo, err := validateSudoSession(sudoToken)
        if err != nil || sudo.ExpiresAt.Before(time.Now()) {
            c.JSON(403, gin.H{"error": "Sudo authentication required"})
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

**Operations requiring Sudo:**
- Change email
- Change password
- Delete account
- Revoke all sessions
- Disable 2FA

---

## 4. DATA PROTECTION

### 4.1 Sensitive Data Handling

**Encryption at Rest:**
| Data Type | Protection |
|-----------|------------|
| Passwords | bcrypt (cost 10) |
| TOTP Secrets | Encrypted in DB (AES-256) |
| Backup Codes | bcrypt |
| Financial PIN | PBKDF2 (310k iterations) |
| Personal Data | Database encryption (Neon) |

**Encryption at Transit:**
- TLS 1.3 required
- HSTS enabled (max-age=31536000)
- Certificate auto-renewal (Caddy)

### 4.2 PII Handling

```go
// Mask sensitive data in logs
func maskEmail(email string) string {
    parts := strings.Split(email, "@")
    if len(parts) != 2 {
        return "***"
    }
    
    name := parts[0]
    if len(name) <= 2 {
        return "**@" + parts[1]
    }
    
    return name[:2] + "***@" + parts[1]
}

// Mask in Ent schema
field.String("totp_secret").
    Optional().
    Sensitive() // Excluded from JSON serialization
```

### 4.3 Data Retention

| Data Type | Retention | Action |
|-----------|-----------|--------|
| Sessions | 7 days | Auto-expire |
| Audit logs | 90 days | Archive then delete |
| Deleted accounts | 30 days | Hard delete |
| Email tokens | 24 hours | Auto-delete |
| Password reset | 1 hour | Auto-delete |

---

## 5. NETWORK SECURITY

### 5.1 Security Headers

```go
func SecurityHeadersMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Prevent clickjacking
        c.Header("X-Frame-Options", "DENY")
        
        // Prevent MIME sniffing
        c.Header("X-Content-Type-Options", "nosniff")
        
        // XSS protection (legacy browsers)
        c.Header("X-XSS-Protection", "1; mode=block")
        
        // Force HTTPS
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        
        // Content Security Policy
        c.Header("Content-Security-Policy",
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://vercel.live; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "connect-src 'self' https://*.vercel.app; " +
            "frame-ancestors 'none'; " +
            "form-action 'self'")
        
        // Limit browser features
        c.Header("Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=()")
        
        // Referrer policy
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        
        c.Next()
    }
}
```

### 5.2 Rate Limiting

**Per-Endpoint Limits:**
```go
// Global rate limiters
var (
    registerLimiter = NewRateLimiter(5, time.Hour)      // 5 per hour
    loginLimiter    = NewRateLimiter(10, time.Minute)   // 10 per minute
    passwordReset   = NewRateLimiter(3, time.Hour)      // 3 per hour
    deleteAccount   = NewRateLimiter(3, time.Hour)      // 3 per hour
    aiExplain       = NewRateLimiter(2, time.Minute)    // 2 per minute
)

// Token bucket implementation
type RateLimiter struct {
    mu       sync.Mutex
    buckets  map[string]*bucket
    limit    int
    duration time.Duration
}

func (l *RateLimiter) Allow(key string) bool {
    l.mu.Lock()
    defer l.mu.Unlock()
    
    b, exists := l.buckets[key]
    if !exists {
        b = &bucket{tokens: l.limit, lastRefill: time.Now()}
        l.buckets[key] = b
    }
    
    // Refill tokens
    elapsed := time.Since(b.lastRefill)
    refill := int(elapsed / l.duration) * l.limit
    b.tokens = min(b.tokens+refill, l.limit)
    b.lastRefill = time.Now()
    
    if b.tokens > 0 {
        b.tokens--
        return true
    }
    
    return false
}
```

### 5.3 CORS Configuration

```go
func buildCORSConfig() cors.Config {
    config := cors.DefaultConfig()
    
    // Allowed origins from environment
    config.AllowOrigins = []string{
        "https://aivalid.fun",
        "https://www.aivalid.fun",
    }
    
    // Allowed methods
    config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
    
    // Allowed headers
    config.AllowHeaders = []string{
        "Origin",
        "Content-Type",
        "Authorization",
        "X-Sudo-Token",
        "X-Device-Fingerprint",
    }
    
    // Allow credentials (cookies, auth headers)
    config.AllowCredentials = true
    
    return config
}
```

### 5.4 Input Validation

**SQL Injection Prevention:**
```go
// Ent ORM uses parameterized queries by default
users, _ := client.User.Query().
    Where(user.EmailEQ(email)).  // Safe: parameterized
    All(ctx)

// Never do this:
// client.User.Query().Where(sql.Raw("email = '" + email + "'"))
```

**XSS Prevention:**
```go
// HTML escaping in responses
import "html"

func sanitize(input string) string {
    return html.EscapeString(input)
}

// Content-Type header enforcement
c.Header("Content-Type", "application/json")
```

**Path Traversal Prevention:**
```go
func validateFilePath(path string) error {
    // Check for traversal patterns
    if strings.Contains(path, "..") {
        return errors.New("invalid path")
    }
    
    // Ensure within allowed directory
    absPath, _ := filepath.Abs(path)
    if !strings.HasPrefix(absPath, allowedDir) {
        return errors.New("path outside allowed directory")
    }
    
    return nil
}
```

---

## 6. FINANCIAL SECURITY

### 6.1 PIN System

**Hashing:** PBKDF2-SHA256 with 310,000 iterations

```csharp
// WalletService.cs
private const int PbkdfIterations = 310000;
private const int SaltSize = 32;
private const int HashSize = 32;

private string HashPin(string pin, byte[] salt)
{
    using var pbkdf2 = new Rfc2898DeriveBytes(
        pin,
        salt,
        PbkdfIterations,
        HashAlgorithmName.SHA256
    );
    
    byte[] hash = pbkdf2.GetBytes(HashSize);
    return Convert.ToBase64String(hash);
}
```

**PIN Lockout:**
- 4 failed attempts → 4 hour lockout
- No auto-reset
- Admin intervention required to unlock early

**No PIN Reset:**
```
⚠️ CRITICAL SECURITY FEATURE

PIN cannot be reset. If user forgets PIN:
1. They lose access to financial features
2. Must create new account
3. Remaining balance handled by admin

This prevents:
- Social engineering attacks
- Account takeover via email
- Customer support phishing
```

### 6.2 Financial Operations

**2FA Requirement Matrix:**
| Operation | PIN Required | 2FA Required |
|-----------|--------------|--------------|
| View balance | ❌ | ❌ |
| View transactions | ❌ | ❌ |
| Set PIN | ❌ | ✅ |
| P2P Transfer | ✅ | ✅ |
| Withdrawal | ✅ | ✅ |
| Cancel transfer | ✅ | ❌ |

**Transfer Security Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSFER VALIDATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Validate 2FA Code                                            │
│     └─ Check against user's TOTP secret                         │
│     └─ Or validate backup code                                   │
│                                                                  │
│  2. Validate PIN                                                 │
│     └─ Check lockout status                                      │
│     └─ Verify PBKDF2 hash                                        │
│     └─ Increment failure counter on fail                         │
│                                                                  │
│  3. Check Balance                                                │
│     └─ Verify sufficient funds                                   │
│     └─ Account for pending transfers                             │
│                                                                  │
│  4. Verify Receiver                                              │
│     └─ Check user exists                                         │
│     └─ Check not same as sender                                  │
│     └─ Check receiver can receive                                │
│                                                                  │
│  5. Create Escrow                                                │
│     └─ Deduct from sender                                        │
│     └─ Create transfer record                                    │
│     └─ Generate claim code                                       │
│     └─ Set expiration (7 days)                                   │
│                                                                  │
│  6. Log Transaction                                              │
│     └─ Create ledger entry                                       │
│     └─ Audit trail                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Transaction Ledger

```javascript
// MongoDB transaction_ledger collection
{
  "_id": "led_01HXYZ...",
  "transactionId": "txn_01HXYZ...",
  "userId": 123,
  "type": "Debit",  // Debit or Credit
  "amount": 100000,
  "balanceBefore": 500000,
  "balanceAfter": 400000,
  "description": "P2P Transfer to @john",
  "referenceId": "tfr_01HXYZ...",
  "referenceType": "Transfer",
  "metadata": {
    "receiverId": 456,
    "receiverUsername": "john",
    "claimCode": "ABC123"
  },
  "createdAt": ISODate("2026-01-15T10:30:00Z")
}
```

**Ledger Rules:**
- Append-only (no updates, no deletes)
- Balance recalculation from ledger possible
- Cryptographic hash chain (optional, for audit)

---

## 7. INCIDENT RESPONSE

### 7.1 Security Events

```go
// services/security_audit_ent.go
type SecurityEvent struct {
    UserID    int
    Email     string
    EventType string
    IPAddress string
    UserAgent string
    Success   bool
    Details   string
    Severity  string  // info, warning, critical
}

func (s *SecurityAudit) LogEvent(event SecurityEvent) {
    // Store in database
    s.client.SecurityEvent.Create().
        SetUserID(event.UserID).
        SetEventType(event.EventType).
        SetIPAddress(event.IPAddress).
        SetSuccess(event.Success).
        SetDetails(event.Details).
        SetSeverity(event.Severity).
        Save(ctx)
    
    // Alert on critical events
    if event.Severity == "critical" {
        s.alertAdmin(event)
    }
}
```

**Event Types:**
| Event | Severity | Action |
|-------|----------|--------|
| `login_success` | info | Log |
| `login_failure` | warning | Log, count |
| `account_locked` | warning | Log, alert |
| `password_changed` | info | Log, notify |
| `2fa_enabled` | info | Log, notify |
| `device_blocked` | critical | Log, alert |
| `suspicious_activity` | critical | Log, alert, lock |

### 7.2 Automated Responses

```go
// Auto-lock on suspicious activity
func (d *DeviceTracker) CheckSuspiciousActivity(userID int, event string) {
    // Count suspicious events in last hour
    count := d.countEvents(userID, "suspicious_*", 1*time.Hour)
    
    if count >= 3 {
        // Lock account
        d.authService.LockAccount(userID, "Automated: Multiple suspicious activities")
        
        // Revoke all sessions
        d.sessionService.RevokeAllSessions(userID)
        
        // Alert admin
        d.alertAdmin(userID, "Account locked due to suspicious activity")
    }
}
```

### 7.3 Incident Escalation

```
Level 1: Automated Response
├─ Rate limit triggers
├─ Failed login lockout
└─ Device blocking

Level 2: Admin Notification
├─ Multiple failed 2FA attempts
├─ Unusual location access
└─ Large financial transactions

Level 3: Manual Review
├─ Account compromise suspected
├─ Fraud report
└─ Legal request
```

---

## 8. COMPLIANCE

### 8.1 Data Protection

**GDPR/Privacy Compliance:**
- Right to access: GET /api/account (full profile)
- Right to deletion: DELETE /api/account
- Data portability: Export endpoint (planned)
- Consent: Explicit on registration

### 8.2 Security Standards

| Standard | Status | Notes |
|----------|--------|-------|
| OWASP Top 10 | ✅ Implemented | Validated |
| PCI DSS (partial) | ⚠️ In progress | For payment features |
| SOC 2 | ❌ Not started | Future consideration |

### 8.3 Audit Requirements

**Logged Events:**
- All authentication attempts
- All financial transactions
- All admin actions
- All security-related changes

**Log Retention:**
- 90 days online
- 1 year archived
- Tamper-evident (planned)

---

## 📞 SECURITY CONTACTS

| Role | Contact |
|------|---------|
| Security Issues | security@aivalid.fun |
| Bug Bounty | (Coming soon) |
| Emergency | admin@aivalid.fun |

---

*Dokumen ini adalah bagian dari dokumentasi teknis AIValid. Terakhir diperbarui: 15 Januari 2026.*
