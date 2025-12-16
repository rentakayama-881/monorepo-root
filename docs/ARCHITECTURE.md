# ARCHITECTURE (Current)

## Backend (Go + Gin)
- Entrypoint `backend/main.go` memuat environment, inisialisasi database + config, mengaktifkan CORS, dan mendaftarkan grup routes `/api` untuk auth/account/user/threads/orders/disputes serta utility `/rag/*` tanpa worker pemantau deposit/transfer.
- Handler thread di `backend/handlers/threads.go` memuat kategori dari database, mengambil thread per kategori, detail thread (auth), membuat/memperbarui thread, serta endpoint publik terbaru yang menggabungkan relasi user dan kategori.
- Model GORM `Category` dan `Thread` berada di `backend/models/thread.go` dengan relasi ke `User` (`backend/models/user.go`), sehingga preload user/kategori tersedia untuk response JSON.
- Autentikasi memakai JWT berbasis email dengan password hash bcrypt (`backend/handlers/auth.go`, `backend/middleware/jwt.go`) dan limiter sederhana (`backend/middleware/rate_limit.go`); token verifikasi email disimpan di `EmailVerificationToken`.
- Arah jangka panjang adalah escrow non-kustodian: worker/event listener on-chain tetap sebagai placeholder, sementara backend tidak lagi menyimpan saldo pengguna atau alamat deposit.

## Frontend (Next.js App Router)
- Layout root menempatkan Header/Sidebar global dan styling di `frontend/app/layout.js` & `frontend/app/globals.css`.
- Landing page `frontend/app/page.js` adalah server component dengan revalidate 60 detik yang memuat kategori dan thread terbaru via API.
- Komponen `frontend/components/Header.js` dan `frontend/components/Sidebar.js` mengambil kategori secara client-side dan menampilkan dropdown/list dinamis sesuai slug backend.
- `frontend/components/ProfileSidebar.js` membaca token dari `localStorage` dan memanggil `/api/user/me` menggunakan base URL dari helper `getApiBase`; halaman login/register baru memakai form email/password dengan UI ala GitHub (`frontend/app/login/page.jsx`, `frontend/app/register/page.jsx`, `frontend/app/verify-email/page.jsx`).

## Data & Config
- Basis data diinisialisasi melalui `database.InitDB()` di `backend/main.go` dan model di-auto migrate (lihat `backend/database/db.go`) tanpa tabel saldo/deposit transfer.
- Frontend membaca base URL backend lewat helper `getApiBase` yang bergantung pada `NEXT_PUBLIC_API_BASE_URL` dengan fallback lokal `http://localhost:8080` (lihat `frontend/lib/api.js`).
- Migrasi dev: reset DB dapat dilakukan dengan menjatuhkan schema `public` lalu menjalankan ulang server untuk auto-migrate.
