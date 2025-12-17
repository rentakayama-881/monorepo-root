# ARCHITECTURE (Current)

## Backend (Go + Gin)
- Entrypoint `backend/main.go` memuat environment, inisialisasi database + config, mengaktifkan CORS, menjalankan worker sinkronisasi event on-chain, dan mendaftarkan grup routes `/api` untuk auth/account/user/threads/disputes serta order non-kustodian (`POST /api/orders`, `POST /api/orders/:orderId/attach`, `GET /api/orders/:orderId`).
- Handler thread di `backend/handlers/threads.go` memuat kategori dari database, mengambil thread per kategori, detail thread (auth), membuat/memperbarui thread, serta endpoint publik terbaru yang menggabungkan relasi user dan kategori.
- Model GORM `Category` dan `Thread` berada di `backend/models/thread.go` dengan relasi ke `User` (`backend/models/user.go`), sehingga preload user/kategori tersedia untuk response JSON.
- Model order escrow non-kustodian berada di `backend/models/marketplace.go` dengan status `created → deployed → funded → delivered → disputed → resolved/refunded/released`, menyimpan buyer/seller wallet, amount (USDT minor unit), chain_id, escrow_address, dan tx_hash. Config backend memuat signer privat + factory address untuk menandatangani payload deploy (`backend/config/config.go`) serta `RPC_URL` untuk akses node.
- Worker `backend/worker/event_worker.go` memakai ABI event `EscrowDeployed` dari factory dan event `Funded/Delivered/DisputeOpened/Resolved/Refunded/Released` dari kontrak Escrow. Worker membaca cursor block dari tabel `chain_cursors`, memfilter log berdasarkan alamat factory + escrow yang dikenal, lalu memperbarui status order/tx hash.
- Autentikasi memakai JWT berbasis email dengan password hash bcrypt (`backend/handlers/auth.go`, `backend/middleware/jwt.go`) dan limiter sederhana (`backend/middleware/rate_limit.go`); token verifikasi email disimpan di `EmailVerificationToken`.

## Frontend (Next.js App Router)
- Layout root menempatkan Header/Sidebar global dan styling di `frontend/app/layout.js` & `frontend/app/globals.css`.
- Landing page `frontend/app/page.js` adalah server component dengan revalidate 60 detik yang memuat kategori dan thread terbaru via API.
- Komponen `frontend/components/Header.js` dan `frontend/components/Sidebar.js` mengambil kategori secara client-side dan menampilkan dropdown/list dinamis sesuai slug backend; `Header` bereaksi ke event `auth:changed` (storage + custom event) untuk memperbarui status login tanpa refresh.
- `frontend/components/ProfileSidebar.js` membaca token dari `localStorage` dan memanggil `/api/user/me` menggunakan base URL dari helper `getApiBase`; halaman login/register menggunakan helper `setToken`/`clearToken` serta menampilkan notifikasi registrasi. Halaman `/orders/new` menyiapkan alur deploy escrow (connect wallet → POST order → kirim tx factory → attach ke backend) dan `/orders/[orderId]` menampilkan status/escrow/tx/buyer/seller/amount/chain_id.

## Data & Config
- Basis data diinisialisasi melalui `database.InitDB()` di `backend/main.go` dan model di-auto migrate (lihat `backend/database/db.go`) tanpa tabel saldo/deposit transfer; tabel order mencatat `order_id_hex`, buyer_user_id (opsional), buyer/seller wallet, amount_usdt, chain_id, escrow_address, tx_hash, dan status lifecycle. Tabel `chain_cursors` menyimpan block terakhir yang telah diproses worker per chain.
- Frontend membaca base URL backend lewat helper `getApiBase` yang bergantung pada `NEXT_PUBLIC_API_BASE_URL` dengan fallback lokal `http://localhost:8080` (lihat `frontend/lib/api.js`). Worker on-chain memakai env `RPC_URL` dan alamat factory (`ESCROW_FACTORY_ADDRESS`); frontend memerlukan `NEXT_PUBLIC_FACTORY_ADDRESS` saat override manual deploy.
- Migrasi dev: reset DB dapat dilakukan dengan menjatuhkan schema `public` lalu menjalankan ulang server untuk auto-migrate.
