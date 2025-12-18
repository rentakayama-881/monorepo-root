# NORTH_STAR (As-Is)

Dokumen ini menjadi rujukan tunggal untuk misi/target jangka menengah. `docs/PROJECT_DOCUMENTATION.md` hanya menautkan ke halaman ini agar tidak ada duplikasi isi.

## As-Is (verified)
- Backend Go menggunakan Gin dengan JWT middleware, login/register email+password, verifikasi email via token, dan route REST yang didefinisikan di `backend/main.go` (mis. `/api/threads/categories`, `/api/threads/latest`, `/api/threads/:id`, `/api/orders`). Worker event on-chain aktif memakai `RPC_URL` + `chain_cursors` untuk memproses `EscrowDeployed`/event escrow dan memperbarui status order.
- Model `Category` dan `Thread` disimpan lewat GORM dan dimuat dengan relasi user/kategori pada handler threads (`backend/handlers/threads.go`). Model order mencakup siklus status created→deployed→funded/delivered/disputed→resolved/refunded/released.
- Frontend Next.js App Router menampilkan header/sidebar global (`frontend/components/Header.js`, `frontend/components/Sidebar.js`) dan landing page (`frontend/app/page.js`) yang kini membaca kategori serta thread terbaru langsung dari API. Header merespons event `auth:changed` untuk sinkronisasi token tanpa refresh.
- JWT disimpan di `localStorage` dan dipakai untuk memanggil endpoint yang memerlukan auth; halaman `/login`, `/register`, dan `/verify-email` menggunakan form email/password dengan helper `setToken`/`clearToken`. Register mensyaratkan verifikasi email (tautan/token dari backend) sebelum login. Flow escrow ada di `/orders/new` (create order + deploy + attach) dan `/orders/[orderId]` (status view).
- Fitur saldo/refill/transfer kustodian telah dihapus; UI profil hanya menampilkan navigasi akun/thread tanpa saldo.

## Next Steps (verified)
- Tambahkan healthcheck/alerting untuk worker event escrow (mis. retry ketika RPC down) dan extend parsing event disputing/resolution detail.
- Hubungkan halaman thread detail lain agar memakai endpoint real (termasuk `/api/threads/latest` dan `/api/threads/:id`) dengan UI error/loading yang konsisten.
- Dokumentasikan env end-to-end (JWT, `RPC_URL`, `ESCROW_FACTORY_ADDRESS`, `BACKEND_SIGNER_PRIVATE_KEY`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_FACTORY_ADDRESS`).
- Tampilkan status escrow realtime di UI (polling/sse) serta tambah kontrol frontend untuk menandai delivered/dispute setelah worker memperbarui status.
