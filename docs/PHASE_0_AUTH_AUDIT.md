# PHASE 0: AUDIT & INVENTORY - ALEPHDRAAD AUTH SYSTEM

**Tanggal:** 24 Januari 2026  
**Versi:** 1.0  
**Status:** ✅ COMPLETE  
**Auditor:** Senior Staff Engineer + Security Engineer  

---

## EXECUTIVE SUMMARY

Audit menyeluruh terhadap sistem autentikasi Alephdraad telah selesai. Sistem saat ini **sudah cukup baik** dengan rotating refresh tokens, reuse detection, dan token family tracking. Namun, ada beberapa **improvement opportunities** untuk mencapai enterprise-grade standard terutama di frontend token handling dan observability.

### Temuan Utama
✅ **SUDAH BAGUS:**
- Rotating refresh token sudah diimplementasi di backend
- Reuse detection dengan grace period (5 detik) untuk multi-tab
- Token family tracking untuk invalidasi session
- Session locking pada suspicious activity
- Rate limiting comprehensive
- Security audit logging sudah ada

⚠️ **PERLU IMPROVEMENT:**
- Frontend single-flight refresh kurang robust (race condition masih bisa terjadi)
- Tidak ada request ID/correlation ID di Go backend
- Audit log event coverage bisa lebih lengkap
- Tidak ada step-up auth untuk operasi sensitif
- CSRF protection tidak ada (karena localStorage, bukan cookies)

---

## 1. FRONTEND TOKEN HANDLING

### 1.1 Storage Mechanism
**Lokasi:** `frontend/lib/auth.js`

```javascript
// Token disimpan di localStorage
export const TOKEN_KEY = "token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const TOKEN_EXPIRES_KEY = "token_expires";
```

**Analisis:**
- ✅ Menggunakan localStorage (mudah diakses, persistent)
- ⚠️ Rentan terhadap XSS attack (tidak ada HttpOnly)
- ✅ Token expiry disimpan untuk proactive refresh
- ✅ Auth change broadcast untuk sync antar components

**Rekomendasi:**
- Pertimbangkan HttpOnly cookie untuk refresh token
- Implementasi CSP (Content Security Policy) lebih ketat
- Sanitize semua user input untuk mitigasi XSS

---

### 1.2 Token Refresh Mechanism
**File:** `frontend/lib/tokenRefresh.js`

```javascript
let refreshPromise = null;

export async function refreshAccessToken() {
  // Prevent multiple simultaneous refresh calls
  if (refreshPromise) {
    return refreshPromise;
  }
  
  refreshPromise = (async () => {
    // ... refresh logic
  })();
  
  return refreshPromise;
}
```

**Analisis:**
✅ **Ada single-flight mechanism** dengan `refreshPromise`
✅ Proactive refresh saat token hampir expired (30 detik buffer)
✅ Retry logic pada 401 di `fetchWithAuth`
⚠️ **MASALAH POTENSIAL:**
- Race condition masih bisa terjadi jika multiple requests concurrent
- `refreshPromise` di-reset setelah selesai, window kecil tapi tetap ada
- Tidak ada queue untuk pending requests

**Root Cause "Session Expired Loop":**
1. **Scenario:** 10 API calls concurrent saat token expired
2. **Yang terjadi:**
   - Request pertama trigger refresh → OK
   - 9 request lain mungkin trigger refresh bersamaan (sebelum `refreshPromise` set)
   - Backend detect reuse → revoke session → lock account
3. **Hasil:** User harus refresh halaman atau login ulang

---

### 1.3 SWR Integration
**File:** `frontend/lib/swr.js`

```javascript
export async function authFetcher(url) {
  const res = await fetchWithAuth(url);
  // ... error handling
}
```

**Analisis:**
✅ SWR config bagus (revalidateOnFocus, keepPreviousData)
✅ Error retry logic tidak retry pada auth errors (401/403)
⚠️ SWR bisa trigger banyak concurrent requests → refresh race condition

---

## 2. GO BACKEND AUTH/SESSION

### 2.1 Auth Endpoints
**File:** `backend/handlers/auth_handler.go`

| Endpoint | Rate Limit | Analisis |
|----------|------------|----------|
| POST `/auth/register` | 6/min | ✅ Good |
| POST `/auth/login` | 10/min | ✅ Good |
| POST `/auth/refresh` | 30/min | ✅ Generous tapi aman |
| POST `/auth/verify-email` | 10/min | ✅ Good |
| POST `/auth/logout` | None | ⚠️ Should have limit |

**Temuan:**
✅ Rate limiting comprehensive dengan temporary IP block
✅ TOTP support dengan backup codes
✅ Session device tracking
⚠️ Logout endpoint tidak ada rate limit (minor)

---

### 2.2 Session Service - Token Rotation
**File:** `backend/services/session_service_ent.go`

**SUDAH SANGAT BAGUS! Implementasi enterprise-grade:**

```go
// REUSE DETECTION with grace period
if sess.IsUsed {
    timeSinceLastUse := time.Since(sess.LastUsedAt)
    
    if timeSinceLastUse > SessionGracePeriod { // 5 seconds
        // Token reuse detected - REVOKE ALL FAMILY
        s.RevokeTokenFamily(ctx, sess.TokenFamily, "Token reuse detected")
        s.LockAccount(ctx, sess.UserID, "Token dicuri")
        return ErrAccountLocked
    }
    
    // Within grace period - multi-tab scenario
    // Return same refresh token
}
```

✅ **Fitur yang sudah ada:**
1. Rotating refresh token dengan atomic update
2. Token family untuk tracking lineage
3. Reuse detection dengan grace period (5 detik)
4. Session revocation pada suspicious activity
5. Account locking (7 hari) pada theft detection
6. IP/User-Agent drift detection
7. Refresh token hanya rotate jika < 24 jam dari expiry

**Session Schema:**
```go
// backend/ent/schema/session.go
field.String("refresh_token_hash") // ✅ Hash, bukan plaintext
field.String("access_token_jti")   // ✅ JTI tracking
field.String("token_family")       // ✅ Family tracking
field.Bool("is_used")              // ✅ Reuse detection
field.Time("last_used_at")         // ✅ Grace period tracking
```

---

### 2.3 Security Audit Service
**File:** `backend/services/security_audit_ent.go`

✅ **Ada security audit logging:**
- Login success/failed
- Account locked
- TOTP failed/success
- Token reuse detected
- Brute force detection

**Event Types:**
```go
EventLoginSuccess
EventLoginFailed
EventAccountLocked
EventBruteForce
EventTOTPFailed
EventTokenReuse
```

⚠️ **Missing Events:**
- REGISTER
- REFRESH (normal)
- LOGOUT
- VERIFY_EMAIL
- RESET_PASSWORD
- ENABLE_2FA / DISABLE_2FA

---

## 3. FEATURE SERVICE (.NET)

### 3.1 JWT Validation
**File:** `feature-service/src/FeatureService.Api/Infrastructure/Auth/AdminJwtAuthHandler.cs`

```csharp
var validationParameters = new TokenValidationParameters
{
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new SymmetricSecurityKey(key),
    ValidateIssuer = false,  // ⚠️ Disabled
    ValidateAudience = false, // ⚠️ Disabled
    ValidateLifetime = true,  // ✅ Good
    ClockSkew = TimeSpan.FromMinutes(5) // ✅ Good
};
```

**Analisis:**
✅ JWT validation sudah OK
⚠️ Issuer/Audience validation disabled (minor security risk)
✅ Shared secret dengan Go backend (`JWT_SECRET`)
✅ Admin token support

**Rekomendasi:**
- Enable `ValidateIssuer` dan `ValidateAudience` untuk defense in depth
- Sync dengan `JWT_ISSUER` dan `JWT_AUDIENCE` di .env

---

### 3.2 Correlation ID Middleware
**File:** `feature-service/src/FeatureService.Api/Middleware/CorrelationIdMiddleware.cs`

✅ **SUDAH ADA!**
```csharp
var correlationId = context.Request.Headers["X-Request-Id"].FirstOrDefault()
    ?? Guid.NewGuid().ToString();
context.Items["RequestId"] = correlationId;
context.Response.Headers.Append("X-Request-Id", correlationId);
```

**Analisis:**
✅ .NET Feature Service sudah punya request ID
❌ Go Backend BELUM ada request ID middleware
⚠️ Frontend tidak propagate request ID

---

## 4. SECURITY ASSESSMENT

### 4.1 Rate Limiting
**File:** `backend/middleware/enhanced_rate_limit.go`

✅ **EXCELLENT Implementation:**
- IP-based limiting (60/min, 1000/hour)
- User-based limiting (120/min, 2000/hour) 
- Auth endpoints stricter (10/min, 100/hour)
- Temporary IP blocking (15 min) after excessive auth attempts
- Whitelist/blacklist support

### 4.2 Account Lockout
**File:** `backend/services/session_service_ent.go`

✅ **Good Implementation:**
- 7 days lockout on token reuse
- Login attempt tracking
- TOTP failure tracking (4 attempts → lock)
- PIN failure tracking (4 attempts → 4 hour lock)

### 4.3 CSRF Protection
**Status:** ❌ **TIDAK ADA**

**Analisis:**
- Tokens di localStorage, bukan cookie → **CSRF tidak relevan**
- Jika switch ke cookie (HttpOnly), WAJIB tambah CSRF protection:
  - SameSite=Strict/Lax
  - CSRF token (double submit cookie)
  - Origin/Referer check

### 4.4 Step-Up Authentication
**Status:** ⚠️ **PARTIAL**

**Yang sudah ada:**
- `backend/middleware/sudo.go` → sudo mode middleware
- PIN requirement untuk financial operations
- TOTP requirement untuk PIN setup, transfers, withdrawals

**Yang kurang:**
- Tidak ada sudo token mechanism (user re-enter password)
- Sensitive operations (change email/password) belum enforce step-up

---

## 5. OBSERVABILITY

### 5.1 Request ID / Correlation ID
**Status:** ⚠️ **PARTIAL**

| Service | Status | File |
|---------|--------|------|
| Frontend | ❌ None | - |
| Go Backend | ❌ None | - |
| .NET Feature Service | ✅ Exists | `Middleware/CorrelationIdMiddleware.cs` |

**Rekomendasi:**
- Tambah request ID middleware di Go backend
- Frontend propagate `X-Request-Id` header
- Log semua request dengan request ID

### 5.2 Audit Log Coverage
**Status:** ⚠️ **GOOD but INCOMPLETE**

**Events yang sudah dilog:**
- ✅ Login success/failed
- ✅ Account locked
- ✅ TOTP attempts
- ✅ Token reuse
- ✅ Brute force detection

**Events yang BELUM dilog:**
- ❌ REGISTER (new account)
- ❌ REFRESH (token refresh)
- ❌ LOGOUT
- ❌ VERIFY_EMAIL
- ❌ RESET_PASSWORD
- ❌ ENABLE_2FA / DISABLE_2FA
- ❌ SESSION_REVOKED

---

## 6. ROOT CAUSE ANALYSIS: "SESSION EXPIRED LOOP"

### 6.1 Akar Masalah #1: Frontend Race Condition
**Severity:** 🔴 HIGH

**Scenario:**
```
Time 0ms:  10 concurrent API calls (SWR revalidate)
Time 1ms:  Token check → expired
Time 2ms:  Request 1 → refreshPromise = fetch(/refresh)
Time 3ms:  Request 2-10 → refreshPromise STILL null → trigger refresh
           (refreshPromise belum assigned karena async)
Time 10ms: 10 refresh requests hit backend
```

**Impact:**
- Backend detect reuse (>5 detik grace period terlewati)
- All tokens revoked
- Account locked 7 hari
- User harus login ulang

**Root Cause:**
- `refreshPromise` assignment tidak atomic
- Multiple requests bisa masuk sebelum promise assigned
- SWR revalidateOnFocus trigger banyak concurrent requests

---

### 6.2 Akar Masalah #2: Grace Period Terlalu Pendek
**Severity:** 🟡 MEDIUM

**Current:** 5 detik grace period

**Scenario:**
- Slow network: refresh 1 → 3 detik
- Refresh 2 triggered karena race condition → 4 detik
- Total 7 detik → **MELEBIHI grace period**
- False positive token reuse

**Rekomendasi:**
- Extend grace period ke 10-15 detik
- OR: Improve frontend single-flight mechanism

---

### 6.3 Akar Masalah #3: Network Retry Behavior
**Severity:** 🟢 LOW

**Scenario:**
- Network error saat refresh
- Frontend retry
- Backend sudah mark session as used
- Retry dianggap reuse (jika > grace period)

**Mitigasi saat ini:**
- Grace period 5 detik cukup untuk retry
- Network error di frontend tidak clear token (good!)

---

## 7. DIAGRAM: ALUR TOKEN AKTUAL

### 7.1 Normal Flow (Happy Path)
```
┌─────────┐                 ┌──────────┐                ┌──────────┐
│ Browser │                 │ Frontend │                │  Backend │
└────┬────┘                 └────┬─────┘                └────┬─────┘
     │                           │                           │
     │ 1. Page Load              │                           │
     ├──────────────────────────>│                           │
     │                           │                           │
     │                           │ 2. Check token expiry     │
     │                           │    (30s buffer)           │
     │                           │                           │
     │                           │ 3. Token valid?           │
     │                           │    YES → use cached       │
     │                           │                           │
     │ 4. API Call               │                           │
     ├──────────────────────────>│ 5. Attach Bearer token    │
     │                           ├──────────────────────────>│
     │                           │                           │
     │                           │                 6. Verify JWT
     │                           │                    + Check session
     │                           │                           │
     │                           │<──────────────────────────┤
     │                           │         7. Response       │
     │<──────────────────────────┤                           │
     │      8. Render data       │                           │
```

### 7.2 Token Refresh Flow
```
┌─────────┐                 ┌──────────┐                ┌──────────┐
│ Browser │                 │ Frontend │                │  Backend │
└────┬────┘                 └────┬─────┘                └────┬─────┘
     │                           │                           │
     │ 1. API Call               │                           │
     ├──────────────────────────>│                           │
     │                           │ 2. Check token expiry     │
     │                           │    EXPIRED or <30s        │
     │                           │                           │
     │                           │ 3. refreshPromise?        │
     │                           │    NO → create promise    │
     │                           │                           │
     │                           │ 4. POST /auth/refresh     │
     │                           ├──────────────────────────>│
     │                           │   {refresh_token}         │
     │                           │                           │
     │                           │              5. Find session
     │                           │                 by hash(token)
     │                           │                           │
     │                           │              6. Check:
     │                           │                 - Not expired?
     │                           │                 - Not revoked?
     │                           │                 - Not used? (if >grace)
     │                           │                           │
     │                           │              7. Mark as used
     │                           │                 (atomic update)
     │                           │                           │
     │                           │              8. Generate new tokens
     │                           │                 - New access token
     │                           │                 - New refresh token
     │                           │                 - Same family
     │                           │                           │
     │                           │<──────────────────────────┤
     │                           │   {access, refresh, exp}  │
     │                           │                           │
     │                           │ 9. Save to localStorage   │
     │                           │    + reset refreshPromise │
     │                           │                           │
     │                           │ 10. Retry original request│
     │                           ├──────────────────────────>│
     │                           │    with NEW token         │
     │                           │<──────────────────────────┤
     │<──────────────────────────┤                           │
```

### 7.3 Token Reuse Detection Flow (PROBLEM!)
```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│Request 1│     │Request 2 │     │ Frontend │     │  Backend │
└────┬────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │               │                │                │
     │ API call      │ API call       │                │
     ├──────────────>│                │                │
     │               ├───────────────>│                │
     │               │                │ Check expired  │
     │               │                │ YES            │
     │               │                │                │
     │               │                │ refreshPromise?│
     │               │                │ NO (race!)     │
     │               │                │                │
     │               │         Req1: Refresh           │
     │               │                ├───────────────>│
     │               │                │                │ Mark used
     │               │                │                │ Return tokens
     │               │                │<───────────────┤
     │               │                │                │
     │               │         Req2: Refresh (SAME TOKEN!)
     │               │                ├───────────────>│
     │               │                │                │
     │               │                │        Check: is_used=true
     │               │                │        time_since = 6s
     │               │                │        > 5s grace period
     │               │                │        
     │               │                │        🚨 REUSE DETECTED!
     │               │                │        
     │               │                │        Action:
     │               │                │        1. Revoke all family
     │               │                │        2. Lock account 7d
     │               │                │        
     │               │                │<───────────────┤
     │               │                │    401/403     │
     │               │<───────────────┤   Account locked
     │<──────────────┤                │                │
     │  Session expired               │                │
```

---

## 8. REKOMENDASI PRIORITAS

### Priority 1: CRITICAL (Fix Race Condition)
**Impact:** HIGH - Prevents account lockouts

1. **Frontend: Robust Single-Flight Refresh**
   - Implement proper mutex/lock mechanism
   - Queue pending requests during refresh
   - Test concurrent scenarios (10+ requests)

2. **Backend: Extend Grace Period**
   - Increase from 5s → 15s
   - Accommodate slow networks + retries

**Estimasi:** 4-6 jam
**Risk:** LOW - Backward compatible

---

### Priority 2: HIGH (Observability)
**Impact:** HIGH - Essential for debugging production issues

1. **Go Backend: Request ID Middleware**
   - Generate/accept `X-Request-Id` header
   - Log in all requests
   - Propagate to .NET service

2. **Audit Log Enhancement**
   - Add missing events (REGISTER, REFRESH, LOGOUT, etc.)
   - Include request ID in audit logs

**Estimasi:** 3-4 jam
**Risk:** LOW - Additive only

---

### Priority 3: MEDIUM (Step-Up Auth)
**Impact:** MEDIUM - Better security for sensitive operations

1. **Sudo Token Mechanism**
   - User re-enter password for sensitive ops
   - Generate short-lived sudo token (15 min)
   - Require for: change email, change password, disable 2FA

**Estimasi:** 6-8 jam
**Risk:** MEDIUM - Requires UX changes

---

### Priority 4: LOW (JWT Validation Hardening)
**Impact:** LOW - Defense in depth

1. **.NET: Enable Issuer/Audience Validation**
   - Set `ValidateIssuer = true`
   - Set `ValidateAudience = true`
   - Sync config with Go backend

**Estimasi:** 1 jam
**Risk:** LOW - Config change only

---

### Priority 5: OPTIONAL (Cookie Strategy)
**Impact:** MEDIUM - Better XSS protection, but adds complexity

1. **HttpOnly Cookie for Refresh Token**
   - Move refresh token from localStorage → HttpOnly cookie
   - Keep access token in memory only (not localStorage)
   - Implement CSRF protection:
     - SameSite=Strict
     - CSRF token double-submit

**Estimasi:** 12-16 jam
**Risk:** HIGH - Breaking change, requires careful migration

**Recommendation:** SKIP for now, localStorage OK with good CSP

---

## 9. KESIMPULAN

### Overall Assessment: ⭐⭐⭐⭐☆ (4/5)

**Strengths:**
- ✅ Backend implementation already enterprise-grade
- ✅ Rotating refresh tokens with reuse detection
- ✅ Comprehensive rate limiting
- ✅ Security audit logging
- ✅ TOTP 2FA support

**Weaknesses:**
- ⚠️ Frontend single-flight refresh has race condition
- ⚠️ No request ID in Go backend
- ⚠️ Audit log coverage incomplete
- ⚠️ No step-up auth for all sensitive ops

### Recommended Approach:
1. **Phase 1:** Fix frontend race condition (P1) → 80% of issues solved
2. **Phase 2:** Add observability (P2) → Enable production debugging
3. **Phase 3:** Step-up auth (P3) → Additional security layer
4. **Phase 4:** JWT hardening (P4) → Defense in depth
5. **Phase 5:** Consider cookies (P5) → Only if XSS is major concern

**Next Step:** Proceed to PHASE 1 - Design Document

---

**END OF PHASE 0 AUDIT**
