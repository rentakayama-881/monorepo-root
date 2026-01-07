# 📚 Dokumentasi Alephdraad

> **Catatan**: Dokumentasi ini dibuat untuk membantu siapa saja memahami sistem Alephdraad, termasuk orang yang baru belajar programming.

## 🎯 Apa itu Alephdraad?

Alephdraad adalah **platform komunitas/forum online** seperti Reddit atau Discourse, dengan fitur-fitur modern:
- 💬 Thread dan diskusi per kategori
- 🤖 **AI Assistant (Aleph)** - Chatbot pintar berbayar per token
- 👤 User profile dengan badge sistem
- 💰 Wallet & token system
- 🔐 Keamanan tingkat enterprise (2FA, Passkey)

---

## 📖 Daftar Isi Dokumentasi

### 🏗️ Bagian 1: Dasar-Dasar (Foundation)
| Dokumen | Deskripsi |
|---------|-----------|
| [00_OVERVIEW.md](./01-foundation/00_OVERVIEW.md) | Gambaran besar sistem |
| [01_GLOSSARY.md](./01-foundation/01_GLOSSARY.md) | Daftar istilah teknis |
| [02_TECH_STACK.md](./01-foundation/02_TECH_STACK.md) | Teknologi yang dipakai |
| [03_HOW_SYSTEMS_CONNECT.md](./01-foundation/03_HOW_SYSTEMS_CONNECT.md) | Cara frontend & backend terhubung |
| [04_AUTHENTICATION_FLOW.md](./01-foundation/04_AUTHENTICATION_FLOW.md) | Alur login & keamanan |
| [05_DATA_FLOW.md](./01-foundation/05_DATA_FLOW.md) | Bagaimana data mengalir |

### 💻 Bagian 2: Frontend (Next.js)
| Dokumen | Deskripsi |
|---------|-----------|
| [10_FRONTEND_OVERVIEW.md](./02-frontend/10_FRONTEND_OVERVIEW.md) | Struktur aplikasi web |
| [11_FRONTEND_PAGES.md](./02-frontend/11_FRONTEND_PAGES.md) | Penjelasan setiap halaman |
| [12_FRONTEND_COMPONENTS.md](./02-frontend/12_FRONTEND_COMPONENTS.md) | Komponen UI yang tersedia |
| [13_FRONTEND_HOOKS.md](./02-frontend/13_FRONTEND_HOOKS.md) | Custom hooks untuk logika |
| [14_FRONTEND_API_CLIENTS.md](./02-frontend/14_FRONTEND_API_CLIENTS.md) | Cara memanggil backend |

### ⚙️ Bagian 3: Backend Gin (Go)
| Dokumen | Deskripsi |
|---------|-----------|
| [20_BACKEND_GIN_OVERVIEW.md](./03-backend-gin/20_BACKEND_GIN_OVERVIEW.md) | Arsitektur backend utama |
| [21_BACKEND_GIN_ROUTES.md](./03-backend-gin/21_BACKEND_GIN_ROUTES.md) | Semua API endpoints |
| [22_BACKEND_GIN_HANDLERS.md](./03-backend-gin/22_BACKEND_GIN_HANDLERS.md) | Logika request handler |
| [23_BACKEND_GIN_SERVICES.md](./03-backend-gin/23_BACKEND_GIN_SERVICES.md) | Business logic layer |
| [24_BACKEND_GIN_MIDDLEWARE.md](./03-backend-gin/24_BACKEND_GIN_MIDDLEWARE.md) | Middleware keamanan |

### 🔷 Bagian 4: Feature Service (ASP.NET Core)
| Dokumen | Deskripsi |
|---------|-----------|
| [30_FEATURE_SERVICE_OVERVIEW.md](./04-feature-service/30_FEATURE_SERVICE_OVERVIEW.md) | Arsitektur microservice |
| [31_FEATURE_SERVICE_ENDPOINTS.md](./04-feature-service/31_FEATURE_SERVICE_ENDPOINTS.md) | API endpoints |
| [32_FEATURE_SERVICE_SERVICES.md](./04-feature-service/32_FEATURE_SERVICE_SERVICES.md) | Business logic services |
| [33_FEATURE_SERVICE_AI_INTEGRATION.md](./04-feature-service/33_FEATURE_SERVICE_AI_INTEGRATION.md) | Integrasi AI (HuggingFace & LLM) |

### 🗄️ Bagian 5: Database
| Dokumen | Deskripsi |
|---------|-----------|
| [40_DATABASE_OVERVIEW.md](./05-database/40_DATABASE_OVERVIEW.md) | PostgreSQL vs MongoDB |
| [41_POSTGRESQL_MODELS.md](./05-database/41_POSTGRESQL_MODELS.md) | Schema PostgreSQL (Ent) |
| [42_MONGODB_COLLECTIONS.md](./05-database/42_MONGODB_COLLECTIONS.md) | Collections MongoDB |

### 🔐 Bagian 6: Keamanan (Security)
| Dokumen | Deskripsi |
|---------|-----------|
| [50_SECURITY_OVERVIEW.md](./06-security/50_SECURITY_OVERVIEW.md) | Ringkasan keamanan |
| [51_SECURITY_AUTHENTICATION.md](./06-security/51_SECURITY_AUTHENTICATION.md) | JWT, 2FA, Passkey, Sudo |
| [52_SECURITY_BEST_PRACTICES.md](./06-security/52_SECURITY_BEST_PRACTICES.md) | Best practices keamanan |

### 🤖 Bagian 7: Aleph AI Assistant
| Dokumen | Deskripsi |
|---------|-----------|
| [60_ALEPH_OVERVIEW.md](./07-aleph-assistant/60_ALEPH_OVERVIEW.md) | Apa itu Aleph? |
| [62_ALEPH_TOKEN_PRICING.md](./07-aleph-assistant/62_ALEPH_TOKEN_PRICING.md) | **Sistem token berbayar** (PENTING!) |

### 🚀 Bagian 8: Deployment & Operations
| Dokumen | Deskripsi |
|---------|-----------|
| [70_DEPLOYMENT_OVERVIEW.md](./08-deployment/70_DEPLOYMENT_OVERVIEW.md) | Gambaran deployment |
| [71_VERCEL_DEPLOYMENT.md](./08-deployment/71_VERCEL_DEPLOYMENT.md) | Deploy frontend ke Vercel |
| [72_VPS_DEPLOYMENT.md](./08-deployment/72_VPS_DEPLOYMENT.md) | Deploy backend ke VPS |
| [73_DATABASE_SETUP.md](./08-deployment/73_DATABASE_SETUP.md) | Setup Neon & MongoDB |
| [74_ENVIRONMENT_VARIABLES.md](./08-deployment/74_ENVIRONMENT_VARIABLES.md) | Semua environment variables |

### 💡 Bagian 9: Rekomendasi & Improvement
| Dokumen | Deskripsi |
|---------|-----------|
| [80_CURRENT_ISSUES.md](./09-improvements/80_CURRENT_ISSUES.md) | Masalah yang diketahui |
| [81_RECOMMENDED_IMPROVEMENTS.md](./09-improvements/81_RECOMMENDED_IMPROVEMENTS.md) | Saran peningkatan |
| [82_ENTERPRISE_RECOMMENDATIONS.md](./09-improvements/82_ENTERPRISE_RECOMMENDATIONS.md) | Standar enterprise (GitHub, Stripe) |

### 🗺️ Bagian 10: Roadmap & Planning
| Dokumen | Deskripsi |
|---------|-----------|
| [90_FUTURE_FEATURES.md](./10-roadmap/90_FUTURE_FEATURES.md) | Fitur yang direncanakan |
| [91_VERSION_PLANNING.md](./10-roadmap/91_VERSION_PLANNING.md) | Perencanaan versi |
| [92_CONTRIBUTING.md](./10-roadmap/92_CONTRIBUTING.md) | Panduan kontribusi |
| [QUICK_TROUBLESHOOT.md](./quick-reference/QUICK_TROUBLESHOOT.md) | Troubleshooting |

---

## 🏢 Referensi Enterprise

Dokumentasi ini mengikuti standar dokumentasi dari perusahaan teknologi terkemuka:
- **GitHub** - [docs.github.com](https://docs.github.com)
- **Stripe** - [stripe.com/docs](https://stripe.com/docs)
- **Vercel** - [vercel.com/docs](https://vercel.com/docs)
- **Supabase** - [supabase.com/docs](https://supabase.com/docs)

---

## 📅 Terakhir Diperbarui

**Tanggal**: 7 Januari 2026  
**Versi**: 1.0.0

