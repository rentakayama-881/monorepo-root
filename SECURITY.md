# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of AIValid seriously. If you discover a security vulnerability, please follow these steps:

### Do NOT

- Do not open a public GitHub issue
- Do not disclose the vulnerability publicly before it's fixed
- Do not exploit the vulnerability for malicious purposes

### Do

1. **Email us at:** security@aivalid.id
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Initial Response:** Within 24 hours
- **Assessment:** Within 72 hours
- **Fix Timeline:** Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next release

### Recognition

We appreciate responsible disclosure and may recognize reporters in our changelog (with permission).

## Security Measures

### Authentication
- JWT tokens with short expiry (15 minutes)
- Refresh token rotation
- TOTP-based 2FA (RFC 6238)
- Passkey/WebAuthn support
- Session management with device tracking

### Financial Operations
- 6-digit PIN with PBKDF2 hashing (310,000 iterations)
- 2FA required for all financial transactions
- 4-hour lockout after 4 failed PIN attempts
- No PIN reset option (by design)

### Input Validation
- All user input is validated and sanitized
- SQL injection protection (parameterized queries)
- XSS prevention (HTML escaping)
- CSRF protection on all state-changing operations

### Infrastructure
- HTTPS only
- Secure headers (HSTS, CSP, X-Frame-Options)
- Rate limiting on sensitive endpoints
- Audit logging for security events

---

*Last updated: February 10, 2026*
