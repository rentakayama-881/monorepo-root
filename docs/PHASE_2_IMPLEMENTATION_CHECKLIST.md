# PHASE 2: IMPLEMENTATION CHECKLIST

**Status:** ⏳ AWAITING APPROVAL  
**Created:** 24 Januari 2026  

> **Catatan:** Dokumen ini adalah checklist untuk implementasi setelah Phase 0 & Phase 1 diapprove.
> Jangan mulai implementasi sebelum mendapat approval!

---

## ✅ PRE-IMPLEMENTATION CHECKLIST

**Sebelum mulai coding, pastikan:**

- [ ] Phase 0 Audit sudah direview dan disetujui
- [ ] Phase 1 Design sudah direview dan disetujui
- [ ] Timeline 2 minggu sudah disetujui stakeholders
- [ ] Database backup ready (untuk migration)
- [ ] Staging environment available untuk testing
- [ ] Monitoring dashboard ready untuk track metrics
- [ ] Team sudah briefing tentang changes yang akan dilakukan

---

## 📦 PR1: FRONTEND ROBUST SINGLE-FLIGHT REFRESH

**Priority:** 🔴 CRITICAL  
**Estimasi:** 4-6 jam  
**Target:** Week 1, Day 1-2  

### Implementation Steps

#### 1. Update tokenRefresh.js
- [ ] File: `frontend/lib/tokenRefresh.js`
- [ ] Implement robust refresh mechanism
- [ ] Add performRefresh() helper function
- [ ] Update refreshAccessToken() with promise queue
- [ ] Add comprehensive error handling
- [ ] Remove old race-prone code

**Code Changes:**
```javascript
// File: frontend/lib/tokenRefresh.js

let refreshPromise = null;

export async function refreshAccessToken() {
  // If refresh in progress, wait for it
  if (refreshPromise) {
    try {
      return await refreshPromise;
    } catch (error) {
      // Refresh failed, let this request retry
    }
  }

  // Start new refresh
  refreshPromise = performRefresh();
  
  try {
    const newToken = await refreshPromise;
    return newToken;
  } finally {
    // Clear promise so next refresh can start
    refreshPromise = null;
  }
}

async function performRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearToken();
    return null;
  }

  try {
    const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        // Ignore JSON parse errors
      }

      // Check if account is locked
      if (res.status === 403 && (data?.code === "AUTH009" || data?.code === "AUTH012" || data?.message?.includes("terkunci"))) {
        clearToken();
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          window.location.href = "/login?error=account_locked";
        }
        return null;
      }

      // Only clear token for auth errors (401, 403)
      if (res.status === 401 || res.status === 403) {
        clearToken();
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          window.location.href = "/login?session=expired";
        }
      }
      return null;
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token, data.expires_in);
    return data.access_token;
  } catch (error) {
    console.warn("Token refresh failed (network):", error.message);
    return null;
  }
}
```

#### 2. Update api.js (Add Request ID)
- [ ] File: `frontend/lib/api.js`
- [ ] Add generateRequestId() helper
- [ ] Update fetchJsonAuth to include X-Request-Id header

**Code Changes:**
```javascript
// File: frontend/lib/api.js

function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

export async function fetchJsonAuth(path, options = {}) {
  const { timeout = 10000, signal, headers = {}, ...rest } = options;
  
  // ... existing code ...
  
  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`,
      "X-Request-Id": generateRequestId(), // 🆕 Add request ID
    },
    signal: controller.signal,
  });
  
  // ... rest of code ...
}
```

#### 3. Write Tests
- [ ] File: `frontend/lib/__tests__/tokenRefresh.test.js` (create if not exists)
- [ ] Test: Single request → refresh → success
- [ ] Test: 10 concurrent requests → 1 refresh call
- [ ] Test: Refresh during ongoing refresh → wait → reuse result
- [ ] Test: Refresh failure → all waiting requests fail gracefully
- [ ] Test: Network timeout → retry → no duplicate refresh

#### 4. Manual Testing
- [ ] Test with browser DevTools throttling (Slow 3G)
- [ ] Open 5 tabs, trigger refresh in all simultaneously
- [ ] Verify only 1 refresh request in Network tab
- [ ] Check console for any errors
- [ ] Verify no account lockouts

#### 5. Code Review
- [ ] Create PR with detailed description
- [ ] Request review from at least 2 team members
- [ ] Address review comments
- [ ] Get approval

#### 6. Deployment
- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Smoke test in staging (login, trigger refresh)
- [ ] Monitor staging for 24 hours
- [ ] Deploy to production
- [ ] Monitor production metrics

**Success Criteria:**
- ✅ Concurrent refresh calls reduced to 1
- ✅ No account lockouts in staging/production
- ✅ Refresh success rate > 99%

---

## 📦 PR2: BACKEND GRACE PERIOD + REQUEST ID

**Priority:** 🔴 CRITICAL  
**Estimasi:** 3-4 jam  
**Target:** Week 1, Day 3-4  

### Implementation Steps

#### 1. Extend Grace Period
- [ ] File: `backend/services/session_service_ent.go`
- [ ] Change `SessionGracePeriod` from 5s to 15s
- [ ] Update log messages to reflect new grace period

**Code Changes:**
```go
// File: backend/services/session_service_ent.go

const (
    SessionGracePeriod = 15 * time.Second  // 🔄 Changed from 5s
    RefreshTokenRotationWindow = 24 * time.Hour
    MaxConcurrentSessions = 5
)

// In RefreshSession function, update log message:
logger.Info("Refresh token reuse within grace period",
    zap.Int("user_id", sess.UserID),
    zap.Duration("time_since_last_use", timeSinceLastUse),
    zap.Duration("grace_period", SessionGracePeriod))  // 🆕 Add for clarity
```

#### 2. Create Request ID Middleware
- [ ] File: `backend/middleware/request_id.go` (create new file)
- [ ] Implement RequestID() middleware
- [ ] Implement GetRequestID() helper

**Code Changes:**
```go
// File: backend/middleware/request_id.go

package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDHeader = "X-Request-Id"
const RequestIDKey = "request_id"

// RequestID middleware generates or accepts request ID for tracing
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if request already has ID (from client or load balancer)
		requestID := c.GetHeader(RequestIDHeader)
		
		// Generate new ID if not present
		if requestID == "" {
			requestID = uuid.New().String()
		}
		
		// Store in context for handlers to use
		c.Set(RequestIDKey, requestID)
		
		// Add to response header for client debugging
		c.Header(RequestIDHeader, requestID)
		
		c.Next()
	}
}

// GetRequestID retrieves request ID from context
func GetRequestID(c *gin.Context) string {
	if requestID, exists := c.Get(RequestIDKey); exists {
		return requestID.(string)
	}
	return ""
}
```

#### 3. Integrate Request ID Middleware
- [ ] File: `backend/main.go`
- [ ] Add RequestID middleware (first in chain!)
- [ ] Add import for uuid package

**Code Changes:**
```go
// File: backend/main.go

import (
    // ... existing imports ...
    "github.com/google/uuid"  // 🆕 Add this
)

func main() {
    router := gin.New()
    
    // Add request ID middleware (FIRST!)
    router.Use(middleware.RequestID())  // 🆕
    router.Use(middleware.Recovery())
    router.Use(middleware.Security())
    // ... rest of middleware
    
    // ... routes ...
}
```

#### 4. Update go.mod
- [ ] Add uuid dependency: `go get github.com/google/uuid`

#### 5. Update Handlers to Log Request ID
- [ ] File: `backend/handlers/auth_handler.go`
- [ ] Add request ID to critical log statements

**Example:**
```go
// In Login handler
requestID := middleware.GetRequestID(c)
logger.Info("Login attempt",
    zap.String("request_id", requestID),  // 🆕
    zap.String("ip", c.ClientIP()),
    zap.String("email", req.Email))

// In RefreshToken handler
logger.Info("Refresh token request",
    zap.String("request_id", requestID),  // 🆕
    zap.String("ip", c.ClientIP()))
```

#### 6. Tests
- [ ] File: `backend/middleware/request_id_test.go` (create)
- [ ] Test: Request without ID → generates one
- [ ] Test: Request with ID → uses provided ID
- [ ] Test: Response includes ID in header

#### 7. Code Review & Deploy
- [ ] Create PR
- [ ] Review & approval
- [ ] Deploy to staging
- [ ] Verify request IDs in logs
- [ ] Deploy to production

**Success Criteria:**
- ✅ All requests have request ID in logs
- ✅ Same request ID propagated from frontend
- ✅ Grace period reduced false positives
- ✅ No account lockouts due to slow networks

---

## 📦 PR3: ENHANCED AUDIT LOGGING

**Priority:** 🟡 HIGH  
**Estimasi:** 4-5 jam  
**Target:** Week 2, Day 1-3  

### Implementation Steps

#### 1. Update Ent Schema
- [ ] File: `backend/ent/schema/security_event.go`
- [ ] Add new fields: request_id, session_id, metadata

**Code Changes:**
```go
// File: backend/ent/schema/security_event.go

func (SecurityEvent) Fields() []ent.Field {
    return []ent.Field{
        // ... existing fields ...
        
        // 🆕 New fields
        field.String("request_id").MaxLen(64).Optional(),
        field.String("session_id").MaxLen(64).Optional(),
        field.JSON("metadata", map[string]interface{}{}).Optional(),
    }
}
```

#### 2. Generate Ent Code
- [ ] Run: `cd backend && go generate ./ent`
- [ ] Verify generated files compile

#### 3. Create DB Migration
- [ ] File: `backend/database/migrations/add_audit_fields.sql` (create)

**SQL Migration:**
```sql
-- Migration: Add request_id, session_id, metadata to security_events
ALTER TABLE security_events
ADD COLUMN request_id VARCHAR(64),
ADD COLUMN session_id VARCHAR(64),
ADD COLUMN metadata JSONB;

-- Add index for faster queries
CREATE INDEX idx_security_events_request_id ON security_events(request_id);
CREATE INDEX idx_security_events_session_id ON security_events(session_id);
```

#### 4. Run Migration
- [ ] Backup database first!
- [ ] Run migration on staging
- [ ] Verify schema changes
- [ ] Run migration on production (zero downtime)

#### 5. Update Security Types
- [ ] File: `backend/services/security_types.go`
- [ ] Add new event types

**Code Changes:**
```go
// File: backend/services/security_types.go

const (
    // Existing events...
    EventLoginSuccess SecurityEventType = "LOGIN_SUCCESS"
    EventLoginFailed SecurityEventType = "LOGIN_FAILED"
    // ... etc ...
    
    // 🆕 New events
    EventRegister SecurityEventType = "REGISTER"
    EventRefreshSuccess SecurityEventType = "REFRESH_SUCCESS"
    EventRefreshFailed SecurityEventType = "REFRESH_FAILED"
    EventLogout SecurityEventType = "LOGOUT"
    EventLogoutAll SecurityEventType = "LOGOUT_ALL"
    EventVerifyEmail SecurityEventType = "VERIFY_EMAIL"
    EventResetPassword SecurityEventType = "RESET_PASSWORD"
    EventChangePassword SecurityEventType = "CHANGE_PASSWORD"
    EventChangeEmail SecurityEventType = "CHANGE_EMAIL"
    EventEnable2FA SecurityEventType = "ENABLE_2FA"
    EventDisable2FA SecurityEventType = "DISABLE_2FA"
    EventSessionRevoked SecurityEventType = "SESSION_REVOKED"
)
```

#### 6. Update Security Audit Service
- [ ] File: `backend/services/security_audit_ent.go`
- [ ] Update LogEvent to include request_id
- [ ] Add new methods for each new event type

**Code Changes:**
```go
// File: backend/services/security_audit_ent.go

// Update LogEvent to extract request ID from context
func (s *EntSecurityAuditService) LogEvent(ctx context.Context, eventType SecurityEventType, userID *int, email, ip, userAgent, details, severity string, success bool) {
    // Extract request ID from context
    requestID := ""
    if ginCtx, ok := ctx.(*gin.Context); ok {
        requestID = middleware.GetRequestID(ginCtx)
    }
    
    // ... existing logging code ...
    
    // Add request ID to log fields
    if requestID != "" {
        logFields = append(logFields, zap.String("request_id", requestID))
    }
    
    // Persist to database with request ID
    builder := database.GetEntClient().SecurityEvent.Create().
        SetEventType(string(eventType)).
        SetEmail(email).
        SetIPAddress(ip).
        SetUserAgent(userAgent).
        SetSuccess(success).
        SetDetails(details).
        SetSeverity(severity)
    
    if requestID != "" {
        builder.SetRequestID(requestID)  // 🆕
    }
    
    if userID != nil {
        builder.SetUserID(*userID)
    }
    
    if _, err := builder.Save(ctx); err != nil {
        logger.Error("Failed to persist security event", zap.Error(err))
    }
}

// 🆕 Add new audit methods
func (s *EntSecurityAuditService) LogRegister(ctx context.Context, user *ent.User, ip, userAgent string) {
    userID := user.ID
    s.LogEvent(ctx, EventRegister, &userID, user.Email, ip, userAgent, "", "info", true)
}

func (s *EntSecurityAuditService) LogRefreshSuccess(ctx context.Context, userID int, email, ip, userAgent string) {
    s.LogEvent(ctx, EventRefreshSuccess, &userID, email, ip, userAgent, "", "info", true)
}

func (s *EntSecurityAuditService) LogRefreshFailed(ctx context.Context, email, ip, userAgent, reason string) {
    s.LogEvent(ctx, EventRefreshFailed, nil, email, ip, userAgent, reason, "warning", false)
}

func (s *EntSecurityAuditService) LogLogout(ctx context.Context, userID int, email, ip, userAgent string) {
    s.LogEvent(ctx, EventLogout, &userID, email, ip, userAgent, "", "info", true)
}

func (s *EntSecurityAuditService) LogVerifyEmail(ctx context.Context, user *ent.User, ip string) {
    userID := user.ID
    s.LogEvent(ctx, EventVerifyEmail, &userID, user.Email, ip, "", "", "info", true)
}

func (s *EntSecurityAuditService) LogResetPassword(ctx context.Context, user *ent.User, ip string) {
    userID := user.ID
    s.LogEvent(ctx, EventResetPassword, &userID, user.Email, ip, "", "", "warning", true)
}

func (s *EntSecurityAuditService) LogEnable2FA(ctx context.Context, user *ent.User, ip, userAgent string) {
    userID := user.ID
    s.LogEvent(ctx, EventEnable2FA, &userID, user.Email, ip, userAgent, "", "info", true)
}

func (s *EntSecurityAuditService) LogDisable2FA(ctx context.Context, user *ent.User, ip, userAgent string) {
    userID := user.ID
    s.LogEvent(ctx, EventDisable2FA, &userID, user.Email, ip, userAgent, "", "warning", true)
}
```

#### 7. Integrate Audit Calls in Handlers
- [ ] File: `backend/handlers/auth_handler.go`
- [ ] Add audit calls for Register, Refresh, Logout, etc.

**Examples:**
```go
// In Register handler (success case)
if securityAudit != nil {
    securityAudit.LogRegister(c, createdUser, c.ClientIP(), c.GetHeader("User-Agent"))
}

// In RefreshToken handler (success case)
if securityAudit != nil {
    securityAudit.LogRefreshSuccess(c, userID, email, c.ClientIP(), c.GetHeader("User-Agent"))
}

// In RefreshToken handler (failure case)
if securityAudit != nil {
    securityAudit.LogRefreshFailed(c, "", c.ClientIP(), c.GetHeader("User-Agent"), err.Error())
}

// In Logout handler
if securityAudit != nil {
    user, _ := c.Get("user")
    u := user.(*ent.User)
    securityAudit.LogLogout(c, u.ID, u.Email, c.ClientIP(), c.GetHeader("User-Agent"))
}
```

#### 8. Verify Audit Events
- [ ] Query database after each operation
- [ ] Verify all fields populated correctly
- [ ] Verify request_id matches logs

#### 9. Code Review & Deploy
- [ ] Create PR with migration script
- [ ] Review & approval
- [ ] Deploy to staging (run migration)
- [ ] Verify audit events in staging DB
- [ ] Deploy to production

**Success Criteria:**
- ✅ All 18 event types logged
- ✅ Request ID present in all audit events
- ✅ Database queries fast (indexed)
- ✅ No missing audit events for critical operations

---

## 📦 PR4: STEP-UP AUTH (OPTIONAL)

**Priority:** 🟢 OPTIONAL  
**Estimasi:** 6-8 jam  
**Target:** Week 3+ (if time permits)  

### Implementation Steps

#### 1. Create Sudo Middleware
- [ ] File: `backend/middleware/sudo.go` (create)
- [ ] Implement RequireSudo() middleware
- [ ] Implement sudo token generation/verification

#### 2. Add Sudo Endpoint
- [ ] File: `backend/handlers/auth_handler.go`
- [ ] Add GetSudoToken handler
- [ ] Add VerifySudoToken helper

#### 3. Frontend Sudo Modal
- [ ] File: `frontend/components/SudoModal.jsx` (create)
- [ ] Password prompt UI
- [ ] Call /auth/sudo endpoint
- [ ] Store sudo token in sessionStorage

#### 4. Protect Sensitive Endpoints
- [ ] Apply RequireSudo() middleware to:
  - Change email
  - Change password
  - Disable 2FA
  - Delete account

#### 5. Test & Deploy
- [ ] Manual testing of sudo flow
- [ ] Verify sudo token expiry (15 min)
- [ ] Deploy to staging → production

**Success Criteria:**
- ✅ Sensitive operations require re-authentication
- ✅ Sudo token expires after 15 minutes
- ✅ Good UX (clear messaging)

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [ ] Frontend tokenRefresh.test.js passes
- [ ] Backend request_id_test.go passes
- [ ] Backend session_service_ent_test.go passes (grace period tests)

### Integration Tests
- [ ] Login → Refresh → Success flow
- [ ] Concurrent refresh (10 tabs) → Only 1 backend call
- [ ] Slow network (3G throttled) → No lockout
- [ ] Request ID propagation (Frontend → Go → .NET)
- [ ] All audit events logged correctly

### Load Testing
- [ ] Artillery.io script for concurrent refresh
- [ ] 50 users/sec for 60 seconds
- [ ] Success criteria:
  - 0 account lockouts
  - <5% error rate
  - p95 latency < 500ms

### Manual Testing
- [ ] Multi-tab scenario (5 tabs, refresh simultaneously)
- [ ] Slow network (DevTools throttling)
- [ ] Account lockout recovery (unlock after 7 days)
- [ ] Request ID visible in logs
- [ ] Audit events in database

---

## 📊 MONITORING CHECKLIST

### Metrics to Track (Post-Deployment)
- [ ] Refresh token requests per minute
- [ ] Refresh success rate (target: >99%)
- [ ] Account lockouts per day (target: 0)
- [ ] Grace period reuse events per hour
- [ ] Request ID coverage (% requests with ID, target: 100%)
- [ ] Audit events per hour by type
- [ ] API error rate (target: <5%)

### Alerts to Set Up
- [ ] Refresh success rate < 95% → Slack alert
- [ ] Account lockouts > 5 per day → Email alert
- [ ] Grace period reuse > 100 per hour → Investigate
- [ ] Request ID missing > 10% → Check middleware
- [ ] Audit log write failures > 10 per hour → Check DB

### Dashboards to Create
- [ ] Auth metrics dashboard (Grafana/Datadog)
- [ ] Request ID tracing (log aggregation)
- [ ] Security events timeline
- [ ] Grace period usage histogram

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All PRs merged and approved
- [ ] All tests passing (unit + integration)
- [ ] Database migration tested on staging
- [ ] Rollback plan documented
- [ ] Team notified of deployment schedule

### Staging Deployment
- [ ] Deploy PR1 (frontend refresh)
- [ ] Deploy PR2 (backend grace + request ID)
- [ ] Run DB migration
- [ ] Deploy PR3 (audit logging)
- [ ] Smoke test all critical flows
- [ ] Monitor for 24 hours
- [ ] Check metrics dashboard

### Production Deployment
- [ ] Database backup completed
- [ ] Deploy during low-traffic window
- [ ] Deploy backend first (backward compatible)
- [ ] Run DB migration (zero downtime)
- [ ] Deploy frontend
- [ ] Smoke test critical flows
- [ ] Monitor metrics for first 2 hours
- [ ] Monitor for 1 week post-deployment

### Post-Deployment
- [ ] Verify metrics meet success criteria
- [ ] Check for any error spikes
- [ ] Review audit logs for completeness
- [ ] User feedback (no complaints of session loops)
- [ ] Document any issues encountered
- [ ] Create retrospective document

---

## 📝 DOCUMENTATION UPDATES

### Code Documentation
- [ ] Add JSDoc comments to tokenRefresh.js
- [ ] Add GoDoc comments to new middleware
- [ ] Update README.md with new features
- [ ] Document new audit events

### Team Documentation
- [ ] Update runbook with new monitoring
- [ ] Document rollback procedures
- [ ] Update incident response playbook
- [ ] Share learnings in team meeting

### User Documentation (if needed)
- [ ] Update FAQ if users ask about auth changes
- [ ] No user-facing changes expected (transparent)

---

## ✅ SIGN-OFF CHECKLIST

**After all PRs deployed to production:**

- [ ] All success metrics met
- [ ] No critical bugs in production
- [ ] Monitoring dashboards active
- [ ] Team trained on new features
- [ ] Documentation complete
- [ ] Retrospective completed

**Final Approval:**

- [ ] Product Owner sign-off
- [ ] Tech Lead sign-off
- [ ] Security Lead sign-off

---

**STATUS:** ⏳ AWAITING PHASE 0 & 1 APPROVAL

Mulai implementasi hanya setelah mendapat approval!

---

**Last Updated:** 24 Januari 2026  
**Document Version:** 1.0  
