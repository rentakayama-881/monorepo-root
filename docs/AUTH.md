# AUTH

Panduan autentikasi email + password yang menggantikan OAuth GitHub.

## Endpoint
- `POST /api/auth/register`: `{ email, password, username?, full_name? }`
  - Validasi email dan password (>=8 karakter). Username opsional maksimal 64 karakter.
  - Password di-hash dengan bcrypt. Email harus unik. Username unik bila diisi.
  - Membuat token verifikasi email (24 jam) dan mencetak tautan ke log server (lihat bagian Dev verification).
- `POST /api/auth/login`: `{ email, password }` → `{ token, user }`
  - Membalas 403 dengan `verification_required: true` jika email belum diverifikasi.
  - Token JWT menaruh claim email dan berlaku 24 jam (kunci: `JWT_SECRET`).
- `POST /api/auth/verify/request`: `{ email }` (idempotent)
  - Mengeluarkan respons netral; jika email terdaftar token baru dibuat dan tautan verifikasi dicetak ke log.
- `POST /api/auth/verify/confirm`: `{ token }`
  - Menandai `EmailVerified=true` bila token valid & belum kedaluwarsa.
- `POST /api/auth/username`: set username satu kali pasca login (wajib Authorization Bearer).
- `GET /api/user/me`: profil singkat pengguna login (email, username, balance, avatar).

## Rate limiting
Login, register, dan permintaan verifikasi dibatasi in-memory per IP (login 10/mnt, register 6/mnt, verify 10/mnt). Sesuaikan di `backend/handlers/auth.go` bila diperlukan.

## Konfigurasi env
- `JWT_SECRET` **wajib** di backend.
- `FRONTEND_BASE_URL` opsional untuk membentuk tautan verifikasi (default `http://localhost:3000`).
- Frontend membaca backend via `NEXT_PUBLIC_API_BASE_URL` (helper `frontend/lib/api.js`).

## Dev verification
Jika SMTP belum tersedia, buka log backend setelah register/verify request. Akan muncul baris seperti:
```
Email verification for user@example.com: http://localhost:3000/verify-email?token=...
```
Buka tautan tersebut di browser (atau panggil `POST /api/auth/verify/confirm` dengan token) untuk menyelesaikan verifikasi. Token juga dikembalikan di respons register/verify untuk memudahkan testing lokal; jangan gunakan respons tersebut di produksi.

## Kompatibilitas
User lama hasil OAuth GitHub tidak memiliki password hash. Buat akun baru atau migrasikan data secara manual dengan mengisi `PasswordHash` dan `EmailVerified` sebelum mengaktifkan login email.
