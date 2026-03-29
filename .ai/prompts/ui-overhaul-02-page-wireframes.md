# Follow-Up #2: Page-by-Page Redesign Wireframes

> Blueprint detail untuk redesign setiap halaman. Gunakan bersama prompt utama
> `.ai/prompts/ui-overhaul.md` dan component specs `ui-overhaul-01-component-specs.md`.

---

## PRINSIP REDESIGN

1. **Setiap halaman harus masuk ke salah satu template** (A-F dari prompt utama)
2. **Konsistensi antar halaman lebih penting dari keunikan per halaman**
3. **Redesign = structure + hierarchy + spacing + details**, BUKAN "ganti warna"
4. **Mobile-first**: wireframe mobile dulu, lalu scale up

---

## HALAMAN 1: Homepage (`/`)
**Template:** A (Landing/Marketing)

### Structure
```
┌─────────────────────────────────────────────────┐
│ HEADER (sticky, backdrop-blur)                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ HERO SECTION                                    │
│ ┌─ Badge pill (brand tagline)                   │
│ ├─ h1: Headline (2 lines max)                   │
│ ├─ Subtitle (1-2 sentences)                     │
│ ├─ CTA Button (primary, large)                  │
│ └─ Social proof: "X case tervalidasi"           │
│                                                 │
│ ── Separator ──                                 │
│                                                 │
│ HOW IT WORKS (3 steps)                          │
│ ┌───┐  ┌───┐  ┌───┐                            │
│ │ 1 │──│ 2 │──│ 3 │  (connected by line)        │
│ └───┘  └───┘  └───┘                            │
│                                                 │
│ ── Separator ──                                 │
│                                                 │
│ FOCUS AREAS (kategori validasi)                 │
│ Grid 2x3 cards, icon + title + desc             │
│                                                 │
│ ── Separator ──                                 │
│                                                 │
│ LATEST CASES (6 cards)                          │
│ Grid 1→2→3 responsive                          │
│ + "Lihat semua" link                            │
│                                                 │
│ ── Separator ──                                 │
│                                                 │
│ TRUST SECTION (BARU)                            │
│ Stats: jumlah validator, case selesai, dll      │
│                                                 │
├─────────────────────────────────────────────────┤
│ FOOTER                                          │
└─────────────────────────────────────────────────┘
```

### Perubahan dari Current
```
HAPUS:
- Rainbow gradient di hero → ganti monochrome gradient (primary → primary/40)
- Rainbow-border pada badge pill → ganti subtle border + bg-muted
- Rainbow connecting line → ganti solid primary/20 line

TAMBAH:
- Social proof di bawah CTA ("500+ case tervalidasi oleh 120+ validator ahli")
- Trust section sebelum footer (stats cards)
- Micro-animation pada scroll (section fade-in, bukan parallax)

UBAH:
- Hero heading: lebih pendek, lebih impactful (1 line if possible)
- CTA: "Lihat Daftar Case" → "Mulai Validasi" (lebih action-oriented)
- Step numbers: ganti rainbow-border → bg-primary text-primary-foreground solid circles
```

---

## HALAMAN 2: Login (`/login`)
**Template:** D (Form/Action)

### Structure
```
┌─────────────────────────────────────────────────┐
│ HEADER (minimal: logo + kembali)                │
├─────────────────────────────────────────────────┤
│                                                 │
│     ┌─── max-w-md ──────────────────┐           │
│     │                                │           │
│     │  Logo (glyph, centered)        │           │
│     │  h1: "Masuk ke AIValid"        │           │
│     │  subtitle: "Belum punya akun?" │           │
│     │            [link: Daftar]       │           │
│     │                                │           │
│     │  ┌─ Email input ─────────┐     │           │
│     │  └───────────────────────┘     │           │
│     │  ┌─ Password input ──────┐     │           │
│     │  └───────────────────────┘     │           │
│     │  [Lupa password?]    (right)   │           │
│     │                                │           │
│     │  ┌─ Button: Masuk (full-w) ─┐  │           │
│     │  └──────────────────────────┘  │           │
│     │                                │           │
│     │  ─── atau ───                  │           │
│     │                                │           │
│     │  [Passkey login button]        │           │
│     │                                │           │
│     └────────────────────────────────┘           │
│                                                 │
├─────────────────────────────────────────────────┤
│ FOOTER (minimal)                                │
└─────────────────────────────────────────────────┘
```

### Design Notes
```
- Background: subtle dot pattern (sama seperti hero) untuk texture
- Card: TIDAK ada card wrapper — form langsung di halaman (lebih clean)
- Vertical centering: min-h-[calc(100vh-header-footer)] flex items-center
- Password input: toggle show/hide icon
- Error: inline di bawah field, bukan alert box di atas
- Loading: button spinner, disabled semua fields
```

---

## HALAMAN 3: Register (`/register`)
**Template:** D (Form/Action)

### Sama dengan Login, tapi:
```
- h1: "Buat Akun AIValid"
- Fields: Email, Username, Password, Confirm Password
- Checkbox: "Saya setuju dengan [Syarat & Ketentuan] dan [Kebijakan Privasi]"
- CTA: "Daftar"
- Alt: "Sudah punya akun? [Masuk]"
- Password strength indicator (Progress component)
```

---

## HALAMAN 4: Validation Cases List (`/validation-cases`)
**Template:** B (List/Browse)

### Structure
```
┌─────────────────────────────────────────────────┐
│ HEADER                                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ PAGE HEADER                                     │
│ h1: "Case Validasi"                             │
│ subtitle: "Temukan case yang sesuai keahlianmu" │
│                                                 │
│ FILTER BAR                                      │
│ ┌──────┬──────┬──────┬─────────────────┐        │
│ │ All  │ Open │ Done │ [Search input]  │        │
│ └──────┴──────┴──────┴─────────────────┘        │
│ ┌─ Kategori ─┐  ┌─ Sort ──────┐  [+ Buat Case] │
│ └────────────┘  └─────────────┘                 │
│                                                 │
│ CASE GRID (responsive)                          │
│ ┌────────┐  ┌────────┐  ┌────────┐              │
│ │ Case 1 │  │ Case 2 │  │ Case 3 │              │
│ ├────────┤  ├────────┤  ├────────┤              │
│ │ Case 4 │  │ Case 5 │  │ Case 6 │              │
│ └────────┘  └────────┘  └────────┘              │
│                                                 │
│ PAGINATION                                      │
│ ← 1 2 3 ... 12 →                               │
│                                                 │
├─────────────────────────────────────────────────┤
│ FOOTER                                          │
└─────────────────────────────────────────────────┘
```

### Case Card Anatomy
```
┌─────────────────────────────┐
│ [Category badge]  [Status]  │
│                             │
│ Case Title (text-lg, bold)  │
│ Preview text (2 lines max,  │
│ text-sm, muted)             │
│                             │
│ ──────────────────────────  │
│ 💰 Rp XX.XXX  │  👤 N/M    │
│ Bounty         │ Validators │
│ ⏰ 3 hari lalu              │
└─────────────────────────────┘

- Hover: shadow-sm, -translate-y-0.5, border-foreground/10
- Click: navigasi ke detail
- Status badge: warna sesuai status (open=info, in-review=warning, done=success)
```

---

## HALAMAN 5: Case Detail (`/validation-cases/[id]`)
**Template:** C (Detail)

### Structure
```
┌─────────────────────────────────────────────────┐
│ HEADER                                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ Breadcrumb: Beranda / Case Validasi / [Title]   │
│                                                 │
│ PAGE HEADER                                     │
│ ┌───────────────────────────────────────────┐   │
│ │ [Category badge]  [Status badge]          │   │
│ │                                           │   │
│ │ h1: Case Title                            │   │
│ │ Oleh: [Avatar] Username · 3 hari lalu     │   │
│ │                                           │   │
│ │ ┌─ Bounty ─┐  ┌─ Validators ─┐  [CTA]   │   │
│ │ │ Rp XX.XX │  │ 2 dari 5     │  [Submit] │   │
│ │ └──────────┘  └──────────────┘           │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ TABS                                            │
│ ┌──────────┬──────────┬──────────┐              │
│ │Deskripsi │Submission│ Riwayat  │              │
│ └──────────┴──────────┴──────────┘              │
│                                                 │
│ TAB CONTENT                                     │
│ (Markdown rendered content / submission list    │
│  / activity timeline)                           │
│                                                 │
│ SIDEBAR (desktop: 2-column layout)              │
│ ┌────────────────────────────────┐              │
│ │ Info Card:                     │              │
│ │ - Kategori                     │              │
│ │ - Deadline                     │              │
│ │ - Bounty                       │              │
│ │ - Confidence threshold         │              │
│ │ - Tags                         │              │
│ └────────────────────────────────┘              │
│                                                 │
├─────────────────────────────────────────────────┤
│ FOOTER                                          │
└─────────────────────────────────────────────────┘
```

### Layout Note
```
Desktop (lg+): 2 kolom — content (2/3) + sidebar (1/3)
Mobile: single column, sidebar di bawah content
Gunakan: grid lg:grid-cols-[1fr_320px] gap-8
```

---

## HALAMAN 6: Account Dashboard (`/account`)
**Template:** E (Dashboard)

### Structure
```
┌─────────────────────────────────────────────────┐
│ HEADER                                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ ACCOUNT LAYOUT (sidebar + content)              │
│ ┌──────────┬────────────────────────────────┐   │
│ │ SIDEBAR  │  CONTENT                       │   │
│ │          │                                │   │
│ │ 👤 User  │  WELCOME CARD                  │   │
│ │ ──────── │  "Selamat datang, [Name]"      │   │
│ │ Akun     │  Last login: ...               │   │
│ │ Keamanan │                                │   │
│ │ Dompet   │  STATS ROW                     │   │
│ │ Pembelian│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │   │
│ │ Case Saya│  │Saldo│ │Case│ │Val.│ │Badge│ │   │
│ │          │  └────┘ └────┘ └────┘ └────┘  │   │
│ │          │                                │   │
│ │          │  RECENT ACTIVITY               │   │
│ │          │  Timeline of recent actions    │   │
│ │          │                                │   │
│ │          │  QUICK ACTIONS                 │   │
│ │          │  [Buat Case] [Setor Dana]      │   │
│ └──────────┴────────────────────────────────┘   │
│                                                 │
├─────────────────────────────────────────────────┤
│ FOOTER                                          │
└─────────────────────────────────────────────────┘
```

### Sidebar Note
```
Desktop (md+): fixed sidebar kiri, 220px wide
Mobile: horizontal scroll tabs atau bottom nav di bawah welcome card

Sidebar items:
- Profil saya (icon: User)
- Keamanan (icon: Shield)
- Dompet (icon: Wallet)
- Pembelian (icon: ShoppingBag)
- Case saya (icon: FileCheck)

Active: bg-accent text-foreground font-medium rounded-lg
Hover: bg-accent/50
```

---

## HALAMAN 7: Admin Dashboard (`/admin`)
**Template:** E (Dashboard) — wider layout

### Structure
```
┌─────────────────────────────────────────────────────┐
│ HEADER (admin variant: badge "Admin")               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ max-w-7xl                                           │
│                                                     │
│ PAGE HEADER                                         │
│ h1: "Dashboard Admin"                               │
│                                                     │
│ STATS ROW (4 cards)                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│ │ Total    │ │ Active   │ │ Revenue  │ │ Pending │ │
│ │ Users    │ │ Cases    │ │ (month)  │ │ Disputes│ │
│ │ 1,234    │ │ 56       │ │ Rp 12.5M │ │ 3       │ │
│ │ +12% ↑   │ │ +5% ↑    │ │ +8% ↑    │ │ -2 ↓    │ │
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│                                                     │
│ CONTENT GRID (2 columns)                            │
│ ┌─────────────────────┬─────────────────────┐       │
│ │ RECENT USERS        │ PENDING ACTIONS     │       │
│ │ (table: 5 rows)     │ (list: disputes,    │       │
│ │                     │  warnings, etc.)    │       │
│ │ [Lihat semua →]     │ [Lihat semua →]     │       │
│ └─────────────────────┴─────────────────────┘       │
│                                                     │
│ ┌─────────────────────┬─────────────────────┐       │
│ │ RECENT CASES        │ SYSTEM STATUS       │       │
│ │ (table: 5 rows)     │ Backend: ✅ OK      │       │
│ │                     │ Feature: ✅ OK      │       │
│ │ [Lihat semua →]     │ Browser: ✅ OK      │       │
│ └─────────────────────┴─────────────────────┘       │
│                                                     │
├─────────────────────────────────────────────────────┤
│ FOOTER                                              │
└─────────────────────────────────────────────────────┘
```

### Design Notes
```
- Stats cards: border-l-4 border-primary (atau per-status color) untuk visual weight
- Trend indicators: ↑ text-success, ↓ text-destructive
- Tables: compact, text-sm, hover rows
- Quick links: icon + label, hover:bg-accent
- JANGAN tampilkan semua data — dashboard = summary, link ke detail pages
```

---

## HALAMAN 8: Marketplace (`/market/chatgpt`)
**Template:** B (List/Browse)

### Similar to Validation Cases List, but:
```
- Card focus pada produk/listing
- Card anatomy: Image/icon + Title + Price + Seller + Rating
- Filter: kategori produk, range harga, sort
- CTA per card: "Beli" atau "Lihat Detail"
```

---

## HALAMAN 9: Wallet (`/account/wallet`)
**Template:** E (Dashboard) + F (Settings hybrid)

### Structure
```
BALANCE CARD (prominent, full-width)
┌─────────────────────────────────────────┐
│ Saldo Tersedia                          │
│ Rp 250.000 (text-3xl, font-mono, bold)  │
│                                         │
│ [Setor Dana]  [Tarik Dana]  [Kirim]     │
└─────────────────────────────────────────┘

RECENT TRANSACTIONS (table/list)
┌─────────────────────────────────────────┐
│ Hari ini                                │
│ ├─ Bounty diterima  +Rp 50.000  ✅     │
│ ├─ Penarikan        -Rp 100.000 ⏳     │
│                                         │
│ Kemarin                                 │
│ ├─ Setoran          +Rp 200.000 ✅     │
│ └─ Biaya layanan    -Rp 2.500   ✅     │
│                                         │
│ [Lihat semua transaksi →]               │
└─────────────────────────────────────────┘
```

### Design Notes
```
- Balance: font-mono untuk angka (precision feel)
- Transaksi positif: text-success, negatif: text-destructive
- Group by date dengan Separator + date label
- Status icons: ✅ selesai, ⏳ pending, ❌ gagal
- Mobile: buttons stack vertical di balance card
```

---

## HALAMAN 10: User Profile (`/user/[username]`)
**Template:** C (Detail)

### Structure
```
┌─────────────────────────────────────────┐
│ PROFILE HEADER                          │
│ ┌──────┐                                │
│ │Avatar│  Username (+ badges)           │
│ │ 80px │  Bio / deskripsi singkat       │
│ └──────┘  Bergabung: Jan 2025           │
│           [Follow] [Message]            │
└─────────────────────────────────────────┘

STATS ROW
┌──────────┬──────────┬──────────┐
│ 12 Case  │ 45 Val.  │ 98% Rate │
│ Dibuat   │ Selesai  │ Approval │
└──────────┴──────────┴──────────┘

TABS
┌──────────┬──────────┬──────────┐
│Case Aktif│ Badges   │ Aktivitas│
└──────────┴──────────┴──────────┘

TAB CONTENT
(Case cards / Badge grid / Activity timeline)
```

---

## HALAMAN 11: Cloud Browser (`/cloud-browser`)
**Template:** B (List/Browse) + custom

```
PAGE HEADER
h1: "Smart Browser"
subtitle: "Browser cloud anti-detect untuk kebutuhan profesional"

ACTIVE SESSIONS (if any)
┌─────────────────────────────────────────┐
│ ⚡ Sesi Aktif                           │
│ ┌──────────────────────┐                │
│ │ Session #ABC123      │ [Buka] [Stop]  │
│ │ Running 15 menit     │                │
│ │ Saldo tersisa: Rp... │                │
│ └──────────────────────┘                │
└─────────────────────────────────────────┘

BROWSER PROFILES (grid)
┌────────┐  ┌────────┐  ┌────────┐
│Profile1│  │Profile2│  │+ Baru  │
│Chrome  │  │Firefox │  │        │
│[Start] │  │[Start] │  │        │
└────────┘  └────────┘  └────────┘

PRICING INFO
Rp X/menit · Saldo minimum: Rp Y
```

---

## HALAMAN 12: Error Pages

### 404 (sudah bagus, tweak saja):
```
- Ganti rainbow elements → monochrome primary gradient
- Pertahankan animasi (sudah excellent)
- Pertahankan search bar dan popular links
```

### Error Page:
```
- Ganti "Something went wrong" → "Terjadi kesalahan" (Indonesian!)
- Icon: warning triangle, lebih besar (48px)
- Tambah error code jika tersedia
- CTA: "Coba lagi" (primary) + "Kembali ke beranda" (outline)
```

---

## CATATAN UMUM UNTUK SEMUA HALAMAN

```
1. Setiap halaman HARUS punya:
   □ <title> yang deskriptif dan unik
   □ meta description
   □ Breadcrumb (jika depth > 1)
   □ Loading state (skeleton)
   □ Error state
   □ Empty state (jika applicable)
   □ h1 yang jelas (tepat 1)

2. Spacing rhythm:
   □ Page padding: py-8 sm:py-12
   □ Section gap: space-y-12
   □ Card gap: gap-4 sm:gap-6
   □ Content vs sidebar gap: gap-8

3. Mobile adaptations:
   □ Tables → card view
   □ Side-by-side → stacked
   □ Sidebar → tabs atau accordion
   □ Large headings → smaller (text-2xl max)
```

---

*Prompt ini adalah blueprint untuk setiap halaman. AI assistant harus mereferensi ini
saat redesign halaman spesifik, bersama dengan prompt utama dan component specs.*
