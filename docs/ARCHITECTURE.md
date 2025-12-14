# ARCHITECTURE (Current)

## Backend (Go + Gin)
- Entrypoint `backend/main.go` memuat environment, inisialisasi database/worker, mengaktifkan CORS, dan mendaftarkan grup route `/api` termasuk `/threads` (kategori, per-kategori, terbaru, detail, CRUD), `/auth` (OAuth GitHub, username), serta utility seperti `/rag/*`.
- Handler thread di `backend/handlers/threads.go` memuat kategori dari database, mengambil thread per kategori, detail thread (auth), membuat/memperbarui thread, serta endpoint publik terbaru yang menggabungkan relasi user dan kategori.
- Model GORM `Category` dan `Thread` berada di `backend/models/thread.go` dengan relasi ke `User` (`backend/models/user.go`), sehingga preload user/kategori tersedia untuk response JSON.

## Frontend (Next.js App Router)
- Layout root menempatkan Header/Sidebar global dan styling di `frontend/app/layout.js` & `frontend/app/globals.css`.
- Landing page `frontend/app/page.js` adalah server component dengan revalidate 60 detik yang memuat kategori dan thread terbaru via API.
- Komponen `frontend/components/Header.js` dan `frontend/components/Sidebar.js` mengambil kategori secara client-side dan menampilkan dropdown/list dinamis sesuai slug backend.
- `frontend/components/ProfileSidebar.js` membaca token dari `localStorage` dan memanggil `/api/user/me` menggunakan base URL dari helper `getApiBase`.

## Data & Config
- Basis data diinisialisasi melalui `database.InitDB()` di `backend/main.go` dan model di-auto migrate (lihat `backend/database/db.go`).
- Frontend membaca base URL backend lewat `NEXT_PUBLIC_API_BASE_URL` dengan fallback lokal `http://localhost:8080` (lihat `frontend/lib/api.js`).
