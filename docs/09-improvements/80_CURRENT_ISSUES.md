# ⚠️ Current Issues

> Daftar masalah yang diketahui dan solusi sementara.

---

## 🔴 Critical Issues

### 1. ORM Migration Incomplete

**Masalah**: Sistem masih menggunakan dua ORM (GORM dan Ent) secara bersamaan.

**Dampak**:
- Kompleksitas kode meningkat
- Risiko inkonsistensi data
- Maintenance lebih sulit

**Status**: In Progress

**Workaround**: 
- Environment variable `USE_ENT_ORM=true` untuk ThreadService
- Service lain masih GORM

**Timeline**: Q1 2026

---

### 2. No Centralized Caching

**Masalah**: Tidak ada Redis atau caching layer.

**Dampak**:
- Database load tinggi
- Response time bisa lambat
- Rate limiting hanya in-memory (hilang saat restart)

**Status**: Planned

**Workaround**: 
- Database indexes sudah dioptimasi
- Rate limiter stateless per instance

**Recommendation**: Tambah Redis untuk:
- Session caching
- Rate limiting
- Frequently accessed data

---

## 🟡 Medium Issues

### 3. ✅ Token Refresh Race Condition (RESOLVED)

**Masalah**: Jika multiple requests refresh token bersamaan, bisa terjadi race condition.

**Dampak**:
- User bisa ter-logout tiba-tiba
- Inconsistent session state

**Status**: ✅ RESOLVED (2026-01-09)

**Solution Implemented**:
- Wrapped `RefreshSession()` dalam database transaction
- Atomic update dengan conditional check (`is_used = false`)
- Race condition detection: concurrent requests get "Token sudah digunakan" error
- Multi-tab scenario handled with grace period

**Files Changed**:
- `backend/services/session_service_ent.go`

---

### 4. File Upload Size Limit

**Masalah**: Avatar upload limited to 5MB, tidak ada progress indicator.

**Dampak**:
- User experience kurang baik
- Large files fail tanpa feedback jelas

**Status**: Low Priority

**Workaround**: Frontend validation sebelum upload.

---

### 5. ✅ No Email Queue (RESOLVED)

**Masalah**: Email dikirim synchronously via Resend API.

**Dampak**:
- Jika Resend down, registration bisa fail
- Slow response time untuk register/forgot-password

**Status**: ✅ RESOLVED (2026-01-09)

**Solution Implemented**:
- Created `backend/utils/email_queue.go` with:
  - In-memory buffered channel queue (1000 capacity)
  - Configurable worker pool (default: 3 workers)
  - Automatic retry with exponential backoff (max 3 retries)
  - Graceful shutdown support
- Registration and password reset now use async `QueueVerificationEmail()` / `QueuePasswordResetEmail()`
- API response is immediate, email sent in background

**Files Changed**:
- `backend/utils/email_queue.go` (new)
- `backend/services/auth_service_ent.go`
- `backend/main.go`

**Future Enhancement**: Consider Redis-based Asynq for persistent queue across restarts

---

## 🟢 Minor Issues

### 6. Logging Inconsistency

**Masalah**: Mix antara Zap logger dan fmt.Println di beberapa tempat.

**Dampak**:
- Log format tidak konsisten
- Sulit untuk parsing di log aggregator

**Status**: Low Priority

**Fix**: Audit dan replace semua fmt.Println dengan logger calls.

---

### 7. Test Coverage Low

**Masalah**: Unit test coverage masih rendah.

**Current Coverage**:
- Backend Gin: ~30%
- Feature Service: ~45%
- Frontend: ~10%

**Status**: Ongoing

**Target**: 
- Backend: 70%
- Feature Service: 80%
- Frontend: 50%

---

### 8. No API Versioning Strategy

**Masalah**: Feature Service menggunakan `/api/v1/` tapi Backend Gin hanya `/api/`.

**Dampak**:
- Breaking changes sulit di-handle
- Client harus update bersamaan dengan server

**Recommendation**:
- Standardize ke `/api/v1/` untuk semua endpoints
- Plan migration path untuk v2

---

## 📋 Technical Debt

| Item | Priority | Effort | Owner |
|------|----------|--------|-------|
| Complete Ent migration | High | Large | Backend |
| Add Redis caching | High | Medium | Backend |
| Implement job queue | Medium | Medium | Backend |
| Increase test coverage | Medium | Large | All |
| API versioning | Low | Small | All |
| Logging cleanup | Low | Small | Backend |

---

## 🔧 Quick Fixes Available

### Fix 1: Enable Ent for All Services

```bash
# backend/.env
USE_ENT_ORM=true
```

### Fix 2: Increase Rate Limits (if needed)

```go
// main.go
var loginLimiter = middleware.NewRateLimiter(20, time.Minute) // was 10
```

### Fix 3: Extend Token Expiry

```bash
# .env
JWT_ACCESS_EXPIRY=30m   # was 15m
JWT_REFRESH_EXPIRY=336h # was 168h (now 14 days)
```

---

## ▶️ Selanjutnya

- [81_RECOMMENDED_IMPROVEMENTS.md](./81_RECOMMENDED_IMPROVEMENTS.md) - Recommended improvements
- [82_ENTERPRISE_RECOMMENDATIONS.md](./82_ENTERPRISE_RECOMMENDATIONS.md) - Enterprise-level recommendations
