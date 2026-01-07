# 🔐 Security Authentication

> Dokumentasi detail tentang sistem autentikasi di Alephdraad.

---

## 🎯 Authentication Methods

Alephdraad mendukung **4 metode autentikasi**:

| Method | Security Level | User Experience |
|--------|---------------|-----------------|
| Password + Email | ⭐⭐ | Simple |
| Password + TOTP | ⭐⭐⭐⭐ | Moderate |
| Password + Passkey | ⭐⭐⭐⭐⭐ | Best |
| Passkey Only | ⭐⭐⭐⭐⭐ | Best |

---

## 🔑 JWT Token System

### Token Types

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT TOKENS                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Access Token                   Refresh Token               │
│  ─────────────                  ─────────────               │
│  • Short-lived (15 min)         • Long-lived (7 days)       │
│  • Used for API calls           • Used to get new tokens    │
│  • Contains user info           • Contains minimal info     │
│  • Stored in memory             • Stored in localStorage    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Token Structure

```javascript
// Access Token Payload
{
  "user_id": 123,
  "email": "user@example.com",
  "username": "johndoe",
  "token_type": "access",
  "iat": 1736236800,
  "exp": 1736237700,  // +15 minutes
  "iss": "alephdraad-api",
  "aud": "alephdraad-users"
}

// Refresh Token Payload
{
  "user_id": 123,
  "token_type": "refresh",
  "session_id": "sess_abc123",
  "iat": 1736236800,
  "exp": 1736841600  // +7 days
}
```

### Token Flow

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │                    │ Database │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │  1. Login (email/password)    │                               │
     │──────────────────────────────▶│                               │
     │                               │  2. Verify credentials        │
     │                               │──────────────────────────────▶│
     │                               │◀──────────────────────────────│
     │                               │                               │
     │  3. Return tokens             │                               │
     │◀──────────────────────────────│                               │
     │                               │                               │
     │  4. API call with access token│                               │
     │──────────────────────────────▶│                               │
     │                               │  5. Validate token            │
     │  6. Response                  │                               │
     │◀──────────────────────────────│                               │
     │                               │                               │
     │  7. Token expired!            │                               │
     │  8. Refresh with refresh token│                               │
     │──────────────────────────────▶│                               │
     │                               │  9. Verify refresh token      │
     │                               │──────────────────────────────▶│
     │  10. New token pair           │◀──────────────────────────────│
     │◀──────────────────────────────│                               │
     │                               │                               │
```

---

## 🛡️ Two-Factor Authentication (2FA)

### TOTP (Time-based One-Time Password)

```
How TOTP Works:
──────────────────────────────────────────────────

1. Server generates secret key
2. User scans QR code with authenticator app
3. App generates 6-digit code every 30 seconds
4. Server validates code using same algorithm

Secret: BASE32ENCODED...
           │
           ▼
    ┌──────────────┐
    │  TOTP(secret,│     ┌────────┐
    │  timestamp)  │ ──▶ │ 123456 │
    └──────────────┘     └────────┘
           │
           │ (same on server and app)
           ▼
        MATCH!
```

### Backup Codes

```
When TOTP unavailable:
- 10 one-time codes generated
- Each code can only be used once
- Format: XXXX-XXXX-XXXX

Storage:
- Hashed with bcrypt
- Deleted after use
- Can regenerate (invalidates old codes)
```

---

## 🔐 Passkey / WebAuthn

### What is Passkey?

Passkey menggunakan public key cryptography:
- Private key stays on device (never leaves)
- Public key stored on server
- Impossible to phish

### Flow

```
Registration:
1. Server creates challenge
2. Browser prompts biometric/PIN
3. Device creates key pair
4. Public key sent to server

Login:
1. Server sends challenge
2. Device signs with private key
3. Server verifies with public key
4. User authenticated
```

### Supported Devices

| Platform | Method |
|----------|--------|
| iPhone/iPad | Face ID, Touch ID |
| Android | Fingerprint, Face |
| Windows | Windows Hello |
| macOS | Touch ID |
| Security Key | FIDO2 key |

---

## 🔒 Sudo Mode

### What is Sudo Mode?

Re-authentication sebelum aksi critical:
- Delete account
- Change email
- Disable 2FA
- Download data

### How it Works

```
┌─────────────────────────────────────────────────────────────┐
│                      SUDO MODE FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User tries critical action                              │
│                    │                                        │
│                    ▼                                        │
│  2. Server checks: sudoToken valid?                         │
│         │                                                   │
│    NO   │   YES                                             │
│    │    │                                                   │
│    ▼    └──────────────────────────────────────────▶ ALLOW │
│  3. Return 403 + requireSudo: true                          │
│                    │                                        │
│                    ▼                                        │
│  4. Frontend shows password/TOTP prompt                     │
│                    │                                        │
│                    ▼                                        │
│  5. POST /api/auth/sudo/verify                              │
│                    │                                        │
│                    ▼                                        │
│  6. Server returns sudoToken (15 min expiry)                │
│                    │                                        │
│                    ▼                                        │
│  7. Retry with X-Sudo-Token header                          │
│                    │                                        │
│                    ▼                                        │
│                   ALLOW                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Session Management

### Session Data Stored

```go
type Session struct {
    ID           string
    UserID       uint
    DeviceInfo   string    // "Chrome on Windows"
    IP           string    // "203.0.113.1"
    UserAgent    string
    CreatedAt    time.Time
    LastActiveAt time.Time
    ExpiresAt    time.Time
    IsRevoked    bool
}
```

### Session Actions

| Action | Effect |
|--------|--------|
| Logout | Revokes current session |
| Logout All | Revokes all sessions |
| Session Expiry | Auto-revoked after 7 days |
| Password Change | Option to revoke all |

---

## ▶️ Selanjutnya

- [52_SECURITY_BEST_PRACTICES.md](./52_SECURITY_BEST_PRACTICES.md) - Security best practices
- [../07-aleph-assistant/60_ALEPH_OVERVIEW.md](../07-aleph-assistant/60_ALEPH_OVERVIEW.md) - Aleph Assistant
