# 🔒 Security Overview

> Dokumentasi arsitektur keamanan Alephdraad.

---

## 🎯 Security Pillars

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ALEPHDRAAD SECURITY                               │
└─────────────────────────────────────────────────────────────────────┘
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
   │  Auth  │  │  2FA   │  │  Rate  │  │  Data  │  │ Audit  │
   │  JWT   │  │  TOTP  │  │  Limit │  │ Protect│  │  Log   │
   │Passkey │  │Passkey │  │        │  │        │  │        │
   └────────┘  └────────┘  └────────┘  └────────┘  └────────┘
```

---

## 🔐 Authentication

### JWT (JSON Web Token)

Alephdraad menggunakan JWT untuk autentikasi stateless.

**Token Structure**:
```
Header.Payload.Signature
```

**Payload Claims**:
```json
{
  "user_id": 123,
  "email": "user@example.com",
  "username": "johndoe",
  "token_type": "access",
  "iat": 1704614400,
  "exp": 1704615300,
  "iss": "alephdraad-api",
  "aud": "alephdraad-users"
}
```

**Token Types**:
| Type | Lifetime | Usage |
|------|----------|-------|
| Access Token | 15 menit | API requests |
| Refresh Token | 7 hari | Get new access token |

**Security Features**:
- HMAC-SHA256 signing
- Short access token lifetime
- Refresh token rotation
- Token blacklisting on logout

---

### Password Security

| Aspect | Implementation |
|--------|----------------|
| Hashing | bcrypt (cost factor 12) |
| Min Length | 8 characters |
| Complexity | Mixed case, numbers, symbols |
| Breach Check | HaveIBeenPwned API (optional) |

```go
// Password hashing
hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)

// Password verification
err := bcrypt.CompareHashAndPassword(hash, []byte(password))
```

---

### Passkey / WebAuthn

Passwordless authentication using FIDO2/WebAuthn.

**Flow**:
```
1. Registration
   Browser → WebAuthn API → Create Credential → Server stores public key

2. Login
   Server → Challenge → Browser → WebAuthn API → Sign → Server verifies
```

**Security Benefits**:
- No password to steal
- Phishing resistant (origin-bound)
- Biometric protection
- Hardware-backed keys

---

## 🛡️ Two-Factor Authentication (2FA)

### TOTP (Time-based One-Time Password)

Compatible dengan Google Authenticator, Authy, etc.

**Setup Flow**:
```
1. Server generates secret (32 bytes, base32 encoded)
2. Generate QR code with otpauth:// URI
3. User scans QR in authenticator app
4. User enters code to verify
5. Server stores encrypted secret
```

**TOTP Algorithm**:
```
TOTP = HOTP(secret, floor(time / 30))
```

### Backup Codes

- 10 one-time use codes
- 12 characters each
- Stored hashed (bcrypt)
- Regeneratable (invalidates old codes)

---

## ⏱️ Rate Limiting

### Implementation

```go
type RateLimiter struct {
    limit  int           // Max requests
    window time.Duration // Time window
    store  map[string]*bucket
}

// Example limits
var limits = map[string]Limit{
    "login":       {10, time.Minute},
    "register":    {6, time.Minute},
    "verify":      {10, time.Minute},
    "refresh":     {30, time.Minute},
    "delete":      {3, time.Hour},
    "ai_explain":  {2, time.Minute},
}
```

### Response When Limited

```json
{
  "error": "Terlalu banyak percobaan. Silakan coba lagi dalam 1 menit.",
  "code": "RATE_LIMITED",
  "retryAfter": 60
}
```

---

## 🔒 Sudo Mode

For critical actions, users must re-authenticate.

### Protected Actions

- Delete account
- Disable 2FA
- Change email
- Delete passkeys

### Sudo Flow

```
1. User attempts protected action
2. Server responds: 403 SUDO_REQUIRED
3. Frontend shows re-auth modal
4. User enters password OR TOTP
5. Server issues sudo token (15 min lifetime)
6. Subsequent requests include X-Sudo-Token header
```

---

## 🌐 CORS & Headers

### CORS Configuration

```go
corsConfig := cors.Config{
    AllowOrigins:     []string{"https://alephdraad.fun"},
    AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
    AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Sudo-Token"},
    AllowCredentials: true,
}
```

### Security Headers

```go
func SecurityHeadersMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        c.Header("Content-Security-Policy", "default-src 'self'")
        c.Next()
    }
}
```

---

## 📊 Session Management

### Session Tracking

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Session Management                               │
└─────────────────────────────────────────────────────────────────────┘

Each session tracks:
• Device fingerprint
• IP address
• User agent
• Last active time
• Creation time
• Expiry time
```

### Multi-Device Support

Users can:
- View all active sessions
- See device info (parsed user agent)
- Revoke specific sessions
- Logout from all devices

---

## 🕵️ Device Fingerprinting

Used for:
- Suspicious login detection
- New device alerts
- Device-based banning

**Collected Data**:
```javascript
{
  screenResolution: "1920x1080",
  timezone: "Asia/Jakarta",
  language: "id-ID",
  platform: "MacIntel",
  colorDepth: 24,
  // ... other browser properties
}
```

**Privacy Note**: Fingerprint is hashed before storage.

---

## 📝 Security Audit Log

All security events are logged:

| Event | Logged Data |
|-------|-------------|
| Login success | User, IP, device, method |
| Login failure | Email attempted, IP, reason |
| Password change | User, IP |
| 2FA enable/disable | User, IP, method |
| Account deletion | User, IP |
| Session revocation | User, session ID, IP |

---

## 🛡️ Input Validation

### Backend Validation

```go
// validators/auth.go
type RegisterInput struct {
    Email    string `validate:"required,email,max=255"`
    Password string `validate:"required,min=8,max=100"`
    Username string `validate:"required,alphanum,min=3,max=30"`
    FullName string `validate:"required,max=100"`
}

func Validate(input interface{}) error {
    return validator.Struct(input)
}
```

### SQL Injection Prevention

- Parameterized queries (GORM/Ent)
- No raw SQL concatenation
- Input sanitization

### XSS Prevention

- Content escaped on output
- CSP headers
- HTTPOnly cookies

---

## 🔐 Secrets Management

### Environment Variables

```bash
# NEVER commit these to git

# JWT
JWT_SECRET=very_long_random_string_at_least_32_chars
ADMIN_JWT_SECRET=different_admin_secret

# Database
DATABASE_URL=postgresql://...

# External Services
HUGGINGFACE__APIKEY=hf_...
RESEND_API_KEY=re_...
```

### Recommendations

1. **Development**: `.env` file (gitignored)
2. **Production**: Environment variables from hosting platform
3. **Rotation**: Change secrets periodically
4. **Access**: Limit who can access production secrets

---

## ✅ Security Checklist

### Authentication
- [x] Password hashing (bcrypt)
- [x] JWT with short expiry
- [x] Refresh token rotation
- [x] TOTP 2FA
- [x] Passkey/WebAuthn
- [x] Backup codes
- [x] Sudo mode for critical actions

### Protection
- [x] Rate limiting
- [x] CORS configuration
- [x] Security headers
- [x] Input validation
- [x] SQL injection prevention
- [x] XSS prevention

### Monitoring
- [x] Security audit logs
- [x] Failed login tracking
- [x] Session management
- [x] Device fingerprinting

### Infrastructure
- [x] HTTPS only (via Vercel/Nginx+Let's Encrypt)
- [x] Secure database connections (SSL)
- [x] Environment variable secrets
- [ ] WAF (recommended for production)
- [ ] DDoS protection (recommended)

---

## ▶️ Selanjutnya

- [51_AUTHENTICATION_SECURITY.md](./51_AUTHENTICATION_SECURITY.md) - Authentication detail
- [52_DATA_PROTECTION.md](./52_DATA_PROTECTION.md) - Data protection
- [../07-aleph-assistant/60_ALEPH_OVERVIEW.md](../07-aleph-assistant/60_ALEPH_OVERVIEW.md) - Aleph Assistant
