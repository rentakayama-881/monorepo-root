# 💡 Recommended Improvements

> Rekomendasi peningkatan berdasarkan best practices industri.

---

## 🏗️ Architecture Improvements

### 1. Add Caching Layer (Redis)

**Current State**: No caching, semua request ke database.

**Recommendation**:

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│   Client   │───▶│   Server   │───▶│   Redis    │
└────────────┘    └────────────┘    └─────┬──────┘
                                          │ miss
                                          ▼
                                   ┌────────────┐
                                   │  Database  │
                                   └────────────┘
```

**What to cache**:
- User sessions (reduce DB lookups)
- Thread lists (cache 5 menit)
- Category lists (cache 1 jam)
- Token balances (cache 1 menit)

**Implementation** (Go):
```go
import "github.com/redis/go-redis/v9"

var rdb = redis.NewClient(&redis.Options{
    Addr: "localhost:6379",
})

func GetCachedUser(id uint) (*User, error) {
    key := fmt.Sprintf("user:%d", id)
    
    // Try cache first
    cached, err := rdb.Get(ctx, key).Result()
    if err == nil {
        var user User
        json.Unmarshal([]byte(cached), &user)
        return &user, nil
    }
    
    // Cache miss - get from DB
    user, err := db.GetUser(id)
    if err != nil {
        return nil, err
    }
    
    // Store in cache
    data, _ := json.Marshal(user)
    rdb.Set(ctx, key, data, 5*time.Minute)
    
    return user, nil
}
```

**Priority**: High  
**Effort**: Medium  
**Provider**: Upstash Redis (free tier) atau Redis di VPS

---

### 2. Add Message Queue

**Current State**: Email dan notifikasi dikirim synchronously.

**Recommendation**: Gunakan job queue untuk background tasks.

**Options**:
- **Asynq** (Go) - Redis-based, simple
- **Temporal** - Complex workflows
- **BullMQ** (Node.js) - Jika ada service Node

**Use Cases**:
- Email sending (retry on failure)
- AI processing (async responses)
- Report processing
- Analytics aggregation

**Implementation** (Asynq):
```go
import "github.com/hibiken/asynq"

// Define task
const TypeEmailDelivery = "email:deliver"

type EmailPayload struct {
    To      string
    Subject string
    Body    string
}

// Enqueue task
func EnqueueEmail(to, subject, body string) error {
    payload, _ := json.Marshal(EmailPayload{to, subject, body})
    task := asynq.NewTask(TypeEmailDelivery, payload)
    _, err := client.Enqueue(task, asynq.MaxRetry(3))
    return err
}

// Process task
func HandleEmailDelivery(ctx context.Context, t *asynq.Task) error {
    var p EmailPayload
    json.Unmarshal(t.Payload(), &p)
    return sendEmail(p.To, p.Subject, p.Body)
}
```

**Priority**: Medium  
**Effort**: Medium

---

### 3. Implement Event-Driven Architecture

**Current State**: Services communicate via REST only.

**Recommendation**: Add event bus untuk loose coupling.

**Events**:
```
user.registered → Send welcome email
thread.created → Index for search
reply.created → Notify thread author
token.purchased → Update wallet balance
```

**Simple Implementation** (Redis Pub/Sub):
```go
// Publisher
func PublishEvent(event string, data interface{}) {
    payload, _ := json.Marshal(data)
    rdb.Publish(ctx, event, payload)
}

// Subscriber
func SubscribeToEvents() {
    pubsub := rdb.Subscribe(ctx, "user.registered", "thread.created")
    
    for msg := range pubsub.Channel() {
        switch msg.Channel {
        case "user.registered":
            handleUserRegistered(msg.Payload)
        case "thread.created":
            handleThreadCreated(msg.Payload)
        }
    }
}
```

**Priority**: Low (nice to have)  
**Effort**: Large

---

## 🔒 Security Improvements

### 4. Add Rate Limiting per User

**Current State**: Rate limiting per IP only.

**Problem**: 
- NAT/proxy = multiple users share IP
- Logged-in users should have higher limits

**Recommendation**:
```go
func RateLimit() gin.HandlerFunc {
    return func(c *gin.Context) {
        var key string
        
        // Logged-in user = limit per user
        if userID := c.GetUint("userID"); userID > 0 {
            key = fmt.Sprintf("rate:user:%d", userID)
            limit = 100 // per minute
        } else {
            // Guest = limit per IP
            key = fmt.Sprintf("rate:ip:%s", c.ClientIP())
            limit = 30 // per minute
        }
        
        // Check and increment
        current := rdb.Incr(ctx, key).Val()
        if current == 1 {
            rdb.Expire(ctx, key, time.Minute)
        }
        
        if current > limit {
            c.AbortWithStatusJSON(429, gin.H{"error": "Too many requests"})
            return
        }
        
        c.Next()
    }
}
```

**Priority**: High  
**Effort**: Small

---

### 5. Add Security Headers

**Current State**: Basic security headers.

**Recommendation**: Full security headers:

```go
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Prevent clickjacking
        c.Header("X-Frame-Options", "DENY")
        
        // Prevent MIME sniffing
        c.Header("X-Content-Type-Options", "nosniff")
        
        // XSS protection
        c.Header("X-XSS-Protection", "1; mode=block")
        
        // Referrer policy
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
        
        // Permissions policy
        c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        
        // Content Security Policy
        c.Header("Content-Security-Policy", 
            "default-src 'self'; "+
            "script-src 'self' 'unsafe-inline'; "+
            "style-src 'self' 'unsafe-inline'; "+
            "img-src 'self' data: https:; "+
            "connect-src 'self' https://api.alephdraad.fun https://feature.alephdraad.fun")
        
        // HSTS (only for HTTPS)
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        
        c.Next()
    }
}
```

**Priority**: High  
**Effort**: Small

---

## 📊 Monitoring Improvements

### 6. Add Structured Logging

**Recommendation**: Consistent log format untuk semua services.

```go
// Good
logger.Info("User logged in",
    zap.Uint("user_id", userID),
    zap.String("ip", clientIP),
    zap.Duration("latency", latency),
)

// Bad
fmt.Printf("User %d logged in from %s\n", userID, clientIP)
```

**Log Aggregation**: 
- Logtail (free tier)
- Grafana Loki
- Better Stack

---

### 7. Add Health Check Endpoints

**Current**: Basic `/health` endpoint.

**Recommendation**: Detailed health checks:

```go
type HealthStatus struct {
    Status    string            `json:"status"`
    Version   string            `json:"version"`
    Uptime    string            `json:"uptime"`
    Checks    map[string]string `json:"checks"`
}

func DetailedHealthCheck(c *gin.Context) {
    checks := make(map[string]string)
    
    // Check database
    if err := db.Ping(); err != nil {
        checks["database"] = "unhealthy: " + err.Error()
    } else {
        checks["database"] = "healthy"
    }
    
    // Check Redis
    if err := rdb.Ping(ctx).Err(); err != nil {
        checks["redis"] = "unhealthy: " + err.Error()
    } else {
        checks["redis"] = "healthy"
    }
    
    // Overall status
    status := "healthy"
    for _, v := range checks {
        if strings.HasPrefix(v, "unhealthy") {
            status = "degraded"
            break
        }
    }
    
    c.JSON(200, HealthStatus{
        Status:  status,
        Version: "1.0.0",
        Uptime:  time.Since(startTime).String(),
        Checks:  checks,
    })
}
```

**Priority**: Medium  
**Effort**: Small

---

## 🧪 Testing Improvements

### 8. Add Integration Tests

**Current**: Limited unit tests only.

**Recommendation**: Add integration test suite.

```go
// tests/integration/auth_test.go
func TestRegistrationFlow(t *testing.T) {
    // Setup test server
    router := setupTestRouter()
    
    // Test register
    w := httptest.NewRecorder()
    body := `{"email":"test@example.com","password":"Test123!","username":"testuser"}`
    req, _ := http.NewRequest("POST", "/api/auth/register", strings.NewReader(body))
    router.ServeHTTP(w, req)
    
    assert.Equal(t, 201, w.Code)
    
    // Verify user exists in database
    var user models.User
    err := testDB.Where("email = ?", "test@example.com").First(&user).Error
    assert.NoError(t, err)
    assert.Equal(t, "testuser", user.Username)
}
```

**Priority**: Medium  
**Effort**: Large

---

## ▶️ Selanjutnya

- [82_ENTERPRISE_RECOMMENDATIONS.md](./82_ENTERPRISE_RECOMMENDATIONS.md) - Enterprise recommendations
- [../10-roadmap/90_FUTURE_FEATURES.md](../10-roadmap/90_FUTURE_FEATURES.md) - Future features
