# AIValid Security Checklist

> 14 threat categories. Review against this checklist for every security-sensitive change.
> AI agents: Flag ANY finding immediately — do not silently work around security issues.

## 1. Auth / Session Weaknesses (P0)
- JWT HS256 with auto-refresh via `tokenRefresh.js`
- TOTP 2FA + WebAuthn/Passkeys supported
- Sudo mode for sensitive operations (time-boxed re-auth)
- Presence cookies (`has_session`, `has_admin`) are NOT auth tokens — they only hint that a session exists
- Check: session hijacking, token leakage, fixation, replay
- Check: presence cookies cannot be used to bypass actual JWT validation

## 2. CSRF (P0-P1)
- SameSite cookies, custom headers for state-changing requests
- Presence cookies use `SameSite=Lax` — safe for CSRF
- Check: all POST/PUT/DELETE endpoints protected

## 3. XSS (P0)
- React auto-escapes by default
- Check: any `dangerouslySetInnerHTML`, user-controlled `href`, SVG injection

## 4. SSRF (P0)
- Internal callbacks (Feature Service → Go Backend) use `X-Internal-Api-Key` header (env: `INTERNAL_API_KEY`)
- Market proxy contacts external LZT Market API — ensure no user-controlled URL manipulation
- Check: no user-controlled URLs in server-side fetch
- Check: market proxy validates/sanitizes all parameters before forwarding

## 5. IDOR (P0)
- Ownership checks on every resource access
- Check: can user A access user B's wallet/case/dispute by changing ID?
- Check: market orders are scoped to the authenticated user

## 6. SQL / NoSQL Injection (P0)
- Ent ORM parameterizes queries (Go)
- MongoDB.Driver parameterizes queries (.NET)
- FluentValidation validators on all financial DTOs (Feature Service)
- Check: no raw query string concatenation

## 7. Rate Limiting
- Per-route: general 60/min, auth 10/min, search 20/min
- Check: financial endpoints have appropriate limits
- Check: market proxy endpoints are rate-limited (prevents abuse of external API)

## 8. Reverse Proxy Misconfiguration
- Nginx: HTTPS redirect + HSTS
- Backend binds to loopback (127.0.0.1)
- Check: ports 8080/5000 not exposed to public

## 9. Headers / Cookies / CORS
- Strict allowlist origins (no `*` with credentials)
- Security headers middleware in both backends
- Check: HttpOnly, Secure, SameSite cookie flags
- Note: presence cookies are non-HttpOnly (set by client JS) — this is intentional and safe since they carry no sensitive data

## 10. Dependency / Supply-Chain Risk
- CI runs npm audit, Go vulnerability scanning
- Pin dependencies, verify provenance
- Check: lockfiles up to date, no known CVEs

## 11. Over-Privileged Service Boundaries
- Internal auth middleware: `backend/middleware/internal_auth.go`
- Check: internal endpoints return 401 without valid `INTERNAL_API_KEY`

## 12. Sensitive Logging
- No request body logging for financial endpoints
- PII redaction policy
- Check: grep log sinks for email, PIN, token patterns
- Check: market order logs do not leak supplier credentials or account details

## 13. Frontend Middleware Security
- Edge middleware (`frontend/proxy.js`) protects routes via presence cookies
- Middleware does NOT validate JWTs — only checks cookie existence as a hint
- Client-side guards (`useAuthRedirectGuard`, `auth.js`) perform actual token validation
- Check: no sensitive operations rely solely on middleware cookie check
- Check: middleware redirect URLs are validated (no open redirect)

## 14. External API Proxy Security
- Market handler proxies requests to LZT Market API
- Supplier API credentials stored in environment variables, never in code
- Check: supplier credentials are not logged or exposed in error responses
- Check: retry logic has bounded attempts (no infinite retry loops)
- Check: supplier balance checks prevent overselling

## 15. Browser Service / Anti-Detect Security
- **Session isolation:** Each session runs in isolated Xvfb display — no cross-session data leakage
- **IDOR prevention:** Session start/stop requires JWT; session ownership verified by user_id
- **Proxy SSRF:** Browser sessions make external requests through user-provided proxies — ensure proxy URLs are validated (no `127.0.0.1`, `localhost`, or internal IPs)
- **Process isolation:** Each session spawns separate Xvfb + Chrome + x11vnc + websockify processes; watchdog auto-kills orphans every 15s
- **WebSocket security:** noVNC connections through nginx with SSL termination; no direct VNC port exposure to public
- **Billing integrity:** Per-minute billing ticks authenticated via SERVICE_TOKEN; auto-stop on insufficient balance
- **Fingerprint data:** Profile fingerprints generated deterministically (mulberry32 PRNG) — no sensitive data stored
- **Port exposure:** VNC ports (6200-6299) and WebSocket ports (6300-6399) bind to `0.0.0.0` but nginx only proxies authenticated WebSocket connections
- Check: can user A access user B's VNC stream by guessing WebSocket port?
- Check: proxy URLs do not point to internal services (SSRF via browser)
- Check: session process cleanup on stop/crash (no zombie processes)
- Check: billing cannot be bypassed by direct WebSocket connection

## Security Verification Commands

```bash
# Check for Math.random() usage (must use crypto.randomUUID for tokens):
grep -rn 'Math\.random' frontend/ --include='*.jsx' --include='*.js' | grep -v node_modules

# Check for InsecureSkipVerify:
grep -rn 'InsecureSkipVerify' backend/ --include='*.go'

# Check for console leaks in lib/:
grep -rn 'console\.' frontend/lib/ --include='*.js' | grep -v logger.js | grep -v test

# Check for raw SQL:
grep -rn 'db\.Exec\|db\.Query\|sql\.Open' backend/ --include='*.go'

# Check for hardcoded secrets:
grep -rn 'password\|secret\|api_key\|apikey' backend/ frontend/lib/ --include='*.go' --include='*.js' | grep -v test | grep -v '.env'

# Check for open redirects in middleware:
grep -rn 'redirect\|location' frontend/proxy.js

# Check for print() in browser-service (should use logging):
grep -rn 'print(' browser-service/ --include='*.py' | grep -v __pycache__ | grep -v test

# Check for internal IP in proxy validation (browser service SSRF):
grep -rn '127\.0\.0\.1\|localhost\|0\.0\.0\.0' browser-service/ --include='*.py' | grep -v config | grep -v __pycache__

# Run full security CI:
# (triggered automatically on push to main)
```
