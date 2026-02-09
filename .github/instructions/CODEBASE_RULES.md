# 🤖 AIVALID AI & DEVELOPER INSTRUCTIONS

> **Version:** 2.0  
> **Last Updated:** January 15, 2026  
> **Purpose:** Rules and guidelines for all developers and AI assistants

---

## 🎯 MISSION STATEMENT

Platform komunitas Indonesia enterprise-grade dengan fitur keuangan digital dan integrasi AI. Semua kode harus berkualitas tinggi, aman, dan mudah di-maintain.

---

## ⚠️ ATURAN KRITIS (WAJIB)

### 1. Keamanan

```
❌ DILARANG:
- Menyimpan password/secret dalam plain text
- Menonaktifkan validasi input
- Skip autentikasi/otorisasi
- Menggunakan eval(), SQL raw tanpa parameter
- Expose stack trace ke user
- Log data sensitif (password, token, PIN)
- Hardcode credentials

✅ WAJIB:
- Gunakan bcrypt untuk password (cost ≥ 10)
- Gunakan PBKDF2 untuk PIN (iterations ≥ 310,000)
- Validasi semua input di server
- Gunakan parameterized queries
- Require 2FA untuk operasi keuangan
- Rate limit endpoint sensitif
```

### 2. Arsitektur

```
JANGAN:
❌ Mencampur logic antar service (Go ↔ .NET)
❌ Akses database service lain langsung
❌ Business logic di handler/controller
❌ Mengubah flow autentikasi tanpa review

LAKUKAN:
✅ Separation of concerns (Handler → Service → Repository)
✅ Komunikasi antar service via HTTP
✅ Error handling yang konsisten
✅ Logging yang proper
```

### 3. Bahasa

```
User-facing: Bahasa Indonesia
- Error messages, Success messages, UI text

Internal/Technical: English
- Log messages, Code comments, Variable names
```

---

## 📁 STRUKTUR PROYEK

```
aivalid/
├── backend/          # Go + Gin (Core API)
│   ├── handlers/     # HTTP handlers only
│   ├── services/     # Business logic
│   ├── ent/schema/   # Database entities (Ent ORM)
│   ├── middleware/   # Auth, rate limit, security
│   ├── dto/          # Request/Response structs
│   └── validators/   # Input validation
│
├── feature-service/  # .NET Core (Extended Features)
│   └── src/FeatureService.Api/
│       ├── Controllers/  # API endpoints
│       ├── Services/     # Business logic
│       ├── Models/       # MongoDB documents
│       └── DTOs/         # Request/Response
│
├── frontend/         # Next.js 15 + React 19
│   ├── app/          # App Router pages
│   ├── components/   # React components
│   └── lib/          # Utilities, hooks, API clients
│
└── docs/             # Documentation (BACA SEMUA!)
```

---

## 🔧 KONVENSI KODE

### Go Backend
```go
// Handler: HTTP only, delegate to service
func (h *Handler) Action(c *gin.Context) {
    var input dto.Input
    c.ShouldBindJSON(&input)
    result, err := h.service.Action(ctx, input)
    c.JSON(200, result)
}

// Import order: stdlib → third-party → internal
```

### .NET Feature Service
```csharp
// Controller: thin, delegate to service
[HttpPost]
[Authorize]
public async Task<IActionResult> Action([FromBody] RequestDto request) {
    var result = await _service.ActionAsync(User.GetUserId(), request);
    return Ok(result);
}
```

### Next.js Frontend
```javascript
// Use 'use client' for interactive components
// Use SWR for data fetching
// Use fetchJsonAuth for authenticated API calls
```

---

## 🔐 SECURITY CHECKLIST

Before submitting code:
- [ ] Input validated on server (not just frontend)
- [ ] Using parameterized queries/ORM
- [ ] Sensitive data not logged
- [ ] Errors don't expose internals
- [ ] Rate limiting applied if needed
- [ ] Auth check on protected endpoints

---

## 📝 COMMIT FORMAT

```
<type>: <description>

Types: feat, fix, refactor, docs, test, chore

Example:
feat: add passkey authentication
fix: resolve session_id required error
```

---

## 🚀 DEPLOYMENT

| Service | Server | Domain |
|---------|--------|--------|
| Frontend | Vercel (auto) | aivalid.id |
| Backend | 72.62.124.23 | api.aivalid.id |
| Feature | 203.175.11.84 | feature.aivalid.id |

---

## 📚 DOKUMENTASI WAJIB BACA

- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) - Arsitektur sistem lengkap
- [docs/SECURITY.md](../../docs/SECURITY.md) - Dokumentasi keamanan
- [docs/DEVELOPER_GUIDE.md](../../docs/DEVELOPER_GUIDE.md) - Panduan developer lengkap
- [docs/IMPROVEMENTS.md](../../docs/IMPROVEMENTS.md) - Roadmap & perbaikan
- [docs/WEBSITE_ASSESSMENT.md](../../docs/WEBSITE_ASSESSMENT.md) - Penilaian website

---

## ✅ QUICK REFERENCE

### API Response
```javascript
// Success
{ "data": {...}, "message": "..." }

// Error  
{ "error": "Pesan dalam Indonesia", "code": "ERR_CODE" }
```

### Error Codes
| Code | Description |
|------|-------------|
| AUTH001 | Token tidak valid |
| AUTH002 | Email sudah terdaftar |
| AUTH009 | Akun terkunci |
| FIN001 | PIN salah |
| FIN002 | Saldo tidak cukup |

---

*Patuhi panduan ini. Baca docs/ untuk informasi lengkap.*
