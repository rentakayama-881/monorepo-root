# Security

Dokumentasi fitur keamanan yang diimplementasikan di project.

---

## Overview

Alephdraad menerapkan defense-in-depth dengan multiple security layers:

```
┌─────────────────────────────────────────────────────┐
│                   Rate Limiting                      │
├─────────────────────────────────────────────────────┤
│               Security Headers (CSP)                 │
├─────────────────────────────────────────────────────┤
│                 CORS Protection                      │
├─────────────────────────────────────────────────────┤
│              JWT Authentication                      │
├─────────────────────────────────────────────────────┤
│               Input Validation                       │
├─────────────────────────────────────────────────────┤
│                XSS Sanitization                      │
└─────────────────────────────────────────────────────┘
```

---

## 1. Security Headers

Semua response backend menyertakan security headers via `SecurityHeadersMiddleware`:

### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https: http:;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://*.vercel.app https://vercel.live;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

### Other Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |
| `Permissions-Policy` | (disabled features) | Disable unused browser APIs |

---

## 2. CORS Protection

CORS dikonfigurasi untuk hanya menerima request dari origin yang diizinkan:

```go
corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
corsConfig.AllowOrigins = []string{frontend}
```

**Configuration:**
- `FRONTEND_BASE_URL` - Primary allowed origin
- `CORS_ALLOWED_ORIGINS` - Comma-separated list untuk multiple origins

---

## 3. Rate Limiting

In-memory sliding window rate limiter:

```go
type RateLimiter struct {
    limit    int           // Max requests
    window   time.Duration // Time window
    requests map[string][]time.Time
}
```

### Default Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Auth (login/register) | 5 req | 1 minute |
| General API | 60 req | 1 minute |

### Rate Limit Response

```json
{
  "error": {
    "code": "RATE001",
    "message": "Too many requests. Please try again later."
  }
}
```

HTTP Status: `429 Too Many Requests`

---

## 4. JWT Authentication

### Token Specifications

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Expiry | 24 hours |
| Storage | Client-side (localStorage) |

### Token Payload

```json
{
  "user_id": 123,
  "email": "user@example.com",
  "exp": 1705312800,
  "iat": 1705226400
}
```

### Middleware

- `AuthMiddleware` - Required authentication, returns 401 if missing/invalid
- `AuthOptionalMiddleware` - Optional, sets user context if token valid

---

## 5. XSS Prevention

### Input Sanitization

Semua user input di-sanitize sebelum disimpan:

```go
// SanitizeHTML - Escape HTML special characters
func SanitizeHTML(input string) string {
    return html.EscapeString(input)
}

// RemoveScriptTags - Remove dangerous tags
func RemoveScriptTags(input string) string {
    // Remove <script> tags
    // Remove event handlers (onclick, onerror, etc)
    // Remove javascript: protocol
}
```

### XSS Validation

Validasi menolak input dengan pattern berbahaya:

```go
func ValidateNoXSS(input string) bool {
    // Check for script tags
    // Check for event handlers (onclick, onerror, onload, etc)
    // Check for javascript: protocol
    // Check for data: protocol with script
}
```

### Protected Fields

- Thread title
- Thread content
- User bio
- Display name
- Username

---

## 6. SQL Injection Prevention

GORM ORM melindungi dari SQL injection via parameterized queries:

```go
// Safe - parameterized
db.Where("email = ?", email).First(&user)

// GORM automatically escapes parameters
```

---

## 7. Password Security

### Hashing

Password di-hash dengan bcrypt sebelum disimpan:

```go
hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
```

### Validation

- Minimum 8 karakter
- Hashing dengan cost factor 10 (bcrypt default)
- Password tidak pernah disimpan atau di-log dalam plaintext

---

## 8. Email Verification

### Flow

1. User register → Verification email dikirim
2. Token (UUID) disimpan di `email_verification_tokens`
3. Token expired setelah 24 jam
4. User tidak bisa login sebelum verified

### Token Properties

| Property | Value |
|----------|-------|
| Format | UUID v4 |
| Expiry | 24 hours |
| One-time | Yes (deleted after use) |

---

## 9. Smart Contract Security

### Escrow Signature Verification

Backend menandatangani order creation dengan EIP-191:

```go
signature := crypto.Sign(hash, BackendSignerPrivateKey)
```

Factory contract memverifikasi signature sebelum deploy escrow:

```solidity
address signer = ECDSA.recover(hash, signature);
require(signer == backendSigner, "Invalid signature");
```

### Escrow Protection

- Funds locked until delivery/dispute resolution
- Time-locked refund untuk buyer protection
- Arbitration dengan multi-sig voting

---

## 10. Security Checklist

### Development

- [ ] Semua secret di environment variables
- [ ] `.env` di `.gitignore`
- [ ] Debug mode disabled di production
- [ ] HTTPS enforced

### Backend

- [ ] All endpoints validated
- [ ] User input sanitized
- [ ] Rate limiting enabled
- [ ] JWT expiry configured
- [ ] CORS properly restricted

### Frontend

- [ ] No secrets in client code
- [ ] API errors handled gracefully
- [ ] Token stored securely
- [ ] XSS-safe rendering

### Database

- [ ] Strong passwords
- [ ] SSL connection (production)
- [ ] Minimal privileges
- [ ] Regular backups

---

## Reporting Vulnerabilities

Jika menemukan vulnerability, hubungi tim security:

1. **Email**: security@yourdomain.com
2. Jelaskan vulnerability dengan detail
3. Sertakan steps to reproduce
4. Jangan disclosure public sebelum fix

---

## Security Updates

| Date | Update |
|------|--------|
| 2024-01 | Added structured error handling |
| 2024-01 | Enhanced XSS sanitization |
| 2024-01 | Security headers middleware |
