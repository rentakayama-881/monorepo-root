# Dokumentasi Monorepo

Dokumen ini merangkum struktur, arsitektur saat ini, visi jangka panjang (North Star), serta daftar tugas lanjutan untuk monorepo ini. Fokusnya mencakup tiga pilar utama: backend Go, frontend Next.js, dan smart contract Solidity.

## Arsitektur Saat Ini
- **Lapisan backend**: REST API berbasis Gin dengan middleware JWT, autentikasi email+password (bcrypt), worker pemantau deposit/transfer, dan modul RAG yang memakai Cohere serta PostgreSQL/pgvector untuk penyimpanan embedding.
- **Lapisan frontend**: Aplikasi Next.js (app router) dengan komponen UI kustom, halaman otentikasi, akun, transfer saldo, badge, AI search, dsb. Header dan sidebar berbagi daftar kategori yang konsisten dengan backend.
- **Lapisan kontrak**: Kumpulan smart contract (Escrow, EscrowFactory, FeeLogic, Staking, ArbitrationAdapter) yang mengelola escrow USDT, fee dinamis, staking, serta adapter arbitrase.
- **Alur data utama**:
  1. Pengguna daftar/login dengan email+password → backend membuat JWT → frontend menyimpan token untuk memanggil API; verifikasi email menggunakan token yang dicetak di log server/dev.
  2. Thread & user API memakai PostgreSQL melalui GORM; konten thread dapat diindeks ke pgvector lewat endpoint RAG.
  3. Saldo pengguna dan deposit on-chain diawasi worker; transfer saldo dan refill memanfaatkan alamat HD wallet yang dibuat per pengguna.
  4. Marketplace/escrow disiapkan melalui kombinasi backend (order/dispute records) dan smart contract untuk eksekusi dana.

## Peta File
Rangkuman per file di seluruh repo (kecuali dependensi vendored/node_modules).

### Akar Repo
- `backend/` — layanan API Go.
- `frontend/` — aplikasi Next.js & asset publik.
- `contracts/` — smart contract Solidity.

### Backend (Go)
- `backend/main.go` — entrypoint server Gin: memuat env, inisialisasi DB, worker deposit/transfer, konfigurasi CORS, static file `/static`, dan mendaftarkan semua grup route `/api`. 
- `backend/go.mod` / `backend/go.sum` — dependensi Go module.
- `backend/.gitignore` — pengecualian file build/env.
- `backend/config/config.go` — memuat konfigurasi OAuth GitHub & JWT key dari environment variables.
- `backend/database/db.go` — koneksi PostgreSQL (DATABASE_URL/dsn), automigrate model, dan seeding kategori thread.
- `backend/database/deposit.go` — model `DepositAddress` dan helper untuk membuat/mendapat alamat deposit berbasis HD wallet per pengguna.
- `backend/dto/github.go` — struct respons data GitHub (email/id/avatar) untuk proses OAuth.
- `backend/dto/create_username.go` — payload pembuatan username baru.
- `backend/dto/create_thread.go` — payload membuat thread (title, category_id, content json, dsb.).
- `backend/dto/update_thread.go` — payload memperbarui thread (title/summary/content/meta).
- `backend/dto/transfer.go` — payload transfer saldo (recipient_username, amount).
- `backend/handlers/account.go` — handler akun: ambil profil sendiri, update profil, ubah username berbayar, upload avatar, dan builder profil publik.
- `backend/handlers/badge_detail.go` — handler detail badge individual.
- `backend/handlers/badges.go` — handler daftar badge milik pengguna.
- `backend/handlers/balance.go` — info refill saldo & endpoint ambil alamat deposit pengguna.
- `backend/handlers/marketplace.go` — skeleton endpoint order/dispute (GET/PUT) dan rate Chainlink.
- `backend/handlers/oauth.go` — login & callback OAuth GitHub.
- `backend/handlers/rag.go` — endpoint RAG: indeks teks panjang, indeks chunk, ask/answer QA, indeks thread by ID, debug chunk.
- `backend/handlers/threads.go` — handler kategori thread, thread per kategori, detail thread, membuat & memperbarui thread.
- `backend/handlers/transfer.go` — handler transfer saldo antar pengguna.
- `backend/handlers/user.go` — handler info user terautentikasi dan profil publik berdasar username.
- `backend/handlers/user_threads.go` — handler daftar thread per user (publik & milik sendiri).
- `backend/handlers/username.go` — handler pembuatan username setelah login OAuth.
- `backend/middleware/auth.go` — middleware JWT wajib untuk route yang membutuhkan autentikasi.
- `backend/middleware/auth_optional.go` — middleware JWT opsional (meneruskan context jika token ada).
- `backend/middleware/jwt.go` — helper parsing & validasi JWT token dari header Authorization.
- `backend/models/user.go` — model pengguna (email, username, avatar, saldo, profil & sosial sebagai JSON).
- `backend/models/credential.go` — model kredensial terhubung ke user.
- `backend/models/thread.go` — model kategori & thread (JSON content/meta, relasi user/kategori).
- `backend/models/transfer.go` — model transfer saldo antar pengguna (status, hold_until).
- `backend/models/marketplace.go` — model order, dispute, promotion, dan volume ledger untuk alur escrow marketplace.
- `backend/utils/chunker.go` — utilitas pemisah teks menjadi chunk untuk indeks RAG.
- `backend/utils/cohere.go` — client Cohere untuk pembuatan embedding teks.
- `backend/utils/cohere_rerank.go` — utilitas rerank hasil pencarian dengan Cohere.
- `backend/utils/cohere_chat.go` — helper panggil chat Cohere untuk jawaban RAG.
- `backend/utils/jsonflatten.go` — flatten konten JSON sebelum embedding.
- `backend/utils/pgvector.go` — helper koneksi pgvector/SQL untuk penyimpanan embedding & query similarity.
- `backend/utils/hdwallet.go` — pembuatan alamat HD wallet (deposit) berdasar user ID.
- `backend/utils/rate.go` — kalkulasi rate berdasarkan data Chainlink (ETH-USD & IDR) dengan fallback default.
- `backend/worker/deposit_monitor.go` — worker memantau saldo deposit on-chain & sinkronisasi.
- `backend/worker/transfer_monitor.go` — worker memantau transfer/balance updates.
- `backend/worker/event_worker.go` — placeholder worker event-driven untuk integrasi on-chain.

### Frontend (Next.js)
- `frontend/.gitignore` — pengecualian build/node.
- `frontend/package.json` / `frontend/package-lock.json` — dependensi aplikasi Next.js.
- `frontend/jsconfig.json` — konfigurasi path alias/JS linting.
- `frontend/next.config.mjs` — konfigurasi Next.js (output, transpile, dsb.).
- `frontend/eslint.config.mjs` — aturan ESLint proyek.
- `frontend/postcss.config.mjs` — konfigurasi PostCSS/Tailwind import.
- `frontend/app/layout.js` — layout root, metadata situs, injeksi Header global & kontainer konten.
- `frontend/app/globals.css` — panduan desain/global style (variabel tema, utility class, komponen dasar).
- `frontend/app/page.js` — landing page hero, daftar kategori, placeholder thread terbaru, dan link aturan.
- `frontend/app/login/page.jsx` — halaman login GitHub (membangun URL oauth & redirect).
- `frontend/app/set-username/page.jsx` — form set username awal pasca-OAuth.
- `frontend/app/account/page.jsx` — pengelolaan profil/username/avatar & sosial; fetch/update via API.
- `frontend/app/threads/page.jsx` — daftar thread/kategori (placeholder data, siap integrasi API).
- `frontend/app/ai-search/page.jsx` — form tanya-jawab AI yang memanggil endpoint RAG backend dan menampilkan sumber.
- `frontend/app/contact-support/page.jsx` — form laporan & transfer saldo dengan fetch ke `/balance/transfer`.
- `frontend/app/refill-balance/page.jsx` — mengambil info refill & alamat deposit dari backend untuk pengguna login.
- `frontend/app/transfer-balance/page.jsx` — form transfer saldo antar pengguna (mirip contact-support tanpa form support).
- `frontend/app/pengajuan-badge/page.jsx` — form pengajuan badge dengan field upload/link portofolio.
- `frontend/app/rules-content/page.jsx` — halaman aturan komunitas dan panduan posting.
- `frontend/app/about-content/page.jsx` — halaman statis tentang platform.
- `frontend/app/sync-token/page.jsx` & `frontend/app/sync-token/inner.jsx` — placeholder sinkronisasi token JWT/LS untuk navigasi aman.
- `frontend/app/favicon.ico` — ikon situs.
- `frontend/components/Header.js` — header global dengan navigasi, search bar, tombol login/logout, dan tombol toggle sidebar mobile.
- `frontend/components/Sidebar.js` — sidebar kategori/topik populer dengan pencarian & link navigasi.
- `frontend/components/ProfileSidebar.js` — panel profil ringkas + saldo dan quick links.
- `frontend/components/ui/Button.jsx` — komponen tombol dengan varian (primary/ghost/outline) & state loading.
- `frontend/components/ui/Input.jsx` — input teks dengan label/helper/error state.
- `frontend/components/ui/Alert.jsx` — komponen alert sukses/error/info.
- `frontend/components/ui/Spinner.jsx` — indikator loading.
- `frontend/public/*` — aset statis (ikon, ilustrasi, logo, svg bawaan Next/Vercel).

### Smart Contracts (Solidity)
- `contracts/Escrow.sol` — kontrak escrow USDT dengan status lifecycle, fee dinamis, integrasi staking & adapter arbitrase.
- `contracts/EscrowFactory.sol` — factory membuat instance Escrow & menyimpan mapping orderId → alamat escrow.
- `contracts/FeeLogic.sol` — logika fee bps berdasar volume seller + accrual volume.
- `contracts/Staking.sol` — mekanisme staking sederhana (stake/unstake) dengan minimum stake & penarikan.
- `contracts/ArbitrationAdapter.sol` — adapter untuk eksekusi resolusi arbitrase ke kontrak Escrow.
- `contracts/interfaces/AggregatorV3Interface.sol` — interface Chainlink aggregator (digunakan pada FeeLogic/Adapter).

## North Star Doc
- **Misi Produk**: Menjadi platform komunitas terintegrasi yang menggabungkan forum, marketplace escrow, dan utilitas AI/RAG untuk konten komunitas dengan pengalaman login sederhana via email/password.
- **Sasaran 6–12 bulan**:
  - Transaksi marketplace on-chain → off-chain status sinkron otomatis; tidak ada tindakan manual admin untuk release/refund.
  - Pencarian & rekomendasi AI (RAG) menyediakan jawaban dengan sumber akurat <2 detik median latency.
  - Profil pengguna kaya (avatar, sosial, badge) yang konsisten antara web & data on-chain (saldo/stake) dengan downtime <0.5%.
- **Prinsip Desain**: keamanan token/JWT, keandalan worker event-driven, DX front-backend konsisten (schema dto), dan auditabilitas on-chain/off-chain.
- **Key Metrics**: success rate login OAuth, rata-rata waktu respon RAG, conversion rate escrow selesai tanpa sengketa, error rate worker sinkronisasi, dan waktu deploy ke produksi.
- **Peta Evolusi**: mulai dari skeleton order/dispute → tambahkan listener on-chain + notifikasi; AI search berbasis konten thread aktual; front-end mengonsumsi API nyata; penguatan integrasi staking/fee di UI.

## To-Do / Next Steps
- **Backend**
  - Lengkapi implementasi order/dispute + koneksi ke event on-chain di `worker/event_worker.go`.
  - Tambah endpoint detail thread publik (`/threads/:id` tanpa auth) agar link front-end tidak memerlukan token.
  - Validasi input & rate limiting untuk endpoint RAG serta transfer saldo.
  - Sediakan dokumentasi env (.env.example) untuk konfigurasi database, Cohere, dan JWT/HD wallet.
- **Frontend**
  - Hubungkan halaman thread, AI search, refill, dan transfer dengan API produksi (ganti placeholder/dummy data).
  - Tambahkan halaman detail thread & komponen list yang membaca konten `ContentJSON` (table/section) dari backend.
  - Integrasikan notifikasi sukses/error yang konsisten di seluruh form (akun, transfer, badge).
- **Smart Contract**
  - Tambahkan pengamanan reentrancy & alamat sink biaya yang nyata pada `Escrow.sol`.
  - Unit test untuk FeeLogic/Staking/EscrowFactory agar alur fee & staking tervalidasi.
- **Ops & Observability**
  - Tambahkan log/metric untuk worker deposit/transfer (Prometheus/OpenTelemetry) dan healthcheck endpoint.
  - Siapkan pipeline CI lint/test untuk Go, Next.js, dan Solidity (Foundry/Hardhat).

## Catatan Tambahan
- File README lama di frontend dihapus karena sudah tidak relevan; dokumentasi digantikan oleh dokumen ini.
- Node_modules tidak didokumentasi per file; gunakan package-lock untuk melihat dependensi runtime.

## What changed
- Mengganti OAuth GitHub dengan autentikasi email + password lengkap dengan hash bcrypt, JWT, dan token verifikasi email yang disimpan di database.
- Menambahkan halaman UI login, register, dan verifikasi email bergaya GitHub serta memastikan helper `getApiBase` dipakai konsisten untuk memanggil API.
- Membersihkan rujukan GitHub lama dan menambah limiter sederhana untuk endpoint sensitif.

## Next steps
- Tambah delivery email sebenarnya (SMTP/provider) dan ganti log link dev dengan pengiriman email produksi.
- Perluas cakupan tes otomatis (Go/Next) agar flow register → verifikasi → login tetap terjaga.
- Audit user lama (hasil OAuth) untuk migrasi password/username agar bisa login via email.
