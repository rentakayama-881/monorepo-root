# Tags Taxonomy (Harvard-style)

Dokumen ini mendefinisikan sistem tags untuk Validation Case (validasi hasil kerja AI) agar:

- **Separable untuk filter** (tidak tumpang tindih antar dimensi)
- **Jumlah wajar** (target total 12–24 tags)
- **Pemilihan sederhana** (target 2–4 tags per Validation Case)
- **Modern & konsisten** (icon modern, warna mengikuti theme `globals.css`)

## 1) Dimensi (jangan dicampur)

Sistem ini memisahkan tags ke 4 dimensi. Dimensi dikodekan lewat prefix pada `slug`:

- `artifact-*` → **jenis artefak/output** (apa yang dihasilkan)
- `stage-*` → **tahap kerja** (status proses)
- `domain-*` → **domain teknis** (area kerja)
- `evidence-*` → **validasi/evidence** (kekuatan bukti)

Tujuan prefix: filter jadi “separable” dan tidak bocor definisinya.

## 2) Aturan pemilihan tags (Create Validation Case)

Aturan (frontend, saat tags tersedia dari API):

- **Minimal 2 tags**
- **Maksimal 4 tags**
- **Single-per-dimension** untuk tag yang punya prefix di atas (contoh: hanya 1 `domain-*` per Validation Case)

Rasional singkat:

- 2 tags minimum mencegah kasus “tanpa metadata” sehingga filter tidak efektif.
- 4 tags maksimum menahan ledakan kombinasi & noise.
- Single-per-dimension menjaga separability (tidak ada 2 domain sekaligus).

## 3) Katalog tags

Format: **Nama (1–2 kata)**, deskripsi 1 kalimat, rule, contoh cocok/tidak.

### Artifact (Output)

| Slug | Name | Deskripsi | Rule (kapan dipakai) | Contoh cocok | Contoh tidak cocok |
|---|---|---|---|---|---|
| `artifact-specification` | Specification | Kebutuhan/kontrak output: scope, acceptance criteria, API/UX spec. | Validation Case record berisi spesifikasi/requirements. | “Tolong validasi spec API escrow v2” | “Bug button login tidak bisa klik” |
| `artifact-patch` | Patch | Perubahan kecil untuk memperbaiki bug/behavior spesifik. | Ada perubahan kecil yang bisa diterapkan segera. | “Fix null pointer di handler X” | “Rombak arsitektur auth total” |
| `artifact-refactor` | Refactor | Perubahan struktur internal tanpa mengubah output fungsional utama. | Fokus pada maintainability, bukan fitur baru. | “Refactor hook autosave agar aman” | “Tambah fitur baru pembayaran” |
| `artifact-deployment` | Deployment | Rilis, konfigurasi, atau perubahan infra untuk deploy. | Berkaitan dengan deploy/release/config prod. | “Set env vars, rollout, dan rollback plan” | “Desain UI tag pills” |
| `artifact-incident` | Incident | Gangguan produksi: outage, degradation, atau bug kritikal. | Ada issue prod: impact, timeline, mitigasi. | “Incident report 502 spike” | “Permintaan review style guide” |
| `artifact-review` | Review | Review kode/arsitektur/PR untuk validasi kualitas. | Tujuan utamanya evaluasi kualitas/keputusan teknis. | “Review perubahan rate limit auth” | “Write-only dokumentasi FAQ” |
| `artifact-documentation` | Documentation | Dokumentasi, guide, atau runbook. | Output utama adalah doc. | “Runbook: rotate secrets” | “Benchmark query untuk index” |
| `artifact-benchmark` | Benchmark | Pengukuran performa: latency, throughput, load test. | Ada metrik & cara ukur. | “Benchmark endpoint /api/validation-cases” | “Diskusi umum tanpa data” |

### Stage (Workflow)

| Slug | Name | Deskripsi | Rule (kapan dipakai) | Contoh cocok | Contoh tidak cocok |
|---|---|---|---|---|---|
| `stage-draft` | Draft | Masih eksplorasi; detail bisa berubah. | Masih merumuskan masalah/solusi. | “Draft taksonomi tags v1” | “Patch siap merge” |
| `stage-in-progress` | In Progress | Sedang dikerjakan; butuh feedback parsial. | Ada progres, belum siap final review. | “WIP UI filter tags” | “Incident sudah resolved” |
| `stage-blocked` | Blocked | Terhenti karena dependency/akses/clarification. | Ada blocker jelas. | “Blocked karena DB migration belum siap” | “Kasus selesai dengan bukti” |
| `stage-ready` | Ready | Siap divalidasi/review; informasi sudah cukup. | Semua konteks tersedia untuk validasi. | “Siap review: PR + test steps” | “Masih brainstorming” |

### Domain

| Slug | Name | Deskripsi | Rule (kapan dipakai) | Contoh cocok | Contoh tidak cocok |
|---|---|---|---|---|---|
| `domain-frontend` | Frontend | UI, UX, accessibility, performance client. | Problem utama di client/UI. | “Line-clamp & responsive cards” | “Indexing Postgres” |
| `domain-backend` | Backend | API, business logic, server runtime. | Problem utama di server/API. | “Validasi handler tags” | “Design button spacing” |
| `domain-devops` | DevOps | CI/CD, infra, observability, ops. | Infra/release/ops. | “Nginx config, rate limits” | “Refactor komponen React” |
| `domain-database` | Database | Schema, query, indexing, migrations. | DB query/migration/index. | “Tambah index tags join table” | “Update copywriting UI” |
| `domain-security` | Security | AuthZ/AuthN, exploit, hardening, threat model. | Ada aspek security utama. | “Audit token refresh flow” | “Tutorial markdown editor” |
| `domain-auth` | Auth | Login, session, JWT, passkey, MFA. | Fokus utama auth/session. | “Fix refresh token race” | “Performance list cases” |

### Evidence / Validation

| Slug | Name | Deskripsi | Rule (kapan dipakai) | Contoh cocok | Contoh tidak cocok |
|---|---|---|---|---|---|
| `evidence-needs-verification` | Needs Verification | Belum ada bukti kuat; perlu cek ulang/eksperimen. | Klaim masih asumsi. | “Perlu reproduce dulu” | “Ada test case & hasil” |
| `evidence-verified` | Verified | Ada bukti/hasil uji; klaim sudah tervalidasi. | Ada evidence (log/test/video/hasil). | “Fix verified by test” | “Belum dicoba” |
| `evidence-reproducible` | Reproducible | Ada langkah reproducible (steps) / test case. | Ada steps jelas untuk reproduce/verify. | “Steps 1–3 reproduce bug” | “Hanya opini” |
| `evidence-regression` | Regression | Perubahan memicu/mencegah regresi; perlu test coverage. | Ada risiko regresi / perlu coverage. | “Tambah test untuk bug ini” | “Perubahan copy text” |

## 4) Mapping tags lama → baru (seed legacy)

Seed lama (marketplace/community) dianggap **legacy** dan akan dinonaktifkan oleh `backend/cmd/seed_tags`.

| Legacy slug | Status |
|---|---|
| `service` | Retired (tidak kompatibel dengan dimensi baru) |
| `selling` | Retired |
| `looking` | Retired |
| `hiring` | Retired |
| `collaboration` | Retired |
| `question` | Retired |
| `discussion` | Retired |
| `announcement` | Retired |
| `tutorial` | Retired |
| `showcase` | Retired |

Catatan: mapping “deterministik” tidak dibuat karena legacy tags tidak separable terhadap dimensi artifact/stage/domain/evidence.

## 5) Strategi migrasi data (DB)

1) Jalankan seed taxonomy (idempotent):
   - `cd backend && go run ./cmd/seed_tags`
   - Opsional (hard delete legacy tags, berisiko): `cd backend && go run ./cmd/seed_tags --delete-legacy`
2) Setelah legacy tags dinonaktifkan, backend hanya mengembalikan **active tags** pada response validation case list/detail (jadi legacy tidak tampil di UI).
3) Retag validation cases yang penting:
   - User bisa edit tags via halaman `My Validation Cases`.
   - Untuk retag massal, rekomendasi: buat script/command terpisah berbasis mapping manual per kategori (bukan otomatis “asal map”).
