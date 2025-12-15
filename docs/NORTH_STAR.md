# NORTH_STAR (As-Is)

## As-Is (verified)
- Backend Go menggunakan Gin dengan JWT middleware, login/register email+password, verifikasi email via token, dan route REST yang didefinisikan di `backend/main.go` (mis. `/api/threads/categories`, `/api/threads/latest`, `/api/threads/:id`).
- Model `Category` dan `Thread` disimpan lewat GORM dan dimuat dengan relasi user/kategori pada handler threads (`backend/handlers/threads.go`).
- Frontend Next.js App Router menampilkan header/sidebar global (`frontend/components/Header.js`, `frontend/components/Sidebar.js`) dan landing page (`frontend/app/page.js`) yang kini membaca kategori serta thread terbaru langsung dari API.
- JWT disimpan di `localStorage` (mis. dicek di `Header`, `ProfileSidebar`) dan dipakai untuk memanggil endpoint yang memerlukan auth; halaman `/login`, `/register`, dan `/verify-email` menggunakan form email/password.

## Next Steps (verified)
- Hubungkan halaman daftar/detail thread lain agar memakai endpoint real (termasuk `/api/threads/latest` dan `/api/threads/:id`).
- Tambahkan handling error/loading yang konsisten pada fetch client-side (mis. komponen lain yang masih memakai placeholder).
- Dokumentasikan konfigurasi environment frontend/backend (termasuk `NEXT_PUBLIC_API_BASE_URL` dan `FRONTEND_BASE_URL`).
