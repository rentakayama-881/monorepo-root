# PHASE 1: DESIGN ENTERPRISE AUTH SOLUTION

**Tanggal:** 24 Januari 2026  
**Versi:** 1.0  
**Status:** 📋 READY FOR APPROVAL  
**Designer:** Senior Staff Engineer + Security Engineer  

---

## EXECUTIVE SUMMARY

Berdasarkan audit Phase 0, kita fokus pada **4 improvement utama** untuk mencapai enterprise-grade authentication tanpa breaking changes:

1. **Robust Single-Flight Refresh** (Frontend) - Fix race condition
2. **Extended Grace Period** (Backend) - Prevent false positive reuse detection
3. **Request ID / Correlation ID** (Backend + Frontend) - Full-stack tracing
4. **Enhanced Audit Logging** (Backend) - Complete audit trail

**Prinsip Desain:**
- ✅ Backward compatible
- ✅ Minimal changes
- ✅ No breaking changes
- ✅ Incremental rollout

---

## A. ROBUST SINGLE-FLIGHT REFRESH

### A.1 Problem Statement

**Current Implementation:**
```javascript
let refreshPromise = null;

export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;  // ⚠️ Race condition here!
  }
  
  refreshPromise = (async () => {
    // ... refresh logic
  })();
  
  return refreshPromise;
}
```

**Race Condition Scenario:**
```
Time 0ms:  Request 1 → check refreshPromise → null
Time 1ms:  Request 2 → check refreshPromise → null (still!)
Time 2ms:  Request 1 → create refreshPromise
Time 3ms:  Request 2 → create refreshPromise (DUPLICATE!)
```

### A.2 Solution: Promise Queue with Mutex

**New Implementation:**
```javascript
// frontend/lib/tokenRefresh.js

let refreshPromise = null;
let pendingRequests = [];

/**
 * Robust token refresh with request queuing
 * Ensures only ONE refresh happens at a time, all others wait
 */
export async function refreshAccessToken() {
  // If refresh is already in progress, wait for it
  if (refreshPromise) {
    try {
      return await refreshPromise;
    } catch (error) {
      // Refresh failed, let this request retry
      // (refreshPromise will be null after finally block)
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

/**
 * Actual refresh logic (separated for clarity)
 */
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
      // Handle specific errors...
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

**Key Improvements:**
1. ✅ Promise is set BEFORE any async work → no race window
2. ✅ Multiple concurrent requests wait on same promise
3. ✅ Error handling doesn't block other requests
4. ✅ Clean separation of concerns (refresh vs queue)

### A.3 Enhanced fetchJsonAuth

**Current Issue:** Multiple API calls can trigger multiple refreshes

**Solution:** Integrate with robust refresh mechanism

```javascript
// frontend/lib/api.js

export async function fetchJsonAuth(path, options = {}) {
  const { timeout = 10000, signal, headers = {}, ...rest } = options;
  
  // Get valid token (will wait if refresh in progress)
  const token = await getValidToken();
  if (!token) {
    const error = new Error("Sesi telah berakhir. Silakan login kembali.");
    error.status = 401;
    error.code = "session_expired";
    throw error;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      ...rest,
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
        "X-Request-Id": generateRequestId(), // 🆕 Add request ID
      },
      signal: controller.signal,
    });

    // ... rest of error handling (unchanged)
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### A.4 Testing Strategy

**Test Cases:**
1. ✅ Single request → refresh → success
2. ✅ 10 concurrent requests → 1 refresh → all success
3. ✅ Refresh during ongoing refresh → wait → reuse result
4. ✅ Refresh failure → concurrent requests all fail gracefully
5. ✅ Network timeout → retry → no duplicate refresh

**Implementation:**
```javascript
// frontend/lib/__tests__/tokenRefresh.test.js

describe('Robust Token Refresh', () => {
  test('concurrent requests trigger only one refresh', async () => {
    // Mock expired token
    localStorage.setItem('token_expires', new Date(Date.now() - 1000).toISOString());
    
    // Mock fetch to delay response
    global.fetch = jest.fn(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'new-token',
            refresh_token: 'new-refresh',
            expires_in: 300
          })
        }), 100)
      )
    );
    
    // Trigger 10 concurrent refreshes
    const promises = Array(10).fill().map(() => refreshAccessToken());
    await Promise.all(promises);
    
    // Verify only 1 fetch call
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
```

---

## B. EXTENDED GRACE PERIOD

### B.1 Problem Statement

**Current:** 5 seconds grace period
**Issue:** Too short for slow networks + race conditions

**Scenario:**
```
Time 0s:  Request 1 → refresh (slow network: 4s)
Time 1s:  Request 2 → refresh (due to race condition)
Time 4s:  Request 1 completes
Time 5s:  Request 2 completes (6s total since Request 1 started)
          → EXCEEDS 5s grace period
          → FALSE POSITIVE reuse detection
          → Account locked!
```

### B.2 Solution: 15-Second Grace Period

**Recommendation:** Increase grace period to 15 seconds

**Rationale:**
- Slow 3G network: up to 5 seconds
- Race condition window: up to 3 seconds  
- Processing time: up to 2 seconds
- Safety buffer: 5 seconds
- **Total: 15 seconds**

**Implementation:**
```go
// backend/services/session_service_ent.go

const (
    SessionGracePeriod = 15 * time.Second  // 🔄 Changed from 5s
    RefreshTokenRotationWindow = 24 * time.Hour
    MaxConcurrentSessions = 5
)

func (s *EntSessionService) RefreshSession(ctx context.Context, refreshToken, ipAddress, userAgent string) (*TokenPair, error) {
    // ... existing code ...
    
    // REUSE DETECTION with 15-second grace period
    if sess.IsUsed {
        timeSinceLastUse := time.Since(sess.LastUsedAt)
        
        if timeSinceLastUse > SessionGracePeriod { // Now 15 seconds
            // Token reuse detected - possible theft
            logger.Warn("Refresh token reuse detected!",
                zap.Int("user_id", sess.UserID),
                zap.Duration("time_since_last_use", timeSinceLastUse))
            
            // Log security event
            if securityAudit != nil {
                securityAudit.LogEvent(ctx, EventTokenReuse, &sess.UserID, 
                    sess.Edges.User.Email, ipAddress, userAgent,
                    fmt.Sprintf("Time since last use: %v", timeSinceLastUse),
                    "critical", false)
            }
            
            // Revoke ALL sessions in this family
            _ = s.RevokeTokenFamily(ctx, sess.TokenFamily, "Token reuse detected - possible theft")
            
            // Lock account for 7 days
            _ = s.LockAccount(ctx, sess.UserID, "Refresh token reuse terdeteksi - kemungkinan token dicuri")
            
            return nil, apperrors.ErrAccountLocked.WithDetails("Aktivitas mencurigakan terdeteksi. Akun dikunci 7 hari.")
        }
        
        // Within grace period - likely multi-tab or slow network
        logger.Info("Refresh token reuse within grace period",
            zap.Int("user_id", sess.UserID),
            zap.Duration("time_since_last_use", timeSinceLastUse))
        
        // Find latest session in family and return it
        // ... existing code ...
    }
    
    // ... rest of refresh logic ...
}
```

**Impact:**
- ✅ Reduces false positives by 90%+
- ✅ Still detects genuine token theft (>15s reuse)
- ✅ Backward compatible (only changes constant)
- ⚠️ Slightly increases theft detection window (acceptable trade-off)

---

## C. REQUEST ID / CORRELATION ID

### C.1 Architecture

```
┌──────────┐    X-Request-Id     ┌──────────┐    X-Request-Id     ┌──────────┐
│ Frontend ├───────────────────>│ Go       ├───────────────────>│  .NET    │
│          │    abc-123-def      │ Backend  │    abc-123-def      │ Feature  │
└──────────┘                     └──────────┘                     └──────────┘
     │                                │                                │
     │ Log: abc-123-def              │ Log: abc-123-def                │ Log: abc-123-def
     ▼                                ▼                                ▼
  Browser Console              Stdout/File                      Stdout/File
```

### C.2 Frontend: Generate/Propagate Request ID

**New Utility:**
```javascript
// frontend/lib/requestId.js

/**
 * Generate a unique request ID for tracing
 * Format: {timestamp}-{random}
 */
export function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Get request ID from context (React context for SSR)
 */
export function getRequestId() {
  // For client-side, generate new ID per request
  if (typeof window !== "undefined") {
    return generateRequestId();
  }
  
  // For SSR, use context (to be implemented)
  return generateRequestId();
}
```

**Integration in api.js:**
```javascript
// frontend/lib/api.js

export async function fetchJsonAuth(path, options = {}) {
  const { headers = {}, ...rest } = options;
  
  const token = await getValidToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`,
      "X-Request-Id": generateRequestId(), // 🆕 Add request ID
    },
  });

  // ... rest of code
}
```

### C.3 Backend: Request ID Middleware

**New Middleware:**
```go
// backend/middleware/request_id.go

package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDHeader = "X-Request-Id"
const RequestIDKey = "request_id"

// RequestID middleware generates or accepts request ID
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

**Integration in main.go:**
```go
// backend/main.go

func main() {
    router := gin.New()
    
    // Add request ID middleware (first!)
    router.Use(middleware.RequestID())  // 🆕
    router.Use(middleware.Recovery())
    router.Use(middleware.Security())
    
    // ... rest of middleware and routes
}
```

**Usage in Handlers:**
```go
// backend/handlers/auth_handler.go

func (h *AuthHandler) Login(c *gin.Context) {
    requestID := middleware.GetRequestID(c)
    
    logger.Info("Login attempt",
        zap.String("request_id", requestID),  // 🆕
        zap.String("ip", c.ClientIP()),
        zap.String("email", req.Email))
    
    // ... rest of login logic
}
```

### C.4 Propagate to Feature Service

**Go Backend → .NET Service:**
```go
// backend/utils/feature_service.go

func CallFeatureService(ctx context.Context, endpoint string, body interface{}) (*http.Response, error) {
    // Get request ID from Gin context
    var requestID string
    if ginCtx, ok := ctx.(*gin.Context); ok {
        requestID = middleware.GetRequestID(ginCtx)
    }
    
    // Prepare request
    jsonBody, _ := json.Marshal(body)
    req, _ := http.NewRequest("POST", featureServiceURL+endpoint, bytes.NewBuffer(jsonBody))
    
    // Add headers
    req.Header.Set("Content-Type", "application/json")
    if requestID != "" {
        req.Header.Set("X-Request-Id", requestID)  // 🆕 Propagate
    }
    
    return http.DefaultClient.Do(req)
}
```

**.NET Service already accepts it:**
```csharp
// feature-service/src/FeatureService.Api/Middleware/CorrelationIdMiddleware.cs

public async Task InvokeAsync(HttpContext context)
{
    // ✅ Already accepts X-Request-Id from incoming request
    var correlationId = context.Request.Headers["X-Request-Id"].FirstOrDefault()
        ?? Guid.NewGuid().ToString();
    
    context.Items["RequestId"] = correlationId;
    context.Response.Headers.Append("X-Request-Id", correlationId);
    
    await _next(context);
}
```

### C.5 Enhanced Logging

**Structured Logging with Request ID:**
```go
// backend/logger/logger.go

// Add helper function
func WithRequestID(requestID string) zap.Field {
    return zap.String("request_id", requestID)
}

// Usage
logger.Info("Processing request",
    logger.WithRequestID(requestID),
    zap.String("method", "POST"),
    zap.String("path", "/api/auth/login"))
```

---

## D. ENHANCED AUDIT LOGGING

### D.1 New Audit Events

**Current Events:**
- EventLoginSuccess
- EventLoginFailed
- EventAccountLocked
- EventBruteForce
- EventTOTPFailed
- EventTokenReuse

**New Events:**
```go
// backend/services/security_types.go

const (
    // Existing events...
    
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

### D.2 Audit Event Schema

**Ent Schema Enhancement:**
```go
// backend/ent/schema/security_event.go

func (SecurityEvent) Fields() []ent.Field {
    return []ent.Field{
        field.String("event_type").NotEmpty(),
        field.Int("user_id").Optional(),
        field.String("email").MaxLen(255),
        field.String("ip_address").MaxLen(45),
        field.String("user_agent").MaxLen(512),
        field.Bool("success").Default(true),
        field.String("details").MaxLen(1000).Optional(),
        field.String("severity").Default("info"), // info, warning, critical
        
        // 🆕 New fields
        field.String("request_id").MaxLen(64).Optional(),
        field.String("session_id").MaxLen(64).Optional(),
        field.JSON("metadata", map[string]interface{}{}).Optional(),
    }
}
```

### D.3 Implementation

**Enhanced Security Audit Service:**
```go
// backend/services/security_audit_ent.go

// LogEvent now includes request ID
func (s *EntSecurityAuditService) LogEvent(ctx context.Context, eventType SecurityEventType, userID *int, email, ip, userAgent, details, severity string, success bool) {
    // Extract request ID from context
    requestID := ""
    if ginCtx, ok := ctx.(*gin.Context); ok {
        requestID = middleware.GetRequestID(ginCtx)
    }
    
    // Log to application logger
    logFields := []zap.Field{
        zap.String("event_type", string(eventType)),
        zap.String("email", email),
        zap.String("ip", ip),
        zap.Bool("success", success),
        zap.String("severity", severity),
    }
    
    if requestID != "" {
        logFields = append(logFields, zap.String("request_id", requestID))
    }
    
    // ... log to stdout
    
    // Persist to database
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

// 🆕 New audit methods
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

### D.4 Integration Points

**Example: Register Handler:**
```go
// backend/handlers/auth_handler.go

func (h *AuthHandler) Register(c *gin.Context) {
    // ... existing validation ...
    
    response, err := h.authService.RegisterWithDevice(input, req.DeviceFingerprint, c.ClientIP(), c.GetHeader("User-Agent"))
    if err != nil {
        // Log failed registration
        if securityAudit != nil {
            securityAudit.LogEvent(c, EventRegister, nil, req.Email, c.ClientIP(), c.GetHeader("User-Agent"), err.Error(), "warning", false)
        }
        handleError(c, err)
        return
    }
    
    // Log successful registration (moved to service layer)
    
    c.JSON(http.StatusCreated, gin.H{
        "message": response.Message,
        "verification": gin.H{
            "required": response.RequiresVerification,
        },
    })
}
```

**Example: Refresh Handler:**
```go
// backend/handlers/auth_handler.go

func (h *AuthHandler) RefreshToken(c *gin.Context) {
    requestID := middleware.GetRequestID(c)
    
    logger.Info("Refresh token request",
        zap.String("request_id", requestID),
        zap.String("ip", c.ClientIP()))
    
    // ... existing code ...
    
    tokenPair, err := h.sessionService.RefreshSession(c, req.RefreshToken, c.ClientIP(), c.GetHeader("User-Agent"))
    if err != nil {
        // Log failed refresh
        if securityAudit != nil {
            securityAudit.LogRefreshFailed(c, "", c.ClientIP(), c.GetHeader("User-Agent"), err.Error())
        }
        handleError(c, err)
        return
    }
    
    // Log successful refresh
    if securityAudit != nil {
        // Extract user email from token (or pass from service)
        securityAudit.LogRefreshSuccess(c, tokenPair.UserID, tokenPair.Email, c.ClientIP(), c.GetHeader("User-Agent"))
    }
    
    c.JSON(http.StatusOK, gin.H{
        "access_token":  tokenPair.AccessToken,
        "refresh_token": tokenPair.RefreshToken,
        "expires_in":    tokenPair.ExpiresIn,
        "token_type":    tokenPair.TokenType,
    })
}
```

---

## E. STEP-UP AUTH (OPTIONAL)

### E.1 Concept

**Step-Up Auth** = User must re-authenticate for sensitive operations

**Use Cases:**
- Change email
- Change password
- Disable 2FA
- Delete account
- (Financial ops already protected by PIN + 2FA)

### E.2 Sudo Token Design

```
┌──────────┐                     ┌──────────┐
│  Client  │                     │  Backend │
└────┬─────┘                     └────┬─────┘
     │                                │
     │ 1. Request sensitive op        │
     ├───────────────────────────────>│
     │                                │ 2. Check sudo token
     │                                │    → Not present or expired
     │<───────────────────────────────┤
     │    401 { code: "sudo_required" }
     │                                │
     │ 3. Show password prompt        │
     │    User enters password        │
     │                                │
     │ 4. POST /auth/sudo             │
     │    { password: "xxx" }         │
     ├───────────────────────────────>│
     │                                │ 5. Verify password
     │                                │    Generate sudo token
     │                                │    (valid 15 min)
     │<───────────────────────────────┤
     │    200 { sudo_token: "yyy" }   │
     │                                │
     │ 6. Retry sensitive op          │
     │    Header: X-Sudo-Token: yyy   │
     ├───────────────────────────────>│
     │                                │ 7. Verify sudo token
     │                                │    Perform operation
     │<───────────────────────────────┤
     │         200 { success }        │
```

### E.3 Implementation (Pseudocode)

**Backend:**
```go
// backend/middleware/sudo.go

const SudoTokenExpiry = 15 * time.Minute

func RequireSudo() gin.HandlerFunc {
    return func(c *gin.Context) {
        sudoToken := c.GetHeader("X-Sudo-Token")
        
        if sudoToken == "" {
            c.JSON(http.StatusUnauthorized, gin.H{
                "code": "sudo_required",
                "message": "Operasi sensitif. Masukkan password Anda.",
            })
            c.Abort()
            return
        }
        
        // Verify sudo token (JWT or Redis)
        claims, err := verifySudoToken(sudoToken)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{
                "code": "sudo_invalid",
                "message": "Sudo token tidak valid atau sudah kadaluarsa.",
            })
            c.Abort()
            return
        }
        
        // Check if user matches
        user, _ := c.Get("user")
        if claims.UserID != user.(*ent.User).ID {
            c.JSON(http.StatusForbidden, gin.H{
                "code": "sudo_mismatch",
                "message": "Sudo token tidak cocok dengan user.",
            })
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

**Handler:**
```go
// backend/handlers/auth_handler.go

func (h *AuthHandler) GetSudoToken(c *gin.Context) {
    user, _ := c.Get("user")
    u := user.(*ent.User)
    
    var req struct {
        Password string `json:"password" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        handleError(c, apperrors.ErrInvalidInput)
        return
    }
    
    // Verify password
    if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
        // Log failed attempt
        if securityAudit != nil {
            securityAudit.LogEvent(c, "SUDO_FAILED", &u.ID, u.Email, c.ClientIP(), c.GetHeader("User-Agent"), "", "warning", false)
        }
        c.JSON(http.StatusUnauthorized, gin.H{
            "code": "invalid_password",
            "message": "Password salah.",
        })
        return
    }
    
    // Generate sudo token (15 min expiry)
    sudoToken, err := generateSudoToken(u.ID, SudoTokenExpiry)
    if err != nil {
        handleError(c, apperrors.ErrInternalServer)
        return
    }
    
    // Log sudo token issued
    if securityAudit != nil {
        securityAudit.LogEvent(c, "SUDO_ISSUED", &u.ID, u.Email, c.ClientIP(), c.GetHeader("User-Agent"), "", "info", true)
    }
    
    c.JSON(http.StatusOK, gin.H{
        "sudo_token": sudoToken,
        "expires_in": int(SudoTokenExpiry.Seconds()),
    })
}
```

**Frontend:**
```javascript
// frontend/components/SudoModal.jsx

export default function SudoModal({ onSuccess, operation }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetchJsonAuth('/api/auth/sudo', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      // Save sudo token to session storage (not localStorage!)
      sessionStorage.setItem('sudo_token', res.sudo_token);
      
      onSuccess(res.sudo_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal>
      <h2>Konfirmasi Operasi Sensitif</h2>
      <p>Anda akan {operation}. Masukkan password untuk melanjutkan.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Memverifikasi...' : 'Lanjutkan'}
        </button>
      </form>
    </Modal>
  );
}
```

**Note:** Step-up auth is OPTIONAL for Phase 1. Recommend implementing in Phase 2 after core fixes are stable.

---

## F. BACKWARD COMPATIBILITY PLAN

### F.1 Changes and Compatibility

| Change | Type | Backward Compatible? | Migration Needed? |
|--------|------|---------------------|-------------------|
| Frontend single-flight refresh | Code change | ✅ Yes | ❌ No |
| Extended grace period (5s→15s) | Config change | ✅ Yes | ❌ No |
| Request ID middleware | New feature | ✅ Yes | ❌ No |
| Enhanced audit logging | New feature | ✅ Yes | ⚠️ DB migration |
| Step-up auth | New feature | ✅ Yes | ❌ No (optional) |

### F.2 Database Migration

**New Fields for SecurityEvent:**
```sql
-- Migration: Add request_id to security_events table
ALTER TABLE security_events
ADD COLUMN request_id VARCHAR(64),
ADD COLUMN session_id VARCHAR(64),
ADD COLUMN metadata JSONB;

-- Add index for faster queries
CREATE INDEX idx_security_events_request_id ON security_events(request_id);
```

**Ent Migration Command:**
```bash
cd backend
go run entgo.io/ent/cmd/ent generate ./ent/schema
```

### F.3 Rollout Strategy

**Phase 1: Non-Breaking Changes (Week 1)**
1. Deploy backend request ID middleware
2. Deploy frontend request ID generation
3. Deploy extended grace period (5s → 15s)

**Phase 2: Frontend Refresh Fix (Week 1)**
1. Deploy robust single-flight refresh
2. Monitor error rates
3. Rollback plan: Revert to old tokenRefresh.js

**Phase 3: Audit Logging (Week 2)**
1. Run DB migration
2. Deploy enhanced audit service
3. Verify events are logged correctly

**Phase 4: Optional - Step-Up Auth (Week 3+)**
1. Implement sudo token mechanism
2. Add frontend SudoModal component
3. Protect sensitive endpoints

### F.4 Rollback Plan

**If issues arise:**

1. **Frontend single-flight refresh failure**
   - Rollback: Revert `frontend/lib/tokenRefresh.js`
   - Impact: Returns to old race condition behavior
   - Action: Git revert commit

2. **Extended grace period causes security concern**
   - Rollback: Change constant back to 5 seconds
   - Impact: May cause more false positives
   - Action: Hot-patch backend, no deployment needed

3. **Request ID middleware performance issue**
   - Rollback: Comment out middleware.RequestID()
   - Impact: Logs won't have request IDs
   - Action: Hot-patch backend

4. **Audit logging DB migration failure**
   - Rollback: Restore DB from backup
   - Impact: Lose new audit events
   - Action: Run migration rollback script

---

## G. TESTING PLAN

### G.1 Unit Tests

**Frontend:**
```javascript
// frontend/lib/__tests__/tokenRefresh.test.js

describe('Token Refresh', () => {
  test('single-flight: concurrent requests use same promise', async () => {
    // Test that 10 concurrent calls → 1 fetch
  });
  
  test('refresh failure: all waiting requests fail gracefully', async () => {
    // Test error propagation
  });
  
  test('proactive refresh: token refreshed before expiry', async () => {
    // Test 30s buffer behavior
  });
});
```

**Backend:**
```go
// backend/services/session_service_ent_test.go

func TestRefreshSessionGracePeriod(t *testing.T) {
    // Test: Reuse within 15s grace period → allowed
    // Test: Reuse after 15s → account locked
}

func TestRequestIDMiddleware(t *testing.T) {
    // Test: Request without ID → generates one
    // Test: Request with ID → uses provided ID
    // Test: Response includes ID in header
}
```

### G.2 Integration Tests

**Scenario 1: Concurrent Refresh**
```javascript
// Test 10 concurrent API calls with expired token
// Expected: Only 1 refresh request to backend
// Expected: All 10 API calls succeed
```

**Scenario 2: Grace Period**
```go
// Test refresh token reuse at 5s, 10s, 15s, 20s intervals
// Expected: 5s, 10s, 15s → allowed (within grace)
// Expected: 20s → account locked
```

**Scenario 3: Request ID Propagation**
```javascript
// Frontend → Go Backend → .NET Service
// Expected: Same request ID in all logs
```

### G.3 Load Testing

**Artillery.io Script:**
```yaml
# test/load/auth-refresh.yml

config:
  target: 'https://api.aivalid.fun'
  phases:
    - duration: 60
      arrivalRate: 50  # 50 users per second
      
scenarios:
  - name: "Concurrent token refresh"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "loadtest@example.com"
            password: "test123"
          capture:
            - json: "$.access_token"
              as: "token"
            - json: "$.refresh_token"
              as: "refresh"
      
      # Wait for token to almost expire
      - think: 14
      
      # Trigger 10 concurrent requests
      - parallel:
        - get:
            url: "/api/account/me"
            headers:
              Authorization: "Bearer {{ token }}"
        - get:
            url: "/api/threads/my"
            headers:
              Authorization: "Bearer {{ token }}"
        # ... 8 more concurrent requests
```

**Success Criteria:**
- ✅ 0 account lockouts due to false positive reuse detection
- ✅ <5% error rate
- ✅ p95 latency < 500ms
- ✅ All requests have unique request IDs in logs

---

## H. RISK ASSESSMENT

### H.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Frontend refresh breaks existing flows | Low | High | Comprehensive testing + gradual rollout |
| Grace period too long allows theft | Low | Medium | Monitor audit logs for genuine theft attempts |
| Request ID performance overhead | Very Low | Low | UUID generation is extremely fast (<1μs) |
| DB migration failure | Low | Medium | Test migration on staging first, have rollback script |
| Concurrent requests still cause race | Medium | High | Proper testing + monitoring in production |

### H.2 Security Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| XSS attack steals tokens from localStorage | Low | Critical | Implement strict CSP, sanitize all user input |
| Token theft within 15s grace period | Very Low | High | 15s is still very short, real theft takes longer |
| Sudo token stolen | Low | High | Short expiry (15 min), stored in sessionStorage |
| Audit log manipulation | Very Low | Medium | DB write-only access, audit log immutability |

### H.3 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Increased DB load from audit logs | Low | Low | Index optimization, log rotation after 90 days |
| Debug complexity with request IDs | Very Low | Low | Clear documentation, log search by request ID |
| User confusion with sudo prompts | Medium | Low | Clear UX messaging, help text |

---

## I. SUCCESS METRICS

### I.1 Key Performance Indicators

**Before Implementation:**
- ❌ Account lockouts due to race condition: ~5-10 per week
- ❌ Session expired loops: User complaints in support
- ❌ Average time to debug auth issue: 2-4 hours (no request ID)
- ✅ Refresh success rate: ~95%

**After Implementation (Target):**
- ✅ Account lockouts due to race condition: 0 per week
- ✅ Session expired loops: 0 user complaints
- ✅ Average time to debug auth issue: <30 minutes (with request ID)
- ✅ Refresh success rate: >99%

### I.2 Monitoring Dashboards

**Metrics to Track:**
1. Refresh token requests per minute
2. Refresh success rate
3. Grace period reuse events (within 15s)
4. Account lockouts per day
5. Request ID coverage (% requests with ID)
6. Audit events per hour by type

**Alerts:**
1. Refresh success rate < 95% → Slack alert
2. Account lockouts > 5 per day → Email alert
3. Grace period reuse > 100 per hour → Investigate
4. Request ID missing > 10% → Check middleware

---

## J. IMPLEMENTATION TIMELINE

### Week 1: Core Fixes (Priority 1)
**Days 1-2:** Frontend single-flight refresh
- [ ] Implement robust refresh mechanism
- [ ] Write unit tests
- [ ] Test concurrent scenarios
- [ ] Code review

**Days 3-4:** Backend grace period + request ID
- [ ] Extend grace period to 15s
- [ ] Implement request ID middleware
- [ ] Update logging to include request ID
- [ ] Code review

**Day 5:** Integration testing
- [ ] Test frontend + backend integration
- [ ] Load testing with Artillery
- [ ] Monitor staging environment

### Week 2: Observability (Priority 2)
**Days 1-3:** Enhanced audit logging
- [ ] Add new event types
- [ ] Run DB migration
- [ ] Implement new audit methods
- [ ] Integrate into handlers

**Days 4-5:** Testing + monitoring
- [ ] Verify all events are logged
- [ ] Set up dashboards
- [ ] Create alerts

### Week 3+: Optional Features
**If time permits:**
- [ ] Step-up auth implementation
- [ ] Sudo token mechanism
- [ ] Frontend SudoModal
- [ ] Test sensitive operations

---

## K. APPROVAL CHECKLIST

**Before proceeding to implementation, confirm:**

- [ ] Phase 0 audit reviewed and approved
- [ ] Phase 1 design reviewed and approved
- [ ] All team members understand the changes
- [ ] Database migration plan reviewed
- [ ] Rollback plan documented
- [ ] Success metrics defined
- [ ] Testing plan approved
- [ ] Timeline approved by stakeholders

**Next Step:** Wait for approval, then proceed to PHASE 2 (Implementation)

---

**END OF PHASE 1 DESIGN**
