# AIValid Security Checklist

> 12 threat categories. Review against this checklist for every security-sensitive change.

## 1. Auth / Session Weaknesses (P0)
- JWT HS256 with auto-refresh via `tokenRefresh.js`
- TOTP 2FA + WebAuthn/Passkeys supported
- Sudo mode for sensitive operations (time-boxed re-auth)
- Check: session hijacking, token leakage, fixation, replay

## 2. CSRF (P0-P1)
- SameSite cookies, custom headers for state-changing requests
- Check: all POST/PUT/DELETE endpoints protected

## 3. XSS (P0)
- React auto-escapes by default
- Check: any `dangerouslySetInnerHTML`, user-controlled `href`, SVG injection

## 4. SSRF (P0)
- Internal callbacks use `SERVICE_TOKEN` header
- Check: no user-controlled URLs in server-side fetch

## 5. IDOR (P0)
- Ownership checks on every resource access
- Check: can user A access user B's wallet/case/dispute by changing ID?

## 6. SQL / NoSQL Injection (P0)
- Ent ORM parameterizes queries (Go)
- MongoDB.Driver parameterizes queries (.NET)
- Check: no raw query string concatenation

## 7. Rate Limiting
- Per-route: general 60/min, auth 10/min, search 20/min
- Check: financial endpoints have appropriate limits

## 8. Reverse Proxy Misconfiguration
- Nginx: HTTPS redirect + HSTS
- Backend binds to loopback (127.0.0.1)
- Check: ports 8080/5000 not exposed to public

## 9. Headers / Cookies / CORS
- Strict allowlist origins (no `*` with credentials)
- Security headers middleware in both backends
- Check: HttpOnly, Secure, SameSite cookie flags

## 10. Dependency / Supply-Chain Risk
- CI runs npm audit, Go vulnerability scanning
- Pin dependencies, verify provenance
- Check: lockfiles up to date, no known CVEs

## 11. Over-Privileged Service Boundaries
- Internal auth middleware: `backend/middleware/internal_auth.go`
- Check: internal endpoints return 401 without SERVICE_TOKEN

## 12. Sensitive Logging
- No request body logging for financial endpoints
- PII redaction policy
- Check: grep log sinks for email, PIN, token patterns

## Security Verification Commands

```bash
# Check for crypto.randomUUID() usage (no Math.random for tokens):
grep -rn 'Math\.random' frontend/ --include='*.jsx' --include='*.js'

# Check for InsecureSkipVerify:
grep -rn 'InsecureSkipVerify' backend/ --include='*.go'

# Check for console leaks in lib/:
grep -rn 'console\.' frontend/lib/ --include='*.js' | grep -v logger.js

# Check for raw SQL:
grep -rn 'db\.Exec\|db\.Query\|sql\.Open' backend/ --include='*.go'

# Run full security CI:
# (triggered automatically on push to main)
```
