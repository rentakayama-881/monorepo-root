# Follow-Up #7: Illustration & Iconography System

> Panduan untuk penggunaan icon, ilustrasi, dan elemen grafis yang konsisten
> agar AIValid punya visual personality yang kuat dan unik.

---

## ICON SYSTEM

### Library: lucide-react (sudah dipakai)

Lucide adalah pilihan yang baik karena:
- Konsisten: 1px stroke, 24x24 viewbox, semua round caps
- Tree-shakeable: import per-icon
- Modern: clean, minimal style
- Aktif: regularly updated

### Icon Sizing Scale

```
CONTEXT            SIZE       TAILWIND     NOTES
Inline (dalam text) 14px      size-3.5     Sejajar dengan text
Button icon        16px       size-4       Di dalam button (default)
Standalone small   16px       size-4       Table actions, list items
Standalone medium  20px       size-5       Card icons, nav items
Standalone large   24px       size-6       Page features, empty states
Feature icon       32px       size-8       Homepage feature cards
Hero icon          48px       size-12      Large decorative

RULES:
- JANGAN gunakan size lain (size-3, size-7, size-9, dll)
- Inline icons: align dengan className="inline-block align-text-bottom"
- Button icons: SELALU size-4 (sesuai Button component)
- Gap icon-text: gap-2 (8px) — konsisten
```

### Icon Color Rules

```
CONTEXT                     COLOR
Default (dalam text)        currentColor (inherit dari parent)
Interactive (button/link)   currentColor (inherit, change on hover)
Decorative/subdued          text-muted-foreground
Status success              text-success
Status danger               text-destructive
Status warning              text-warning
Status info                 text-primary
Disabled                    text-muted-foreground/50

JANGAN:
- Hardcode warna icon (text-blue-500)
- Beda warna icon dan text di konteks yang sama
```

### Icon Usage Patterns

```jsx
// ✅ BAIK: Icon + text label
<Button iconLeft={<Plus className="size-4" />}>Tambah case</Button>

// ✅ BAIK: Icon-only button DENGAN aria-label
<Button variant="ghost" size="icon" aria-label="Hapus item">
  <Trash2 className="size-4" />
</Button>

// ✅ BAIK: Icon sebagai status indicator
<span className="flex items-center gap-2 text-success">
  <CheckCircle className="size-4" /> Tervalidasi
</span>

// ❌ BURUK: Icon tanpa context
<Trash2 className="size-4 text-red-500 cursor-pointer" onClick={handleDelete} />
// → Tidak ada label, tidak ada button wrapper, hardcoded color

// ❌ BURUK: Terlalu banyak icon
<div className="flex gap-2">
  <Heart /><Star /><Share /><Bookmark /><Flag /><MoreHorizontal />
</div>
// → Information overload. Max 3-4 icon actions per row.
```

---

## CUSTOM ICONS (AIValid-Specific)

### Logo Mark Usage

Logo mark (nested triangles) bisa digunakan sebagai:
- Favicon (sudah ada ✅)
- Loading indicator (rotate triangle)
- Watermark pada generated documents
- Empty state decoration

```jsx
// Logo mark SVG component
function AIValidMark({ className = "size-6" }) {
  return (
    <svg viewBox="0 0 512 512" className={className} fill="currentColor">
      <path d="M 239.7 68.1 Q 256.0 36.0 272.3 68.1 L 463.7 443.9 Q 480.0 476.0 444.0 476.0 L 68.0 476.0 Q 32.0 476.0 48.3 443.9 Z M 246.9 238.2 Q 256.0 216.0 265.1 238.2 L 338.9 417.8 Q 348.0 440.0 324.0 440.0 L 188.0 440.0 Q 164.0 440.0 173.1 417.8 Z" />
    </svg>
  );
}
```

### Validation Status Icons (Custom SVG)

Buat custom micro-icons untuk status validasi yang jadi signature AIValid:

```
STATUS            ICON DESCRIPTION                    USAGE
Pending           Triangle outline (empty)             Case menunggu validator
In Review         Triangle with dot center             Sedang divalidasi
Validated         Triangle with checkmark inside       Validasi selesai
Rejected          Triangle with X inside               Validasi ditolak
Disputed          Triangle with ! inside               Ada dispute
```

Ini mengikat tema triangle/geometric ke fitur utama produk.

---

## ILLUSTRATION STYLE

### Philosophy

AIValid TIDAK perlu ilustrasi kartun atau karakter. Visual personality datang dari:
1. **Geometric patterns** (terinspirasi logo)
2. **Typography as design** (angka besar, quote marks, dll)
3. **Purposeful whitespace** (ruang kosong = luxury)
4. **Subtle textures** (dot grid, line patterns)

### Empty State Illustrations

Daripada ilustrasi custom yang mahal dan inkonsisten, gunakan **icon compositions**:

```jsx
// Pattern: Large icon + geometric accent
function EmptyStateIllustration({ icon: Icon }) {
  return (
    <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
      {/* Background circle */}
      <div className="absolute inset-0 rounded-full bg-primary/5" />
      {/* Geometric accent dots */}
      <div className="absolute -top-2 -right-2 size-3 rounded-full bg-primary/10" />
      <div className="absolute -bottom-1 -left-3 size-2 rounded-full bg-primary/15" />
      {/* Main icon */}
      <Icon className="size-10 text-muted-foreground" />
    </div>
  );
}

// Usage di EmptyState
<EmptyState
  icon={<EmptyStateIllustration icon={FileSearch} />}
  title="Belum ada case"
  description="Buat case pertamamu untuk mulai mendapatkan validasi."
  action={{ label: "Buat case", onClick: () => router.push("/validation-cases/new") }}
/>
```

### Background Patterns

```css
/* 1. Dot Grid (sudah ada di Hero — standardisasi) */
.pattern-dots {
  background-image: radial-gradient(circle, var(--foreground) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.03;
}

/* 2. Diagonal Lines (untuk section dividers) */
.pattern-lines {
  background-image: repeating-linear-gradient(
    -45deg,
    var(--foreground),
    var(--foreground) 1px,
    transparent 1px,
    transparent 16px
  );
  opacity: 0.02;
}

/* 3. Triangle Pattern (brand signature) */
.pattern-triangles {
  background-image: url("data:image/svg+xml,..."); /* SVG triangle pattern */
  background-size: 48px 48px;
  opacity: 0.02;
}

/* RULES:
   - Pattern opacity: SELALU 0.02-0.05 (sangat subtle)
   - Hanya 1 pattern per section
   - Tidak di semua section — strategic placement
   - pointer-events-none (jangan block clicks)
*/
```

---

## DECORATIVE ELEMENTS

### Geometric Accents

```jsx
// Accent line (horizontal, di bawah heading)
<div className="w-12 h-0.5 bg-primary rounded-full mt-3" />

// Accent dots (decorative, di corner cards/sections)
<div className="absolute -top-1 -right-1 size-2 rounded-full bg-primary/20" />

// Corner triangle (signature element)
<svg className="absolute top-0 right-0 size-8 text-primary/10" viewBox="0 0 32 32">
  <polygon points="0,0 32,0 32,32" fill="currentColor" />
</svg>
```

### Rules

```
1. Decorative elements SELALU:
   - aria-hidden="true"
   - pointer-events-none
   - Opacity rendah (5-20%)
   
2. Tidak lebih dari 2 decorative elements per section

3. Decorative elements TIDAK BOLEH mengganggu readability

4. Di mobile, pertimbangkan hide decorative elements:
   "hidden sm:block" untuk elements yang clutter mobile view

5. Jangan tambah decorative element hanya karena "kosong."
   Whitespace ADALAH design element.
```

---

## GRADIENT RULES (Refined)

```
AIValid gradient = CONTROLLED, bukan FESTIVE.

DIBOLEHKAN:
1. Monochrome gradient: from-primary to-primary/40
2. Subtle bg gradient: from-background to-muted/30 (very subtle page bg)
3. Text gradient: from-foreground to-foreground/60 (subtle text effect)
4. Status gradient: from-success to-success/60 (per-status)

DILARANG:
1. Rainbow (3+ unrelated colors)
2. Neon/vibrant multi-color
3. Gradient pada text body (hanya heading/display text)
4. Gradient border pada SEMUA cards (hanya 1-2 featured elements)

MIGRATION DARI CURRENT:
- rainbow-border → gradient-border (primary → primary/40 saja)
- rainbow-text → gradient-text (primary → primary/60)
- rainbow-line-h → solid bg-primary/20 atau gradient-border
- rainbow-glow → shadow-glow-subtle (single-color glow)
```

---

## ICON INVENTORY (Yang Dipakai per Konteks)

Standardisasi icon choice agar konsisten:

```
NAVIGATION:
  Home        → Home (lucide)
  Cases       → FileCheck
  Market      → ShoppingBag
  Browser     → Globe
  Account     → User
  Settings    → Settings
  Admin       → Shield

ACTIONS:
  Create/Add  → Plus
  Edit        → Pencil
  Delete      → Trash2
  Search      → Search
  Filter      → Filter
  Sort        → ArrowUpDown
  Share       → Share2
  Copy        → Copy
  Download    → Download
  Upload      → Upload
  Send        → Send
  Close       → X
  Back        → ArrowLeft
  Forward     → ArrowRight
  External    → ExternalLink
  More        → MoreHorizontal

STATUS:
  Success     → CheckCircle
  Error       → XCircle
  Warning     → AlertTriangle
  Info        → Info
  Loading     → Loader2 (animate-spin)
  Pending     → Clock

CONTENT:
  Document    → FileText
  Code        → Code
  Image       → Image
  Link        → Link
  Tag         → Tag
  Category    → Folder
  Calendar    → Calendar
  Money       → Wallet (atau Banknote)
  Lock        → Lock
  Unlock      → Unlock
  Eye         → Eye
  EyeOff      → EyeOff

JANGAN gunakan icon yang berbeda untuk konsep yang sama di halaman yang berbeda.
Jika "delete" = Trash2, maka Trash2 di SEMUA tempat.
```

---

*Iconography yang konsisten = brand recognition yang kuat. 
User tidak sadar, tapi otak mereka mengenali pattern.*
