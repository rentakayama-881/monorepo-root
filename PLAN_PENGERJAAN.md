# 🎯 PLAN PENGERJAAN ALEPHDRAAD
**Target**: Website Production-Ready 100%  
**Timeline**: Flexible (No deadline)  
**Quality Standard**: Harvard University Review Level

---

## 📊 PRIORITAS BERDASARKAN ANALISIS FAKTUAL

Berdasarkan analisis mendalam terhadap kondisi aktual repository, berikut adalah prioritas yang akurat dan presisi:

---

## 🔴 PRIORITAS 1: BUG KRITIS (MUST FIX)

### 1.1 TOTP Backup Code Login Tidak Berfungsi
**Masalah**: User tidak bisa login dengan backup code saat kehilangan akses TOTP  
**Impact**: **HIGH** - User bisa terkunci dari akun mereka  
**Lokasi**: `backend/services/service_wrappers.go:85`  
**Estimasi**: 2-3 jam

**Action Items**:
- [ ] Implement `CompleteTOTPLoginWithBackupCode` di `EntAuthService`
- [ ] Test flow: Generate backup codes → Enable TOTP → Login dengan backup code
- [ ] Verify backup code dimark sebagai used
- [ ] Add integration test

**Success Criteria**:
- User bisa login dengan backup code
- Backup code hanya bisa digunakan sekali
- Session dibuat setelah successful backup code login

---

### 1.2 Badge System Menggunakan Entity Salah
**Masalah**: `badge_detail.go` dan `badges.go` return Credentials bukan Badges  
**Impact**: **MEDIUM** - Data model inconsistent  
**Lokasi**: `backend/handlers/badge_detail.go`, `backend/handlers/badges.go`  
**Estimasi**: 1-2 jam

**Action Items**:
- [ ] Refactor `GetUserBadgesHandler` gunakan `UserBadge` entity
- [ ] Refactor `GetBadgeDetailHandler` gunakan `Badge` entity
- [ ] Update frontend jika ada breaking changes
- [ ] Add migration notes jika database perlu diupdate

**Success Criteria**:
- Badge endpoints return data dari `badges` dan `user_badges` table
- Credential entity tidak digunakan untuk badge logic
- Frontend tetap berfungsi tanpa error

---

## 🟡 PRIORITAS 2: MISSING CRITICAL FEATURES

### 2.1 Implement Tag System untuk Threads
**Masalah**: Schema exists, relationship defined, tapi tidak ada endpoint  
**Impact**: **MEDIUM** - Fitur tagging berguna untuk kategorisasi  
**Estimasi**: 4-6 jam

**Action Items**:
- [ ] **Backend**: Create tag endpoints
  - `GET /api/tags` - List all active tags
  - `POST /api/threads/:id/tags` - Add tags to thread (Auth)
  - `DELETE /api/threads/:id/tags/:slug` - Remove tag (Auth)
  - `GET /api/tags/:slug/threads` - Get threads by tag
- [ ] **Backend**: Tag service dengan Ent ORM
- [ ] **Frontend**: Tag selector component di create/edit thread
- [ ] **Frontend**: Tag filter di threads page
- [ ] **Frontend**: Tag page (list threads dengan tag tertentu)
- [ ] Add tag icons/colors support

**Success Criteria**:
- User bisa add/remove tags saat create/edit thread
- Thread list bisa difilter by tag
- Tag page shows threads dengan tag spesifik
- Admin bisa manage tags (create/update/delete)

---

### 2.2 Implement Wallet Transfers (Phase 2)
**Masalah**: Feature Service punya entity tapi semua endpoint return 501  
**Impact**: **HIGH** - Fitur escrow transfer sangat critical untuk marketplace  
**Estimasi**: 12-16 jam

**Action Items**:
- [ ] **Feature Service**: Implement `TransfersController`
  - `POST /api/v1/wallets/transfers` - Create transfer
  - `GET /api/v1/wallets/transfers` - List user transfers
  - `GET /api/v1/wallets/transfers/:id` - Get transfer detail
  - `POST /api/v1/wallets/transfers/:id/release` - Release funds
  - `POST /api/v1/wallets/transfers/:id/cancel` - Cancel transfer
- [ ] **Feature Service**: Implement `TransferService`
  - Escrow logic: Deduct sender → Hold → Release to receiver
  - Fee calculation (2% dari amount)
  - Status transitions: pending → held → released/cancelled
- [ ] **Feature Service**: Integration test untuk transfer flow
- [ ] **Frontend**: Update wallet pages (sudah ada UI, tinggal connect)
- [ ] **Documentation**: API docs untuk transfer endpoints

**Success Criteria**:
- User bisa create transfer dengan escrow
- Funds di-hold sampai receiver release
- Sender bisa cancel jika belum released
- Fee dihitung dan dicatat correctly
- Transaction history menampilkan transfers

---

### 2.3 Implement Dispute System (Phase 2)
**Masalah**: Frontend punya UI lengkap tapi backend return 501  
**Impact**: **HIGH** - Needed untuk resolve transfer disputes  
**Estimasi**: 10-14 jam

**Action Items**:
- [ ] **Feature Service**: Implement `DisputesController`
  - `POST /api/v1/disputes` - Create dispute
  - `GET /api/v1/disputes/:id` - Get dispute detail
  - `GET /api/v1/disputes` - List user disputes
  - `POST /api/v1/disputes/:id/messages` - Send message
  - `POST /api/v1/disputes/:id/evidence` - Upload evidence
  - `POST /api/v1/disputes/:id/mutual-release` - Mutual agreement release
  - `POST /api/v1/disputes/:id/mutual-refund` - Mutual agreement refund
- [ ] **Feature Service**: Implement `DisputeService`
  - Link to transfer
  - Chat system untuk buyer-seller communication
  - Evidence upload support
  - Admin resolution (assign to admin, admin decide)
- [ ] **Frontend**: Connect existing dispute UI ke actual API
- [ ] **Admin**: Add dispute resolution panel

**Success Criteria**:
- User bisa create dispute untuk transfer
- Chat antara buyer-seller berfungsi
- Evidence bisa diupload (images/documents)
- Mutual agreement works
- Admin bisa resolve disputes

---

### 2.4 Implement Withdrawal System (Phase 2)
**Masalah**: Frontend punya UI tapi backend return 501  
**Impact**: **MEDIUM** - Users perlu withdraw funds  
**Estimasi**: 8-10 jam

**Action Items**:
- [ ] **Feature Service**: Implement `WithdrawalsController`
  - `POST /api/v1/wallets/withdrawals` - Create withdrawal request
  - `GET /api/v1/wallets/withdrawals` - List user withdrawals
  - `GET /api/v1/wallets/withdrawals/:id` - Get withdrawal detail
- [ ] **Feature Service**: Implement `WithdrawalService`
  - Bank account validation
  - Withdrawal limits (min Rp 50,000)
  - Fee calculation (Rp 7,500 flat)
  - Status: pending → processing → completed/failed
- [ ] **Admin**: Withdrawal approval panel
- [ ] **Integration**: Payment gateway untuk actual bank transfer
- [ ] **Frontend**: Connect UI ke actual API

**Success Criteria**:
- User bisa request withdrawal
- Bank account info saved securely
- Fee dihitung correctly
- Admin bisa approve/reject
- Status updates visible di frontend

---

## 🟢 PRIORITAS 3: MISSING NICE-TO-HAVE FEATURES

### 3.1 AI Chat Sessions UI
**Masalah**: Feature Service punya full API tapi frontend tidak ada UI  
**Impact**: **MEDIUM** - AI chat adalah fitur unik platform  
**Estimasi**: 8-12 jam

**Action Items**:
- [ ] **Frontend**: Create `/ai-chat` page
  - Session list sidebar
  - Chat interface dengan message history
  - Model selector (HuggingFace vs Paid LLM)
  - Token balance display
  - New session button
- [ ] **Frontend**: Token purchase modal
  - Package selection
  - Payment integration (via wallet deduction)
  - Success/failure handling
- [ ] **Frontend**: Session management
  - Archive session
  - Delete session
  - Rename session
- [ ] **Frontend**: Usage history page

**Success Criteria**:
- User bisa create chat session
- Send/receive messages dari AI
- Switch antara sessions
- Purchase tokens via wallet
- View token usage history

---

### 3.2 Document Management UI
**Masalah**: Feature Service punya API tapi tidak ada UI  
**Impact**: **LOW** - Document storage useful tapi not critical  
**Estimasi**: 6-8 jam

**Action Items**:
- [ ] **Frontend**: Create `/account/documents` page
  - Upload form (PDF, DOCX)
  - Document list dengan preview
  - Category filter (whitepaper, article, research, other)
  - Public/private toggle
  - Download tracking
- [ ] **Frontend**: Document viewer/preview
- [ ] **Frontend**: Document search
- [ ] **Feature Service**: Migrate storage dari MongoDB ke GridFS atau Supabase

**Success Criteria**:
- User bisa upload documents
- Documents listed dengan metadata
- Public documents bisa diakses others
- Download count tracked

---

### 3.3 Wallet Dashboard Landing Page
**Masalah**: `/account/wallet` hanya punya loading.jsx  
**Impact**: **LOW** - Nice to have central dashboard  
**Estimasi**: 4-6 jam

**Action Items**:
- [ ] **Frontend**: Create `/account/wallet/page.jsx`
  - Balance card dengan visual
  - Quick actions (deposit, send, withdraw)
  - Recent transactions summary
  - Charts (spending, income)
  - Quick stats (pending, disputes)
- [ ] **Frontend**: Wallet analytics
  - Monthly spending breakdown
  - Transaction categories
  - Export to CSV

**Success Criteria**:
- Wallet overview visible saat buka `/account/wallet`
- Quick access ke semua wallet features
- Visual representations of balance/transactions

---

## 🔵 PRIORITAS 4: QUALITY & INFRASTRUCTURE

### 4.1 Improve Test Coverage
**Masalah**: Backend 30%, Frontend 10%, Feature Service 45%  
**Impact**: **HIGH** - Essential untuk production quality  
**Estimasi**: 20-30 jam (ongoing)

**Target Coverage**:
- Backend: 70%
- Feature Service: 80%
- Frontend: 50%

**Action Items**:

#### Backend Tests
- [ ] Unit tests untuk semua services
  - Auth service (registration, login, 2FA)
  - Session service (token rotation, reuse detection)
  - TOTP service (setup, verify, backup codes)
  - Passkey service (registration, login)
  - Thread service (CRUD operations)
- [ ] Integration tests untuk API endpoints
  - Auth flow end-to-end
  - Thread CRUD flow
  - Admin operations
- [ ] Edge cases
  - Token expiry
  - Concurrent requests
  - Rate limiting

#### Feature Service Tests
- [ ] Unit tests untuk semua services
  - Wallet service (deposit, withdraw, PIN)
  - Transfer service (escrow flow)
  - Chat service (sessions, messages, tokens)
  - Reply/Reaction services
- [ ] Integration tests
  - Wallet flow end-to-end
  - Transfer + dispute flow
  - AI chat flow
- [ ] MongoDB mock tests

#### Frontend Tests
- [ ] Component tests (React Testing Library)
  - Authentication components
  - Wallet components
  - Thread components
- [ ] Integration tests (Playwright/Cypress)
  - Login flow
  - Thread creation flow
  - Wallet transaction flow
- [ ] E2E critical paths

**Success Criteria**:
- All critical paths covered
- CI/CD runs tests automatically
- No regressions when deploying

---

### 4.2 Error Tracking Integration (Sentry)
**Masalah**: Tidak ada error tracking di production  
**Impact**: **MEDIUM** - Sulit debug production issues  
**Estimasi**: 3-4 jam

**Action Items**:
- [ ] **Backend**: Sentry Go SDK integration
- [ ] **Frontend**: Sentry Next.js integration
- [ ] **Feature Service**: Sentry ASP.NET integration
- [ ] Configure error sampling
- [ ] Set up alerts untuk critical errors
- [ ] Add release tracking

**Success Criteria**:
- Errors automatically logged ke Sentry
- Alerts untuk high-severity errors
- Breadcrumbs for debugging context

---

### 4.3 Redis untuk Distributed Rate Limiting
**Masalah**: Saat ini menggunakan in-memory rate limiting  
**Impact**: **MEDIUM** - Not scalable untuk multiple instances  
**Estimasi**: 4-5 jam

**Action Items**:
- [ ] **Backend**: Implement Redis-based rate limiter
- [ ] Replace in-memory limiters dengan Redis
- [ ] Add Redis health check
- [ ] Configure Redis cluster untuk HA
- [ ] Add metrics untuk rate limit hits

**Success Criteria**:
- Rate limiting works across multiple backend instances
- No memory leaks dari in-memory limiter
- Graceful fallback jika Redis down

---

### 4.4 Database Migrations & Versioning
**Masalah**: Ent migrations tidak tracked properly  
**Impact**: **MEDIUM** - Risky untuk production deploys  
**Estimasi**: 6-8 jam

**Action Items**:
- [ ] **Backend**: Setup proper migration workflow
  - Version migrations dengan timestamps
  - Rollback strategy
  - Seed data untuk development
- [ ] **Feature Service**: MongoDB schema versioning
- [ ] **Documentation**: Migration runbook
- [ ] **CI/CD**: Automated migration checks

**Success Criteria**:
- Migrations tracked di version control
- Rollback possible untuk all migrations
- Zero-downtime deployment strategy

---

## 🟣 PRIORITAS 5: OPTIMIZATION & POLISH

### 5.1 Thread Chunks Integration dengan Ent
**Masalah**: RAG menggunakan raw SQL bukan Ent ORM  
**Impact**: **LOW** - Works but not idiomatic  
**Estimasi**: 6-8 jam

**Action Items**:
- [ ] Create `ThreadChunk` Ent schema
- [ ] Define relationship dengan Thread
- [ ] Migrate RAG handlers ke Ent queries
- [ ] Add pgvector support ke Ent (custom predicates)
- [ ] Test vector search performance

---

### 5.2 Payment Gateway Integration
**Masalah**: Deposit/withdrawal tidak terintegrasi dengan payment gateway  
**Impact**: **HIGH untuk production** - Cannot process real money  
**Estimasi**: 12-16 jam

**Options**:
- Midtrans (Indonesia)
- Xendit (Indonesia)
- Stripe (International)

**Action Items**:
- [ ] Choose payment gateway
- [ ] **Backend**: Implement deposit webhook
  - Verify payment signature
  - Update wallet balance
  - Send email confirmation
- [ ] **Backend**: Implement withdrawal API
  - Disburse to bank account
  - Handle callbacks
- [ ] **Frontend**: Redirect ke payment page
- [ ] **Frontend**: Payment success/failure handling
- [ ] Add transaction reconciliation
- [ ] Add payment logs

---

### 5.3 Real-time Notifications (WebSocket)
**Masalah**: Tidak ada real-time updates  
**Impact**: **MEDIUM** - UX improvement  
**Estimasi**: 10-14 jam

**Action Items**:
- [ ] **Backend**: Setup WebSocket server (ws library)
- [ ] **Backend**: Authentication for WS connections
- [ ] **Backend**: Event emitters
  - New reply on thread
  - New reaction
  - Transfer status update
  - Dispute message
  - Admin actions
- [ ] **Frontend**: WebSocket client
- [ ] **Frontend**: Toast notifications
- [ ] **Frontend**: Notification center
- [ ] Add notification preferences

---

### 5.4 Performance Optimization
**Estimasi**: 8-12 jam (ongoing)

**Action Items**:
- [ ] **Backend**: Add database indexes
  - User email, username
  - Thread category_id, user_id
  - Session user_id, expires_at
- [ ] **Backend**: Query optimization
  - N+1 query prevention (use `.WithXXX()` in Ent)
  - Pagination for large datasets
- [ ] **Frontend**: Image optimization
  - Next.js Image component
  - Lazy loading
  - WebP format
- [ ] **Frontend**: Code splitting
  - Dynamic imports untuk large components
  - Route-based splitting
- [ ] **Feature Service**: MongoDB indexes
  - Compound indexes for common queries
  - TTL indexes untuk expired data
- [ ] Add caching layer (Redis)
  - Cache frequently accessed data
  - Cache invalidation strategy

---

## 📋 CHECKLIST UNTUK PRODUCTION-READY 100%

### Backend (Go)
- [x] All services use Ent ORM
- [ ] TOTP backup code login works
- [ ] Badge handlers use correct entity
- [ ] Tag system implemented
- [ ] Test coverage 70%+
- [ ] Sentry integration
- [ ] Redis rate limiting
- [ ] Database migrations tracked
- [ ] All TODO comments resolved

### Feature Service (ASP.NET)
- [x] Wallet core implemented
- [x] AI Chat implemented
- [x] Replies & Reactions implemented
- [ ] Transfers implemented
- [ ] Disputes implemented
- [ ] Withdrawals implemented
- [ ] Document storage migrated ke GridFS/Supabase
- [ ] Test coverage 80%+
- [ ] Sentry integration
- [ ] Health check includes MongoDB

### Frontend (Next.js)
- [x] All auth pages complete
- [x] Wallet UI complete
- [x] Admin panel complete
- [ ] AI Chat UI
- [ ] Documents UI
- [ ] Wallet dashboard
- [ ] Username change enabled
- [ ] Token purchase UI
- [ ] Test coverage 50%+
- [ ] Sentry integration
- [ ] Error tracking
- [ ] Sitemap dynamic

### Infrastructure
- [ ] Payment gateway integrated
- [ ] WebSocket for real-time notifications
- [ ] Redis cluster deployed
- [ ] Database indexes optimized
- [ ] CDN for static assets
- [ ] SSL certificates
- [ ] Backup strategy
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Logging aggregation (ELK)

### Security
- [x] JWT token rotation
- [x] TOTP 2FA
- [x] WebAuthn/Passkeys
- [x] Sudo mode
- [x] Brute force protection
- [x] Device tracking
- [x] Security audit log
- [ ] Security audit by external firm
- [ ] Penetration testing
- [ ] OWASP Top 10 compliance check
- [ ] Data encryption at rest
- [ ] PII data anonymization

### Documentation
- [x] API documentation (current analysis)
- [ ] Deployment runbook
- [ ] Database migration guide
- [ ] Troubleshooting guide
- [ ] User documentation
- [ ] Admin documentation
- [ ] Developer onboarding guide

---

## 🎯 REKOMENDASI URUTAN PENGERJAAN

Berdasarkan impact dan dependencies, ini adalah urutan yang optimal:

### Phase 1: Critical Bugs (2-4 hari)
1. ✅ Fix compile error di account.go (DONE)
2. Fix TOTP backup code login
3. Fix badge handlers entity
4. Verify all critical paths work

### Phase 2: Core Features Missing (1-2 minggu)
1. Implement Tag system
2. Implement Wallet Transfers
3. Implement Dispute system
4. Implement Withdrawal system
5. Add comprehensive tests untuk semua fitur baru

### Phase 3: User-Facing Features (1 minggu)
1. AI Chat UI
2. Document Management UI
3. Wallet Dashboard
4. Token Purchase UI
5. Username change enable

### Phase 4: Quality & Infrastructure (1-2 minggu)
1. Increase test coverage
2. Sentry integration
3. Redis distributed rate limiting
4. Database migrations proper tracking
5. Performance optimization

### Phase 5: Production Polish (1-2 minggu)
1. Payment gateway integration
2. WebSocket notifications
3. Security audit
4. Penetration testing
5. Documentation complete

**Total Estimated Timeline**: 5-8 minggu untuk 100% Production-Ready

---

## ❓ PERTANYAAN UNTUK KLIEN

Sebelum mulai execution, saya butuh klarifikasi:

### 1. Prioritas Fitur
Dari 5 fase di atas, apakah ada yang perlu diprioritaskan lebih tinggi?

**Pilihan**:
- A. Critical Bugs + Core Features (Transfers, Disputes) - Focus pada fitur transaksi
- B. Critical Bugs + User-Facing Features (AI Chat, Documents) - Focus pada user experience
- C. Critical Bugs + Quality (Tests, Monitoring) - Focus pada stability
- D. All phases in sequence - Comprehensive approach

### 2. Payment Gateway
Platform ini akan gunakan payment gateway yang mana?
- Midtrans (recommended untuk Indonesia)
- Xendit
- Stripe
- Other?

### 3. Deployment Infrastructure
- Apakah sudah ada Redis cluster?
- Apakah sudah ada monitoring setup (Prometheus/Grafana)?
- Apakah sudah ada Sentry account?

### 4. Timeline Flexibility
- Apakah ada fitur yang MUST HAVE dalam 2 minggu?
- Apakah ada fitur yang bisa ditunda (nice-to-have)?

### 5. Budget Considerations
- Untuk external services (Sentry, Payment Gateway, Redis), apakah ada budget approval?
- Security audit dan penetration testing perlu external firm?

---

**Silakan review plan ini dan beri instruksi fitur mana yang ingin dikerjakan terlebih dahulu.**

*Document created: 12 Januari 2026*
