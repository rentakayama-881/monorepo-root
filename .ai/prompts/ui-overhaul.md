# AIValid — UI/UX Total Overhaul: Master Prompt

> Prompt ini digunakan untuk menginstruksikan AI assistant melakukan total redesign UI/UX
> website AIValid agar setara kualitas visual perusahaan seperti neon.com, linear.app, vercel.com.
> Prompt ini BUKAN sekadar rules — ini adalah **design philosophy + implementation blueprint**.

---

## KONTEKS PROYEK

**AIValid** (aivalid.id) adalah platform validasi hasil kerja AI oleh ahli manusia — pertama di Indonesia. User mengirim hasil kerja AI (kode, riset, tugas kuliah, dokumen), validator ahli me-review dan memvalidasi, dan bounty otomatis diberikan ke validator terbaik.

**Tech Stack Frontend:**
- Next.js 16+ (App Router) + React 19
- Tailwind CSS v4 (OKLCH color space)
- IBM Plex Sans + IBM Plex Mono (self-hosted WOFF2)
- SWR untuk data fetching
- lucide-react untuk icons
- File extension: `.jsx`
- Bahasa user-facing: Indonesian (Bahasa Indonesia)

**Logo:** Geometric nested triangles (huruf "V" abstrak) — simbol validasi & presisi.

---

## BAGIAN 1: DESIGN PHILOSOPHY — "Precision Craft"

### 1.1 Core Identity

AIValid bukan sekadar "SaaS biru generik." AIValid adalah **platform presisi** — tempat di mana akurasi adalah segalanya. Visual language harus mencerminkan:

| Nilai | Manifestasi Visual |
|-------|-------------------|
| **Presisi** | Grid ketat, alignment sempurna, spacing konsisten ke pixel. Tidak ada yang "kira-kira". |
| **Kepercayaan** | Hierarchy jelas, informasi mudah di-scan, tidak ada ambiguitas visual. |
| **Keahlian** | Tipografi yang authoritative tapi approachable. Bukan corporate-stiff, bukan startup-playful. |
| **Indonesia Modern** | Warm undertone pada neutrals, tidak dingin. Terasa lokal tapi world-class. |

### 1.2 Visual Personality

Bayangkan AIValid sebagai **seorang arsitek muda Indonesia yang sangat detail-oriented**: rapi, modern, percaya diri, tapi tidak sombong. Tidak mencolok, tapi ketika kamu perhatikan detail-nya, kamu kagum.

**AIValid BUKAN:**
- ❌ Corporate boring (seperti dashboard enterprise 2015)
- ❌ Startup playful (terlalu banyak emoji, warna pastel, ilustrasi kartun)
- ❌ Developer-dark-mode-only (bukan terminal/hacker aesthetic)
- ❌ Template SaaS generik (biru + putih + card card card)

**AIValid ADALAH:**
- ✅ Clean tapi punya karakter (seperti Linear — minimal tapi memorable)
- ✅ Geometric & precise (inspired by logo triangle — angular, intentional)
- ✅ Warm neutral (bukan cool-gray yang dingin, tapi warm yang inviting)
- ✅ Confident whitespace (ruang kosong = kemewahan, bukan kemalasan)

### 1.3 The "Signature Moves"

Setiap website premium punya "signature moves" — elemen visual yang langsung dikenali. AIValid punya:

1. **Geometric Accent Lines** — Garis diagonal atau triangular yang muncul sebagai divider, decorative element, atau background pattern. Terinspirasi dari logo triangle.

2. **Precision Grid Dots** — Dot pattern halus (sudah ada di Hero) sebagai background texture signature. Scaling dan opacity harus konsisten.

3. **Gradient Philosophy** — BUKAN rainbow gradient generik. Gradient AIValid selalu dari `primary` ke satu accent color saja — controlled, intentional. Gradient = arah, bukan pesta warna.

4. **The Validation Mark** — Micro-element berupa small triangle/checkmark yang muncul di status badges, success states, dan completed items. Ini jadi visual shorthand untuk "tervalidasi."

5. **Depth Through Borders** — Daripada heavy shadows, AIValid menggunakan subtle borders + extremely soft shadows untuk depth. Ini memberikan look yang "engineered" bukan "designed."

---

## BAGIAN 2: COLOR SYSTEM — "Curated, Not Default"

### 2.1 Prinsip Warna

> **Rules:** Tidak ada warna yang muncul tanpa alasan. Setiap warna punya JOB DESCRIPTION.

**MASALAH SAAT INI:**
- Primary indigo (`oklch(0.4 0.09 279)`) terlalu generic — sama dengan setiap SaaS
- Rainbow gradient di Hero terlalu "trendy/AI-generated"
- Hardcoded hex values tersebar (`#26A17B`, `#6366f1`, `#3b82f6`)
- Warna accent tidak punya personality

### 2.2 Rekomendasi Palette

Pertahankan indigo sebagai foundation tapi beri **personality** melalui accent:

```
PRIMARY SPECTRUM:
- Primary: Deep Indigo (tetap — ini brand recognition)
- Primary accent: Warm violet/plum (shift hue sedikit ke arah warm, ~290-300)
  → Ini yang membedakan dari "generic indigo" — undertone warm.

NEUTRAL SPECTRUM:
- Warm neutrals (hue: 40-60 bukan 280)
  → Background bukan pure white/gray tapi ada warm cream undertone SANGAT HALUS
  → Dark mode: bukan pure black tapi deep warm charcoal

SEMANTIC:
- Success: Teal/emerald (bukan pure green — lebih sophisticated)
- Danger: Warm red (bukan neon red — punya depth)
- Warning: Amber (tetap)
- Info: Primary sendiri (indigo) — jangan tambah biru terpisah
```

### 2.3 Aturan Penggunaan Warna

| Konteks | LAKUKAN | JANGAN |
|---------|---------|--------|
| Background halaman | CSS var `bg-background` saja | Hardcode `bg-white` atau `bg-[#xxx]` |
| Text body | `text-foreground` | `text-gray-900` atau `text-black` |
| Subdued text | `text-muted-foreground` | `text-gray-500` atau custom opacity |
| Brand accent | `text-primary` atau `bg-primary` | Hex/rgb langsung |
| Status colors | `bg-status-success-bg` etc. | `bg-green-100` |
| Hover states | Token + `/90` opacity | Warna baru yang berbeda |
| Borders | `border-border` | `border-gray-200` |
| Gradient | `from-primary to-primary/40` (monochrome gradient) | Rainbow atau 3+ color gradient |

### 2.4 Zero Tolerance: Hardcoded Colors

```
AUDIT DAN HAPUS SEMUA:
- Hex values (#xxx) di className atau style
- rgb/hsl/oklch literal di komponen (kecuali globals.css)
- Tailwind color classes (text-gray-*, bg-blue-*, etc.)
- Semua `dark:` prefix — harus pakai CSS variables

KECUALI: Third-party brand colors (logo USDT, BNB, etc.) → pindahkan ke CSS variables:
--color-brand-usdt, --color-brand-bnb, dll.
```

---

## BAGIAN 3: TYPOGRAPHY — "One Scale to Rule Them All"

### 3.1 Masalah Saat Ini

- **DUA type scale** bersamaan: h1-h6 defaults + `.text-github-*` custom classes
- **10+ hardcoded sizes**: `text-[11px]`, `text-[10px]` tersebar di production
- Heading hierarchy tidak konsisten antar halaman
- Line-height tidak terkontrol

### 3.2 Type Scale (Wajib Diikuti)

Gunakan SATU scale berdasarkan rasio **Major Third (1.25)**:

| Token | Size | Weight | Usage | Line Height |
|-------|------|--------|-------|-------------|
| `text-xs` | 12px (0.75rem) | 400-500 | Caption, metadata, timestamp | 1.5 (18px) |
| `text-sm` | 14px (0.875rem) | 400-500 | Body kecil, table cells, labels | 1.5 (21px) |
| `text-base` | 16px (1rem) | 400 | Body text utama | 1.6 (25.6px) |
| `text-lg` | 18px (1.125rem) | 500-600 | Subheading, card titles | 1.5 (27px) |
| `text-xl` | 20px (1.25rem) | 600 | Section heading | 1.4 (28px) |
| `text-2xl` | 24px (1.5rem) | 600-700 | Page heading (mobile) | 1.3 (31.2px) |
| `text-3xl` | 30px (1.875rem) | 700 | Page heading (desktop) | 1.2 (36px) |
| `text-4xl` | 36px (2.25rem) | 700 | Hero heading (mobile) | 1.15 (41.4px) |
| `text-5xl` | 48px (3rem) | 700 | Hero heading (desktop) | 1.1 (52.8px) |

### 3.3 Aturan Tipografi

```
WAJIB:
1. HAPUS semua .text-github-* classes — tidak digunakan lagi
2. HAPUS semua text-[Npx] arbitrary values — gunakan scale di atas
3. Setiap halaman HARUS punya tepat SATU h1
4. Heading hierarchy: h1 → h2 → h3 (tidak boleh skip level)
5. Body text default: text-sm (14px) — mengikuti density modern apps
6. Font weight hierarchy: 700 (heading utama) → 600 (subheading) → 500 (emphasis) → 400 (body)
7. Letter spacing: tracking-tight untuk heading ≥ text-2xl, default untuk lainnya
8. text-balance untuk heading, text-pretty untuk paragraph panjang

JANGAN:
- Jangan campur text-sm dan text-base di satu konteks yang sama (misal: dua paragraf bersebelahan)
- Jangan gunakan font-bold (700) untuk body text — hanya heading
- Jangan gunakan text-xs untuk konten yang harus mudah dibaca — hanya metadata
```

### 3.4 Text Color Hierarchy

```
Level 1 (Paling penting): text-foreground        → Heading, primary content
Level 2 (Supporting):     text-foreground/80      → Secondary content, descriptions
Level 3 (Subdued):        text-muted-foreground   → Timestamps, captions, helper text
Level 4 (Decorative):     text-muted-foreground/60 → Placeholder, disabled text
```

---

## BAGIAN 4: SPACING SYSTEM — "The 4px Grid"

### 4.1 Base Unit: 4px

Semua spacing HARUS kelipatan 4px. Ini menciptakan rhythm visual yang konsisten.

```
ALLOWED SPACING VALUES (Tailwind):
0, 0.5(2px), 1(4px), 1.5(6px), 2(8px), 3(12px), 4(16px), 5(20px), 6(24px), 
8(32px), 10(40px), 12(48px), 14(56px), 16(64px), 20(80px), 24(96px)

TIDAK BOLEH: 
gap-2.5, gap-3.5, gap-4.5, gap-7, gap-9, gap-11, gap-13 
(bukan kelipatan 4px atau tidak ada di scale)
```

### 4.2 Spacing Recipes

| Konteks | Spacing | Tailwind |
|---------|---------|----------|
| **Page padding (mobile)** | 16px horizontal, 32px vertical | `px-4 py-8` |
| **Page padding (desktop)** | 24px horizontal, 48px vertical | `sm:px-6 sm:py-12` |
| **Section gap** | 48-64px | `space-y-12` atau `gap-12 lg:gap-16` |
| **Card padding** | 20-24px | `p-5` atau `p-6` |
| **Card gap (in grid)** | 16-24px | `gap-4` atau `gap-6` |
| **Form field gap** | 16-20px | `space-y-4` atau `space-y-5` |
| **Inline element gap** | 8-12px | `gap-2` atau `gap-3` |
| **Button padding** | 8px vertical, 16px horizontal | `px-4 py-2` |
| **Button padding (sm)** | 6px vertical, 12px horizontal | `px-3 py-1.5` |
| **Icon + text gap** | 8px | `gap-2` |
| **Label to input** | 6-8px | `space-y-1.5` atau `space-y-2` |

### 4.3 Container Width

```
STANDAR CONTAINER:
- Konten utama: max-w-6xl (72rem = 1152px) — SATU nilai konsisten
- Prose/article: max-w-3xl (48rem = 768px)  
- Auth forms: max-w-md (28rem = 448px)
- Admin dashboard: max-w-7xl (80rem = 1280px) — admin boleh lebih lebar
- Modal: max-w-md (kecil) | max-w-lg (medium) | max-w-2xl (besar)

CATATAN: Saat ini codebase mix max-w-4xl, 5xl, 6xl, 7xl secara random.
Standardisasi ke max-w-6xl untuk semua halaman user-facing.
```

---

## BAGIAN 5: COMPONENT DESIGN LANGUAGE

### 5.1 Prinsip Komponen

> Setiap komponen harus terasa seperti **satu keluarga**. Jika kamu lihat Button, Card, dan Input bersebelahan, mereka harus terasa "saudara" — bukan kumpulan elemen acak.

**Family Traits (harus ada di SEMUA komponen):**
1. **Border radius**: Konsisten `rounded-xl` (12px) untuk container, `rounded-lg` (8px) untuk element di dalam container, `rounded-md` (6px) untuk small elements (badge, chip)
2. **Border**: 1px `border-border` — selalu ada, sangat subtle
3. **Shadow**: `shadow-none` default, `shadow-sm` on hover — BUKAN shadow besar
4. **Transition**: `transition-all duration-200 ease-out` — smooth tapi cepat
5. **Focus ring**: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`

### 5.2 Button System

```jsx
// VARIANT HIERARCHY (dari paling penting ke paling rendah):
// 1. primary  → Aksi utama per halaman. HANYA SATU per view.
// 2. secondary → Aksi pendukung. Bisa multiple.  
// 3. outline  → Aksi tersier, cancel, back.
// 4. ghost    → Inline actions, toolbar items.
// 5. destructive → Delete, remove. Selalu butuh konfirmasi.

// SIZING:
// sm  → Dalam tabel, inline actions
// md  → Default semua konteks (DEFAULT)
// lg  → CTA utama, hero buttons

// RULES:
// - Button text: capitalize first word, lowercase rest ("Kirim validasi" bukan "Kirim Validasi")
// - Selalu ada loading state (spinner + disabled)
// - Icon selalu di kiri (iconLeft) kecuali arrow/chevron (iconRight)
// - Minimum width: min-w-[120px] untuk primary/secondary agar tidak terlalu kecil
// - Tidak boleh ada lebih dari 3 button berjajar dalam satu row
```

### 5.3 Card Design

```jsx
// CARD ANATOMY (konsisten di seluruh app):
//
// ┌─────────────────────────────────┐ ← rounded-xl border-border
// │ [Optional: Card Header]         │ ← pb-4 border-b jika ada header
// │                                 │
// │ [Card Content]                  │ ← p-5 atau p-6
// │                                 │
// │ [Optional: Card Footer]         │ ← pt-4 border-t jika ada footer
// └─────────────────────────────────┘
//
// CARD VARIANTS:
// 1. default    → bg-card border shadow-none
// 2. interactive → + hover:shadow-sm hover:border-foreground/10 cursor-pointer
// 3. elevated   → + shadow-sm (untuk card yang perlu menonjol)
// 4. inset      → bg-muted/50 border-none (card di dalam card)

// RULES:
// - Card TIDAK BOLEH punya shadow besar secara default
// - Hover shadow hanya untuk interactive cards
// - Card di dalam card menggunakan variant "inset" (warna lebih gelap sedikit)
// - Padding internal card: SELALU p-5 atau p-6, tidak boleh mix
```

### 5.4 Form Design

```jsx
// INPUT ANATOMY:
// Label (text-sm font-medium)
// ↓ space-y-1.5
// Input (h-10 px-3 rounded-lg border-border bg-background)
// ↓ space-y-1
// Helper/Error text (text-xs text-muted-foreground | text-destructive)

// FORM LAYOUT:
// - Vertical stack: space-y-5 antar field group
// - Horizontal group (nama depan/belakang): grid grid-cols-2 gap-4
// - Submit area: pt-6 (extra space sebelum tombol)
// - Submit button: SELALU di kanan (flex justify-end) kecuali single-action form

// VALIDATION:
// - Error state: border-destructive ring-destructive/20
// - Success state: border-success (HANYA setelah validasi berhasil, bukan default)
// - Error message: muncul di bawah input dengan text-xs text-destructive
// - Real-time validation: debounce 300ms, validasi on blur

// FLOATING LABEL (jika digunakan):
// - KONSISTEN: semua form di satu halaman harus sama style (semua floating ATAU semua stacked)
// - Jangan mix floating dan stacked label di satu halaman
```

### 5.5 Table Design

```jsx
// TABLE LAYOUT:
// - Header: bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider
// - Row: border-b border-border/50 hover:bg-accent/50
// - Cell padding: px-4 py-3
// - Text alignment: Left default, Right untuk numbers/currency, Center untuk status
// - Sortable columns: cursor-pointer + sort indicator icon

// MOBILE ADAPTATION:
// - Tabel dengan 4+ kolom HARUS punya mobile view alternatif
// - Opsi 1: Horizontal scroll dengan min-width per kolom
// - Opsi 2: Card view (setiap row jadi card) — PREFER ini
// - Breakpoint switch: md:table-row / table-cell, mobile: block

// EMPTY TABLE:
// - Gunakan EmptyState component
// - Icon relevan + pesan informatif + CTA jika applicable
```

### 5.6 Navigation Pattern

```jsx
// HEADER (sudah bagus — pertahankan):
// - Sticky top, backdrop-blur, semi-transparent
// - Logo kiri, nav tengah/kanan
// - Mobile: hamburger → sidebar

// BREADCRUMB (TAMBAHKAN — belum ada):
// - Untuk semua halaman depth > 1
// - Pattern: Home / Section / Current Page
// - Current page: text-foreground, rest: text-muted-foreground link

// SIDEBAR NAVIGATION (untuk account/admin sections):
// - Vertical nav di kiri (desktop)
// - Bottom tabs atau expandable menu (mobile)
// - Active state: bg-accent text-foreground font-medium
// - Inactive: text-muted-foreground hover:text-foreground

// TAB NAVIGATION:
// - Underline style (bukan button-group)
// - Active: border-b-2 border-primary text-foreground font-medium
// - Inactive: text-muted-foreground hover:text-foreground
// - Tab content: pt-6 setelah tab bar
```

---

## BAGIAN 6: PAGE TEMPLATES — "Every Page Has a Blueprint"

### 6.1 Page Categories

Setiap halaman di AIValid masuk ke salah satu template:

#### Template A: Landing/Marketing Page
```
Hero Section → Feature Sections → CTA → Footer
Contoh: Homepage, About, Fees
Karakteristik: Generous whitespace, large typography, visual storytelling
```

#### Template B: List/Browse Page
```
Page Header (title + description + filters) → Content Grid/List → Pagination
Contoh: Validation Cases, Market
Karakteristik: Scannable, filterable, dense but organized
```

#### Template C: Detail Page
```
Breadcrumb → Header (title + metadata + actions) → Content Body → Related Items
Contoh: Validation Case Detail, User Profile
Karakteristik: Information hierarchy, clear sections
```

#### Template D: Form/Action Page
```
Page Header (title + context) → Form → Action Buttons
Contoh: New Validation Case, Register, Login, Wallet Send
Karakteristik: Focused, minimal distractions, clear flow
```

#### Template E: Dashboard Page
```
Welcome/Summary → Stats Cards → Activity/Lists → Quick Actions
Contoh: Account, Admin Dashboard
Karakteristik: At-a-glance overview, actionable items prominent
```

#### Template F: Settings Page
```
Sidebar Nav → Section Title → Setting Groups → Save
Contoh: Account Settings, Security
Karakteristik: Organized sections, clear grouping
```

### 6.2 Consistent Page Structure

```jsx
// SETIAP halaman user-facing harus mengikuti:

<main className="container py-8 sm:py-12">
  {/* 1. Breadcrumb (jika depth > 1) */}
  <Breadcrumb items={[...]} className="mb-6" />
  
  {/* 2. Page Header */}
  <div className="mb-8">
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
      {title}
    </h1>
    {description && (
      <p className="mt-2 text-muted-foreground">{description}</p>
    )}
  </div>
  
  {/* 3. Content */}
  <div className="space-y-8">
    {children}
  </div>
</main>

// Page header spacing: mb-8 (32px) — konsisten di semua halaman
// Section spacing: space-y-8 (32px) — konsisten  
// Ini menciptakan RHYTHM yang bisa dirasakan user walau tidak sadar
```

---

## BAGIAN 7: MOTION & ANIMATION — "Purposeful Movement"

### 7.1 Prinsip Animasi

> Animasi bukan dekorasi. Setiap gerakan harus menjawab pertanyaan: **"Ini membantu user memahami APA?"**

| Tujuan | Animasi | Duration |
|--------|---------|----------|
| **Entrance** (konten baru masuk) | fade-in + slide-up (8-12px) | 300-400ms |
| **Feedback** (aksi berhasil/gagal) | scale pulse atau check animation | 200-300ms |
| **State change** (expand/collapse) | height + opacity | 200ms |
| **Hover** | color/shadow transition | 150ms |
| **Loading** | skeleton pulse atau spinner | Continuous |
| **Page transition** | View Transitions API (fade) | 200ms |

### 7.2 Easing

```css
/* HANYA gunakan 2 easing ini: */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);    /* Untuk entrance (dramatic decel) */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1); /* Untuk state changes (smooth) */

/* JANGAN gunakan: */
/* linear — terasa robotic */
/* ease-in — terasa "jatuh" */
/* bounce — terlalu playful untuk brand AIValid */
```

### 7.3 Stagger Pattern (untuk lists/grids)

```css
/* Stagger delay: 50ms per item, max 300ms (jangan lebih dari 6 items di-stagger) */
.stagger-children > :nth-child(1) { animation-delay: 0ms; }
.stagger-children > :nth-child(2) { animation-delay: 50ms; }
.stagger-children > :nth-child(3) { animation-delay: 100ms; }
.stagger-children > :nth-child(4) { animation-delay: 150ms; }
.stagger-children > :nth-child(5) { animation-delay: 200ms; }
.stagger-children > :nth-child(6) { animation-delay: 250ms; }

/* Item ke-7+ TIDAK di-stagger — langsung muncul */
```

### 7.4 JANGAN Lakukan

```
❌ Animasi yang menghalangi interaksi (harus menunggu animasi selesai)
❌ Parallax scrolling (performance killer, terasa "2016")
❌ Hover animations pada mobile (tidak ada hover di touch)
❌ Auto-playing animations yang tidak bisa di-pause
❌ Animasi > 500ms (terasa lambat)
❌ Transform yang menyebabkan layout shift (gunakan transform, bukan width/height)
```

---

## BAGIAN 8: DARK MODE — "Not an Afterthought"

### 8.1 Prinsip Dark Mode

> Dark mode BUKAN "invert semua warna." Dark mode adalah desain terpisah yang harus terasa NYAMAN di mata.

### 8.2 Rules

```
1. SEMUA styling HARUS melalui CSS variables — tidak ada `dark:` prefix di komponen
2. Dark background: BUKAN pure black (#000) — gunakan deep charcoal dengan WARM undertone
3. Text di dark mode: BUKAN pure white (#fff) — gunakan off-white (mengurangi eye strain)
4. Primary color di dark mode: LEBIH TERANG dari light mode (increase lightness)
5. Borders di dark mode: LEBIH SUBTLE (gunakan opacity, bukan warna berbeda)
6. Shadows di dark mode: hampir invisible (atau ganti dengan subtle glow)
7. Images/illustrations: pertimbangkan opacity reduction atau alternative assets
8. Contrast ratio: minimum 4.5:1 untuk text, 3:1 untuk large text (WCAG AA)
```

### 8.3 Testing Checklist

```
Setiap komponen/halaman yang di-ship HARUS dicek di:
□ Light mode — contrast, readability
□ Dark mode — contrast, readability, no "blinding" elements
□ System preference switch — transitions smooth
□ Focus states visible di kedua mode
□ Status colors (success/danger/warning) readable di kedua mode
```

---

## BAGIAN 9: RESPONSIVE DESIGN — "Mobile is Not Smaller Desktop"

### 9.1 Breakpoints (mengikuti Tailwind defaults)

```
Mobile:  < 640px  (default, tanpa prefix)
Tablet:  640px+   (sm:)
Desktop: 768px+   (md:)
Wide:    1024px+   (lg:)
Ultra:   1280px+   (xl:)
```

### 9.2 Mobile-First Patterns

```
NAVIGATION:
- Mobile: Bottom sheet sidebar (sudah ada, pertahankan)
- Tablet+: Horizontal nav di header

GRID:
- Mobile: 1 kolom stack
- Tablet: 2 kolom
- Desktop: 3 kolom (kadang 4 untuk admin)

TABLE:
- Mobile: WAJIB card view (setiap row jadi card vertical)
- Tablet+: Traditional table

TYPOGRAPHY:
- Mobile heading: text-2xl (24px)
- Desktop heading: text-3xl (30px)
- JANGAN buat heading yang terlalu besar di mobile

TOUCH TARGETS:
- Minimum 44x44px untuk semua interactive elements di mobile
- Ini artinya button, link, icon button HARUS cukup besar
- Jangan buat icon button < 36px

SPACING:
- Mobile padding: px-4 (16px horizontal)
- Desktop padding: px-6 (24px horizontal)
- Jangan buat content full-bleed di mobile (selalu ada padding)
```

---

## BAGIAN 10: CONTENT DESIGN — "Words Are UI"

### 10.1 Voice & Tone

AIValid berbicara dengan bahasa **Indonesia yang natural, modern, dan jelas**:

```
✅ BAIK:
- "Kirim case untuk divalidasi" (langsung, jelas)
- "Validator belum ditemukan" (informatif)
- "Bounty akan diberikan otomatis setelah validasi selesai" (menjelaskan proses)

❌ BURUK:
- "Silakan melakukan pengiriman case Anda" (terlalu formal/kaku)
- "Error: NullReferenceException" (technical jargon ke user)
- "Yuk, submit case-mu sekarang! 🚀" (terlalu kasual/startup-vibes)
```

### 10.2 Microcopy Patterns

```
BUTTON LABELS:
- Primary action: Verb + noun → "Kirim case", "Buat validasi", "Setor dana"
- Secondary: Verb saja → "Batal", "Kembali", "Tutup"
- Destructive: Explicit → "Hapus case ini", bukan hanya "Hapus"

EMPTY STATES:
- Heading: Deskriptif → "Belum ada case yang dibuat"
- Body: Helpful → "Buat case pertamamu untuk mulai mendapatkan validasi dari ahli."
- CTA: Action-oriented → "Buat case pertama"

ERROR MESSAGES:
- JANGAN: "Terjadi kesalahan" (tidak membantu)
- LAKUKAN: "Gagal memuat data. Periksa koneksi internet dan coba lagi." (specific + actionable)

LOADING STATES:
- Skeleton (preferred) → tidak perlu text
- Spinner + text → "Memuat case..." (verb -ing form dalam Indonesian)

CONFIRMATION DIALOGS:
- Title: "Hapus case ini?"
- Body: "Case 'Validasi kode Python' akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
- Primary: "Ya, hapus" (destructive variant)
- Secondary: "Batal"
```

---

## BAGIAN 11: VISUAL DETAILS YANG MEMBEDAKAN "PREMIUM" vs "TEMPLATE"

### 11.1 Micro-Details Checklist

Ini adalah detail-detail kecil yang membedakan website profesional dari template:

```
□ Favicon yang crisp di semua ukuran (sudah SVG ✅)
□ Smooth scroll behavior (scroll-behavior: smooth) pada anchor links
□ Custom selection color (::selection { background: primary/20 })
□ Custom scrollbar styling (subtle, matching theme)
□ Skeleton loading yang match layout persis (bukan rectangle generik)
□ Transition pada SEMUA interactive state changes (hover, active, focus)
□ Proper text truncation (ellipsis + title tooltip)
□ Empty state illustrations yang on-brand (bukan generic)
□ Consistent icon sizing (16px inline, 20px standalone, 24px feature)
□ Border radius consistency (tidak mix rounded-md dan rounded-lg sembarangan)
□ Proper img aspect-ratio (tidak stretch/squish)
□ Link hover underline (text-decoration: underline, underline-offset-4)
□ Active/pressed state (scale-[0.98]) pada buttons dan interactive cards
□ Number formatting consistent (Rp 100.000, bukan Rp100000)
□ Proper date formatting ("12 Mar 2026", bukan "2026-03-12T00:00:00Z")
□ Monospace font untuk kode, hash, ID, harga
□ Toast notification konsisten (posisi, durasi, dismissable)
□ Page title yang descriptive (setiap halaman punya title unik)
□ Keyboard shortcut hints (Ctrl+K untuk search, sudah ada CommandPalette ✅)
□ Scroll-to-top behavior yang smooth pada page navigation
```

### 11.2 The "1000 Details" Principle

> Website premium bukan tentang satu big feature. Ini tentang 1000 detail kecil yang semuanya BENAR. User tidak bisa menunjukkan satu hal spesifik yang membuat website terasa premium — tapi mereka MERASAKAN bahwa semuanya diperhatikan.

**Ini artinya:**
- Setiap pixel alignment harus intentional
- Setiap hover state harus ada dan konsisten
- Setiap loading state harus graceful
- Setiap error state harus helpful
- Setiap empty state harus encouraging
- Setiap transition harus smooth
- Setiap spacing harus rhythmic

---

## BAGIAN 12: KOMPONEN YANG HARUS DITAMBAHKAN

### 12.1 Missing Components (prioritas tinggi)

Komponen berikut BELUM ADA dan HARUS dibuat untuk app yang complete:

```
1. Tabs          → Untuk navigasi konten horizontal (account, admin sections)
2. Tooltip       → Hover info untuk icon buttons, truncated text, helper context
3. Popover       → Dropdown menus, filter panels, user actions
4. Breadcrumb    → Navigasi hierarchy (semua halaman depth > 1)
5. Accordion     → FAQ, collapsible settings sections
6. Checkbox      → Form selections (bukan native, styled sesuai design system)
7. Radio         → Form single-select (bukan native, styled sesuai design system)
8. Switch/Toggle → On/off settings (selain theme toggle)
9. Progress      → Upload progress, multi-step forms, completion indicators
10. Separator    → Visual divider yang konsisten (bukan ad-hoc border-b)
```

### 12.2 Component API Standardization

```
SEMUA komponen baru harus mengikuti pattern ini:

1. Export: named export + memo() wrapper
   export const Component = memo(function Component({ ...props }) { })

2. Variants: menggunakan CVA (class-variance-authority)
   const variants = cva("base-classes", { variants: { ... } })

3. Sizes: sm / md / lg (md = default)

4. Props: destructure di parameter, defaultValues via defaultProps atau parameter defaults

5. Ref forwarding: forwardRef untuk form elements (input, select, textarea, button)

6. Accessibility: 
   - role attribute jika semantic HTML tidak cukup
   - aria-label untuk icon-only elements
   - keyboard navigation support

7. className prop: selalu accept dan merge via cn()
   className={cn(variants({ variant, size }), className)}
```

---

## BAGIAN 13: ANTI-PATTERNS — "Never Do This"

### 13.1 Visual Anti-Patterns

```
❌ RAINBOW GRADIENTS — Multi-color gradients terasa "AI-generated." Ganti dengan 
   monochrome gradient (primary → primary/40) atau dual-tone (primary → accent) MAX.

❌ DROP SHADOW HEAVY — Box-shadow besar/obvious terasa "2018." Gunakan subtle borders 
   + ultra-soft shadow (shadow-sm atau custom shadow dengan high spread, low opacity).

❌ TOO MANY ROUNDED CORNERS — Semua rounded-full (pill shape) terasa generik. 
   Mix: rounded-xl untuk cards, rounded-lg untuk buttons, rounded-md untuk badges.

❌ GENERIC GRID OF CARDS — 3-kolom grid card yang identik tanpa hierarchy terasa template.
   Beri hierarchy: featured item lebih besar, atau beri visual variety.

❌ CENTERED EVERYTHING — Tidak semua konten harus centered. Centered = heading + hero. 
   Content body = left-aligned. Mixing alignment menciptakan visual interest.

❌ ICON + TEXT + ICON + TEXT repetition — Variasi layout. Kadang icon, kadang number, 
   kadang illustration, kadang just text with good typography.

❌ SAME CARD HEIGHT EVERYWHERE — Cards dengan konten berbeda boleh punya height berbeda. 
   Masonry layout atau auto-fit lebih natural dari forced equal height.
```

### 13.2 Technical Anti-Patterns

```
❌ inline style={{}} — Tailwind only (kecuali dynamic values seperti animationDelay)
❌ className="text-[#hex]" — CSS variables only  
❌ dark: prefix di komponen — CSS variables handle ini
❌ console.log — gunakan lib/logger.js
❌ Math.random() — gunakan crypto.randomUUID()
❌ dangerouslySetInnerHTML — kecuali trusted markdown rendering
❌ img tanpa alt — accessibility violation
❌ button tanpa type — default submit bisa unexpected
❌ div dengan onClick tanpa role/tabIndex — accessibility violation
❌ Nested interactive elements (button di dalam a, atau a di dalam button)
❌ z-index > 100 tanpa documented reason (z-index war)
❌ !important — design system harus solve tanpa force-override
```

---

## BAGIAN 14: QUALITY CHECKLIST — "Before You Ship"

### 14.1 Per-Component Checklist

Sebelum komponen baru di-merge:

```
VISUAL:
□ Terlihat baik di light mode
□ Terlihat baik di dark mode
□ Responsive di mobile (< 640px)
□ Responsive di tablet (640-1024px)
□ Responsive di desktop (> 1024px)
□ Spacing sesuai 4px grid
□ Typography sesuai type scale
□ Warna menggunakan CSS variables (bukan hardcoded)

INTERACTION:
□ Hover state ada dan smooth
□ Focus state visible (focus-visible ring)
□ Active/pressed state ada
□ Disabled state ada (jika applicable)
□ Loading state ada (jika applicable)
□ Error state ada (jika applicable)
□ Keyboard accessible (Tab, Enter, Escape)

TECHNICAL:
□ Tidak ada console.log/console.error
□ Tidak ada hardcoded string (teks Indonesia)
□ PropTypes atau TypeScript types defined
□ memo() wrapper jika pure component
□ cn() untuk className merging
□ Proper HTML semantics (button, a, nav, main, section, article)
```

### 14.2 Per-Page Checklist

Sebelum halaman baru/redesigned di-merge:

```
STRUCTURE:
□ Punya h1 yang deskriptif (tepat SATU per halaman)
□ Heading hierarchy logis (h1 → h2 → h3, tidak skip)
□ Breadcrumb ada (jika depth > 1)
□ Meta title dan description set
□ Container width sesuai standar (max-w-6xl)

UX:
□ Loading state (skeleton atau spinner)
□ Empty state (pesan + CTA jika applicable)
□ Error state (pesan informatif + retry option)
□ Success feedback (toast atau inline confirmation)
□ Back navigation jelas
□ Scroll position restored on back

CONTENT:
□ Semua text dalam Bahasa Indonesia
□ Button labels: verb + noun pattern
□ Error messages: specific + actionable
□ Numbers formatted (Rp xxx.xxx)
□ Dates formatted (DD Mon YYYY)
```

---

## BAGIAN 15: IMPLEMENTATION PRIORITY

### Phase 1: Foundation (Harus Pertama)
```
1. Cleanup globals.css:
   - Hapus .text-github-* classes
   - Pastikan spacing/radius tokens konsisten
   - Audit dan fix color tokens untuk warmth

2. Standardize container widths:
   - User pages: max-w-6xl
   - Admin pages: max-w-7xl  
   - Auth pages: max-w-md

3. Hapus SEMUA hardcoded colors:
   - Cari dan replace semua hex/rgb values di komponen
   - Pindahkan brand colors (USDT, etc.) ke CSS variables
   - Hapus semua dark: prefix dari komponen

4. Fix typography scale:
   - Hapus semua text-[Npx] arbitrary values
   - Map ke type scale standar
   - Enforce heading hierarchy
```

### Phase 2: Core Components (Setelah Foundation)
```
5. Tambah missing components:
   - Tabs, Tooltip, Popover, Breadcrumb, Accordion
   - Checkbox, Radio, Switch, Progress, Separator

6. Standardize existing components:
   - Unify export patterns
   - Add forwardRef ke form elements
   - Standardize CVA variants
   - Fix border-radius consistency

7. Create PageHeader component:
   - Reusable header (title + description + breadcrumb + actions)
   - Setiap halaman gunakan ini
```

### Phase 3: Page Redesign (Setelah Components Ready)
```
8. Redesign admin pages:
   - Admin dashboard: proper stats + hierarchy
   - Admin tables: mobile card view + sorting
   - Admin forms: consistent layout

9. Redesign account pages:
   - Account dashboard: welcome + summary
   - Wallet: clear balance + transaction flow
   - Settings: grouped sections

10. Polish homepage:
    - Ganti rainbow gradients → monochrome/dual-tone
    - Tambah social proof section
    - Perkuat visual hierarchy

11. Polish all remaining pages:
    - Login/Register: clean, focused
    - Validation case detail: information hierarchy
    - User profile: professional layout
```

### Phase 4: Polish (Setelah Semua Pages)
```
12. Micro-interactions:
    - Page transitions (View Transitions API)
    - Skeleton loading yang match layout
    - Toast consistency
    - Scroll behaviors

13. Performance:
    - Lazy load below-fold images
    - Optimize animations (will-change)
    - Reduce CSS bundle

14. Final QA:
    - Full dark mode audit
    - Full mobile audit
    - Accessibility audit (axe-core)
    - Cross-browser testing
```

---

## BAGIAN 16: REFERENSI VISUAL

### Websites untuk Inspirasi (BUKAN untuk di-copy):

| Website | Ambil Apa | Jangan Ambil |
|---------|-----------|--------------|
| **neon.com** | Custom brand color yang distinctive, glowing accents | Terlalu gelap/neon untuk AIValid |
| **linear.app** | Clean layout, perfect typography, minimal but memorable | Terlalu developer-focused |
| **vercel.com** | Whitespace confidence, gradient subtlety, border-based depth | Terlalu "enterprise" |
| **stripe.com** | Content hierarchy, section transitions, documentation quality | Terlalu complex untuk skala AIValid |
| **supabase.com** | Dark mode excellence, code-forward design | Terlalu heavy dark-mode focused |
| **cal.com** | Clean dashboard, consistent spacing, warm palette | Good overall reference |

### Keyword Visual untuk AI:
Jika menggunakan AI image generation untuk inspiration boards:
- "Modern Indonesian tech platform, geometric, precise, indigo and warm neutrals"
- "Clean SaaS dashboard, IBM Plex typography, subtle borders, whitespace"
- "Validation platform UI, trust-focused, professional but approachable"

---

## CATATAN PENTING

> **Prompt ini adalah BAGIAN 1.** Ini mencakup design philosophy, color, typography, spacing, 
> components, templates, animation, responsive, content, dan quality standards.
>
> **BAGIAN YANG BELUM TERCAKUP (akan di-follow-up jika diminta):**
> 1. **Detailed component specs** — API lengkap setiap komponen baru (Tabs, Tooltip, dll)
> 2. **Page-by-page redesign specs** — Wireframe/blueprint detail setiap halaman
> 3. **Design token migration script** — Script otomatis untuk cleanup hardcoded values
> 4. **Storybook setup** — Documentation dan visual testing components
> 5. **Accessibility deep-dive** — WCAG AA compliance checklist lengkap
> 6. **Performance budget** — Lighthouse scores, bundle size limits, animation frame budget
> 7. **Illustration & iconography system** — Custom illustrations, icon guidelines lengkap
> 8. **Email template design** — Consistent with web brand identity
> 9. **OG image system** — Dynamic OG images per page type

---

*Prompt ini harus disimpan sebagai `.ai/prompts/ui-overhaul.md` dan direferensi setiap kali 
melakukan perubahan UI. Setiap AI assistant yang bekerja pada frontend HARUS membaca file ini 
sebelum melakukan perubahan apapun.*
