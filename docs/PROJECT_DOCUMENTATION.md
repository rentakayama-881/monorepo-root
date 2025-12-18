# Dokumentasi Monorepo

Dokumen ini merangkum struktur dan arsitektur saat ini serta daftar tugas lanjutan untuk monorepo ini. Fokusnya mencakup tiga pilar utama: backend Go, frontend Next.js, dan smart contract Solidity. Visi jangka panjang diurai terpisah pada `docs/NORTH_STAR.md` sebagai sumber kebenaran tunggal.

## Arsitektur Saat Ini
- **Lapisan backend**: REST API berbasis Gin dengan middleware JWT, autentikasi email+password (bcrypt), serta modul RAG yang memakai Cohere dan PostgreSQL/pgvector. Worker on-chain (`backend/worker/event_worker.go`) memakai `RPC_URL` + tabel `chain_cursors` untuk memproses event `EscrowDeployed` (factory) dan `Funded/Delivered/DisputeOpened/Resolved/Refunded/Released` (escrow) lalu memperbarui status order (created → deployed → funded/delivered/disputed → resolved/refunded/released). Fitur saldo/refill/transfer kustodian dihapus.
- **Lapisan frontend**: Aplikasi Next.js (app router) dengan komponen UI kustom, halaman otentikasi, akun, badge, AI search, serta alur escrow. Header dan sidebar berbagi daftar kategori yang konsisten dengan backend; header memantau event `auth:changed` agar status login sinkron antar tab. Panel profil tidak menampilkan saldo; alur `/orders/new` dan `/orders/[orderId]` menampilkan state escrow end-to-end.
- **Lapisan kontrak**: Kumpulan smart contract (Escrow, EscrowFactory, FeeLogic, Staking, ArbitrationAdapter) yang mengelola escrow USDT, fee dinamis, staking, serta adapter arbitrase untuk alur non-kustodian.
- **Alur escrow (MVP)**: backend signer menandatangani tuple `(orderId, buyer, seller, amountUSDT, chainId, factoryAddress)` menggunakan prefiks EIP-191; `EscrowFactory` memverifikasi signature dan menerbitkan event `EscrowDeployed(bytes32 orderId, address escrow, address buyer, address seller, uint256 amountUSDT)`; frontend `/orders/new` memakai signature itu untuk mengirim tx `deployEscrow` dan menyimpan tx hash + alamat escrow via endpoint `POST /api/orders/:orderId/attach`.
- **Alur data utama**:
  1. Pengguna daftar/login dengan email+password → backend membuat JWT → frontend menyimpan token untuk memanggil API; verifikasi email menggunakan token yang dicetak di log server/dev.
  2. Thread & user API memakai PostgreSQL melalui GORM; konten thread dapat diindeks ke pgvector lewat endpoint RAG.
  3. Marketplace/escrow disiapkan melalui kombinasi backend (order/dispute records) dan smart contract untuk eksekusi dana; pemantauan saldo/refill off-chain tidak digunakan lagi.

## Peta File
Rangkuman per file di seluruh repo (kecuali dependensi vendored/node_modules).

### Akar Repo
- `backend/` — layanan API Go.
- `frontend/` — aplikasi Next.js & asset publik.
- `contracts/` — smart contract Solidity.

### Backend (Go)
- `backend/main.go` — entrypoint server Gin: memuat env, inisialisasi DB/config, konfigurasi CORS, static file `/static`, dan mendaftarkan semua grup route `/api` (auth/account/user/threads/disputes + order escrow non-kustodian).
- `backend/go.mod` / `backend/go.sum` — dependensi Go module.
- `backend/.gitignore` — pengecualian file build/env.
- `backend/config/config.go` — memuat konfigurasi JWT, chain_id, alamat factory, private key signer backend, serta `RPC_URL` untuk worker event on-chain.
- `backend/database/db.go` — koneksi PostgreSQL (DATABASE_URL/dsn), automigrate model, dan seeding kategori thread.
- (dihapus) `backend/database/deposit.go` — tidak ada lagi tabel/logic alamat deposit.
- `backend/dto/create_username.go` — payload pembuatan username baru.
- `backend/dto/create_thread.go` — payload membuat thread (title, category_id, content json, dsb.).
- `backend/dto/update_thread.go` — payload memperbarui thread (title/summary/content/meta).
- (dihapus) `backend/dto/transfer.go` — payload transfer saldo tidak lagi digunakan.
- `backend/handlers/account.go` — handler akun: ambil profil sendiri, update profil, ubah username (tanpa saldo), upload avatar, dan builder profil publik.
- `backend/handlers/badge_detail.go` — handler detail badge individual.
- `backend/handlers/badges.go` — handler daftar badge milik pengguna.
- (dihapus) `backend/handlers/balance.go` — info refill/alat deposit kustodian dihapus.
- `backend/handlers/orders.go` — endpoint order non-kustodian: generate orderId+signature backend (`POST /api/orders`), lampirkan escrow+tx hash (`POST /api/orders/:orderId/attach`), dan baca status.
- `backend/handlers/marketplace.go` — placeholder dispute/rate Chainlink lama.
- `backend/handlers/auth.go` — register/login/password bcrypt + verifikasi email (register, login, request/confirm token), tanpa OAuth.
- `backend/handlers/rag.go` — endpoint RAG: indeks teks panjang, indeks chunk, ask/answer QA, indeks thread by ID, debug chunk.
- `backend/handlers/threads.go` — handler kategori thread, thread per kategori, detail thread, membuat & memperbarui thread.
- (dihapus) `backend/handlers/transfer.go` — transfer saldo kustodian dihapus.
- `backend/handlers/user.go` — handler info user terautentikasi dan profil publik berdasar username.
- `backend/handlers/user_threads.go` — handler daftar thread per user (publik & milik sendiri).
- `backend/handlers/username.go` — handler pembuatan username satu kali setelah login.
- `backend/middleware/auth.go` — middleware JWT wajib untuk route yang membutuhkan autentikasi.
- `backend/middleware/auth_optional.go` — middleware JWT opsional (meneruskan context jika token ada).
- `backend/middleware/jwt.go` — helper parsing & validasi JWT token dari header Authorization.
- `backend/models/user.go` — model pengguna (email, username, avatar, profil & sosial sebagai JSON) tanpa field saldo.
- `backend/models/credential.go` — model kredensial terhubung ke user.
- `backend/models/thread.go` — model kategori & thread (JSON content/meta, relasi user/kategori).
- (dihapus) `backend/models/transfer.go` — tidak ada tabel transfer saldo.
- `backend/models/marketplace.go` — model order non-kustodian (order_id_hex, buyer_user_id nullable, buyer/seller wallet, amount_usdt minor unit, chain_id, escrow_address, tx_hash, status created/deployed/funded/delivered/disputed/resolved/refunded/released) plus dispute/promotion/volume ledger.
- `backend/models/cursor.go` — tabel `chain_cursors` untuk menyimpan block terakhir per chain/cursor yang telah diproses worker event.
- `backend/utils/chunker.go` — utilitas pemisah teks menjadi chunk untuk indeks RAG.
- `backend/utils/cohere.go` — client Cohere untuk pembuatan embedding teks.
- `backend/utils/cohere_rerank.go` — utilitas rerank hasil pencarian dengan Cohere.
- `backend/utils/cohere_chat.go` — helper panggil chat Cohere untuk jawaban RAG.
- `backend/utils/jsonflatten.go` — flatten konten JSON sebelum embedding.
- `backend/utils/pgvector.go` — helper koneksi pgvector/SQL untuk penyimpanan embedding & query similarity.
- (dihapus) `backend/utils/hdwallet.go` — tidak ada lagi alamat HD wallet kustodian.
- `backend/utils/rate.go` — kalkulasi rate berdasarkan data Chainlink (ETH-USD & IDR) dengan fallback default.
- `backend/worker/event_worker.go` — worker event-driven yang memfilter log EscrowFactory/Escrow, menjaga cursor block, dan memperbarui status order berdasarkan event on-chain.

### Frontend (Next.js)
- `frontend/.gitignore` — pengecualian build/node.
- `frontend/package.json` / `frontend/package-lock.json` — dependensi aplikasi Next.js.
- `frontend/jsconfig.json` — konfigurasi path alias/JS linting.
- `frontend/next.config.mjs` — konfigurasi Next.js (output, transpile, dsb.).
- `frontend/eslint.config.mjs` — aturan ESLint proyek.
- `frontend/postcss.config.mjs` — konfigurasi PostCSS/Tailwind import.
- `frontend/app/layout.js` — layout root, metadata situs, injeksi Header global & kontainer konten.
- `frontend/app/globals.css` — panduan desain/global style (variabel tema, utility class, komponen dasar) plus preset Tailwind v4 (`@plugin @tailwindcss/container-queries` & `@tailwindcss/typography`), outline-ring fokus aksesibel, serta penyesuaian preferensi warna gelap.
- `frontend/app/page.js` — landing page hero dengan fetch kategori + thread terbaru langsung dari API (revalidate 60s) serta link aturan.
- `frontend/app/orders/new/page.jsx` — alur MVP escrow: hubungkan wallet, minta backend membuat order + signature, kirim transaksi deployEscrow langsung via `window.ethereum`, POST attach ke backend, lalu redirect ke detail order.
- `frontend/app/orders/[orderId]/page.jsx` — halaman detail status escrow (order_id, tx_hash, escrow_address, buyer, seller, amount, chain_id) dengan fetch backend.
- `frontend/app/login/page.jsx` — halaman login email/password memakai helper `setToken` + redirect, dibungkus Suspense untuk penggunaan `useSearchParams`.
- `frontend/app/register/page.jsx` — form register email/password + opsi username awal; memunculkan token verifikasi dari respons dev.
- `frontend/app/verify-email/page.jsx` — form input token verifikasi + shortcut dari query string untuk menyelesaikan verifikasi email.
- `frontend/app/set-username/page.jsx` — form set username awal untuk akun yang belum memiliki username (legacy pasca-OAuth, tetap tersedia bila akun lama belum terisi).
- `frontend/components/ui/GridTileImage.jsx` / `frontend/components/ui/Label.jsx` — komponen kartu gambar dengan overlay label harga/keterangan (posisi bawah/center) dan efek hover interaktif.
- `frontend/app/account/page.jsx` — pengelolaan profil/username/avatar & sosial; fetch/update via API.
- `frontend/app/threads/page.jsx` — halaman client-side untuk membaca & mengedit thread milik pengguna yang login (memakai `/api/threads/me` dan detail `/api/threads/:id`).
- `frontend/app/ai-search/page.jsx` — form tanya-jawab AI yang memanggil endpoint RAG backend dan menampilkan sumber.
- `frontend/app/contact-support/page.jsx` — form laporan dukungan sederhana (tanpa alur saldo kustodian).
- `frontend/app/pengajuan-badge/page.jsx` — form pengajuan badge dengan field upload/link portofolio.
- `frontend/app/rules-content/page.jsx` — halaman aturan komunitas dan panduan posting.
- `frontend/app/about-content/page.jsx` — halaman statis tentang platform.
- `frontend/app/sync-token/page.jsx` & `frontend/app/sync-token/inner.jsx` — placeholder sinkronisasi token JWT/LS untuk navigasi aman.
- `frontend/app/favicon.ico` — ikon situs.
- `frontend/components/Header.js` — header global dengan navigasi, search bar, tombol login/logout, dan tombol toggle sidebar mobile.
- `frontend/components/Sidebar.js` — sidebar kategori/topik populer dengan pencarian & link navigasi.
- `frontend/components/ProfileSidebar.js` — panel profil ringkas untuk navigasi akun/thread tanpa saldo atau link refill/transfer.
- `frontend/components/ui/Button.jsx` — komponen tombol dengan varian (primary/ghost/outline) & state loading.
- `frontend/components/ui/Input.jsx` — input teks dengan label/helper/error state.
- `frontend/components/ui/Alert.jsx` — komponen alert sukses/error/info.
- `frontend/components/ui/Spinner.jsx` — indikator loading.
- `frontend/public/*` — aset statis (ikon, ilustrasi, logo, svg bawaan Next/Vercel).

#### Catatan UI (Gaya GitHub, fokus kejernihan)
- Aplikasi kini mengekspor metadata `viewport` eksplisit di `app/layout.js` untuk mencegah skala 980px bawaan browser mobile yang menyebabkan tampilan tampak memudar/blur di beberapa perangkat.
- `globals.css` diperketat: tipografi 15px, warna netral seperti GitHub, tombol/input/card seragam, fokus state terlihat, dan latar belakang abu terang agar konten tampak terangkat tanpa blur.
- Header, sidebar, serta halaman auth dipadatkan sehingga jarak dan ukuran font konsisten di seluruh alur (home, login/register, verifikasi email).

### Smart Contracts (Solidity)
- `contracts/Escrow.sol` — kontrak escrow USDT dengan status lifecycle, fee dinamis, integrasi staking & adapter arbitrase.
- `contracts/EscrowFactory.sol` — factory membuat instance Escrow & menyimpan mapping orderId → alamat escrow.
- `contracts/FeeLogic.sol` — logika fee bps berdasar volume seller + accrual volume.
- `contracts/Staking.sol` — mekanisme staking sederhana (stake/unstake) dengan minimum stake & penarikan.
- `contracts/ArbitrationAdapter.sol` — adapter untuk eksekusi resolusi arbitrase ke kontrak Escrow.
- `contracts/interfaces/AggregatorV3Interface.sol` — interface Chainlink aggregator (digunakan pada FeeLogic/Adapter).

## North Star
Detail visi dan target jangka menengah dipusatkan pada `docs/NORTH_STAR.md` agar tidak duplikasi dengan dokumen ini.

## To-Do / Next Steps
- **Backend**
  - Perkaya worker escrow dengan retry/backoff saat RPC gagal dan logging granular untuk event dispute/resolution.
  - Tambah endpoint detail thread publik (`/threads/:id` tanpa auth) agar link front-end tidak memerlukan token.
  - Dokumentasikan env (.env.example) end-to-end (JWT, signer key, `RPC_URL`, factory address, Cohere/DB) dan validasi input RAG.
- **Frontend**
  - Hubungkan halaman thread & AI search ke data backend aktual dengan state loading/error konsisten.
  - Tambah polling/refresh status di `/orders/[orderId]` dan CTA UI untuk aksi deliver/dispute ketika kontrak mendukung.
  - Samakan komponen notifikasi/sukses/error di form akun, escrow, badge.
- **Smart Contract**
  - Tambahkan pengamanan reentrancy & alamat sink biaya yang nyata pada `Escrow.sol`.
  - Unit test untuk FeeLogic/Staking/EscrowFactory agar alur fee & staking tervalidasi.
- **Ops & Observability**
  - Tambahkan log/metric untuk listener/event worker escrow on-chain (Prometheus/OpenTelemetry) dan healthcheck endpoint.
  - Siapkan pipeline CI lint/test untuk Go, Next.js, dan Solidity (Foundry/Hardhat).

## Catatan Tambahan
- File README lama di frontend dihapus karena sudah tidak relevan; dokumentasi digantikan oleh dokumen ini.
- Node_modules tidak didokumentasi per file; gunakan package-lock untuk melihat dependensi runtime.

## What changed
- Menambahkan worker sinkronisasi event EscrowFactory/Escrow dengan cursor block (`chain_cursors`) dan konfigurasi `RPC_URL` agar status order otomatis mengikuti event on-chain.
- Memperketat validasi order (alamat/amount/tx hash), menambah status lifecycle escrow, serta meluncurkan halaman `/orders/new` → `/orders/[orderId]` end-to-end.
- Menyelaraskan state auth di frontend (helper `auth.js`, Header listener, login Suspense) dan memperhalus form UI login/register.

## Next steps
- Tambah delivery email sebenarnya (SMTP/provider) dan ganti log link dev dengan pengiriman email produksi.
- Perluas cakupan tes otomatis (Go/Next) agar flow register → verifikasi → login serta alur escrow tetap terjaga.
- Tambah monitoring/alerting untuk worker event escrow dan UI aksi deliver/dispute ketika kontrak siap.
