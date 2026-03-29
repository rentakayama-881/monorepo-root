# Follow-Up #3: Design Token Migration Script

> Panduan dan script untuk cleanup hardcoded colors, arbitrary sizes, dan 
> inkonsistensi lainnya secara semi-otomatis.

---

## OVERVIEW

Migration ini membersihkan 4 kategori masalah:
1. **Hardcoded hex/rgb colors** → CSS variables
2. **Arbitrary text sizes** (text-[Npx]) → type scale standar
3. **`dark:` prefix** di komponen → CSS variables
4. **Inkonsisten spacing** → 4px grid

---

## STEP 1: AUDIT — Temukan Semua Pelanggaran

### Script: Cari Hardcoded Colors

```bash
#!/bin/bash
# Jalankan dari root monorepo: bash .ai/scripts/audit-colors.sh

echo "=== HARDCODED HEX COLORS ==="
grep -rn '#[0-9a-fA-F]\{6\}\|#[0-9a-fA-F]\{3\}' \
  frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.' \
  | grep -v globals.css | grep -v animations.css | grep -v premium.css \
  | grep -v markdown.css

echo ""
echo "=== HARDCODED RGB/HSL ==="
grep -rn 'rgb(\|rgba(\|hsl(\|hsla(' \
  frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.' \
  | grep -v globals.css

echo ""
echo "=== TAILWIND COLOR CLASSES (non-semantic) ==="
grep -rn 'text-gray-\|bg-gray-\|border-gray-\|text-blue-\|bg-blue-\|text-red-\|bg-red-\|text-green-\|bg-green-\|text-yellow-\|bg-yellow-\|text-indigo-\|bg-indigo-' \
  frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.'

echo ""
echo "=== DARK: PREFIX USAGE ==="
grep -rn 'dark:' \
  frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.' \
  | grep -v globals.css | grep -v ThemeContext
```

### Script: Cari Arbitrary Sizes

```bash
#!/bin/bash
# Jalankan: bash .ai/scripts/audit-typography.sh

echo "=== ARBITRARY TEXT SIZES ==="
grep -rn 'text-\[[0-9]*px\]' \
  frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.'

echo ""
echo "=== TEXT-GITHUB CLASSES ==="
grep -rn 'text-github-' \
  frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.'

echo ""
echo "=== ARBITRARY SPACING ==="
grep -rn 'gap-[0-9]*\.5\|gap-7\b\|gap-9\b\|gap-11\b\|gap-13\b\|gap-15\b' \
  frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.'
```

---

## STEP 2: MAPPING TABLE — Apa Diganti Apa

### Hardcoded Colors → CSS Variables

| Hardcoded | Replacement | Context |
|-----------|-------------|---------|
| `#4f46e5` | `var(--primary)` / `text-primary` | Brand indigo |
| `#6366f1` | `text-primary` | Indigo (admin) |
| `#3b82f6` | `text-primary` atau `var(--color-badge-verified)` | Blue (badges) |
| `#ef4444` | `text-destructive` | Red |
| `#22c55e` | `text-success` | Green |
| `#f59e0b` | `text-warning` | Amber |
| `#8b5cf6` | `var(--color-badge-contributor)` | Violet |
| `#eab308` | `var(--color-badge-premium)` | Gold |
| `#26A17B` | `var(--color-brand-usdt)` | USDT green |
| `#0098EA` | `var(--color-brand-ton)` | TON blue |
| `#0a0a0a` | `var(--background)` | Dark bg |
| `#ffffff` / `#fff` | `var(--foreground)` atau `text-primary-foreground` | White text |
| `gray-50..950` | `bg-muted`, `text-muted-foreground`, `bg-accent`, `border-border` | Neutral grays |

### Arbitrary Text Sizes → Type Scale

| Arbitrary | Replacement | Reasoning |
|-----------|-------------|-----------|
| `text-[10px]` | `text-xs` (12px) | Minimum readable size |
| `text-[11px]` | `text-xs` (12px) | Round up to scale |
| `text-[13px]` | `text-sm` (14px) | Round up to scale |
| `text-[15px]` | `text-sm` (14px) atau `text-base` (16px) | Context-dependent |
| `text-[9px]` | `text-xs` (12px) | Too small, round up |
| `.text-github-sm` | `text-xs` | Remove custom class |
| `.text-github-base` | `text-sm` | Remove custom class |
| `.text-github-lg` | `text-base` | Remove custom class |
| `.text-github-xl` | `text-lg` | Remove custom class |
| `.text-github-2xl` | `text-xl` | Remove custom class |
| `.text-github-3xl` | `text-2xl` | Remove custom class |

### dark: Prefix → CSS Variable Approach

```
SEBELUM:
  "bg-gray-900 dark:bg-gray-950"
  "text-gray-100 dark:text-gray-50"

SESUDAH:
  "bg-background"           ← CSS var handles light/dark
  "text-foreground"          ← CSS var handles light/dark

SEBELUM:
  "border-gray-200 dark:border-gray-800"

SESUDAH:
  "border-border"            ← CSS var handles light/dark
```

---

## STEP 3: CSS VARIABLES YANG PERLU DITAMBAHKAN

Tambahkan ke `globals.css` `:root` dan `.dark`:

```css
:root {
  /* Brand third-party colors */
  --color-brand-usdt: oklch(0.6 0.12 165);
  --color-brand-ton: oklch(0.55 0.15 240);
  --color-brand-bnb: oklch(0.7 0.15 85);
  
  /* Badge semantic colors */
  --color-badge-verified: oklch(0.55 0.15 250);
  --color-badge-admin: oklch(0.55 0.2 25);
  --color-badge-moderator: oklch(0.65 0.15 75);
  --color-badge-contributor: oklch(0.55 0.15 290);
  --color-badge-premium: oklch(0.7 0.15 85);
  --color-badge-trusted: oklch(0.55 0.15 155);
}

.dark {
  /* Adjust brightness for dark mode */
  --color-brand-usdt: oklch(0.65 0.12 165);
  --color-brand-ton: oklch(0.6 0.15 240);
  --color-brand-bnb: oklch(0.75 0.15 85);
  
  --color-badge-verified: oklch(0.65 0.12 250);
  --color-badge-admin: oklch(0.65 0.15 25);
  --color-badge-moderator: oklch(0.7 0.12 75);
  --color-badge-contributor: oklch(0.65 0.12 290);
  --color-badge-premium: oklch(0.75 0.12 85);
  --color-badge-trusted: oklch(0.65 0.12 155);
}
```

Map ke Tailwind di `@theme inline`:

```css
@theme inline {
  /* ...existing... */
  --color-brand-usdt: var(--color-brand-usdt);
  --color-brand-ton: var(--color-brand-ton);
  --color-brand-bnb: var(--color-brand-bnb);
  --color-badge-verified: var(--color-badge-verified);
  --color-badge-admin: var(--color-badge-admin);
  --color-badge-moderator: var(--color-badge-moderator);
  --color-badge-contributor: var(--color-badge-contributor);
  --color-badge-premium: var(--color-badge-premium);
  --color-badge-trusted: var(--color-badge-trusted);
}
```

---

## STEP 4: CLEANUP — Hapus yang Tidak Dipakai

```
1. Hapus .text-github-* classes dari globals.css
2. Hapus h1-h6 custom sizing dari globals.css (biarkan Tailwind handle)
3. Hapus duplicate color palettes yang tidak digunakan di globals.css
4. Hapus NativeSelect.jsx setelah semua usage dimigrasikan ke Select.jsx
```

---

## STEP 5: VERIFIKASI

```bash
#!/bin/bash
# Jalankan setelah migration: bash .ai/scripts/verify-migration.sh

echo "=== REMAINING HARDCODED COLORS ==="
count=$(grep -rn '#[0-9a-fA-F]\{6\}' frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.' \
  | grep -v globals.css | grep -v animations.css | grep -v premium.css \
  | wc -l)
echo "Found: $count (target: 0)"

echo ""
echo "=== REMAINING ARBITRARY SIZES ==="
count=$(grep -rn 'text-\[[0-9]*px\]' frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.' \
  | wc -l)
echo "Found: $count (target: 0)"

echo ""
echo "=== REMAINING dark: PREFIXES ==="
count=$(grep -rn 'dark:' frontend/components/ frontend/app/ \
  --include="*.jsx" --include="*.js" \
  | grep -v node_modules | grep -v '.test.' \
  | grep -v globals.css | grep -v ThemeContext \
  | wc -l)
echo "Found: $count (target: 0)"

echo ""
echo "=== BUILD CHECK ==="
cd frontend && npm run build 2>&1 | tail -5
```

---

## URUTAN EKSEKUSI

```
1. Jalankan audit scripts → catat semua violations
2. Tambahkan CSS variables baru ke globals.css
3. Migration batch 1: Hardcoded colors di components/ui/ (paling impactful)
4. Migration batch 2: Hardcoded colors di app/ pages
5. Migration batch 3: Arbitrary text sizes
6. Migration batch 4: dark: prefixes
7. Cleanup: hapus unused classes/components
8. Verifikasi: jalankan verify script + visual regression check
9. Build test: pastikan npm run build sukses
```

---

*Script ini bisa dijalankan berulang. Setiap batch, jalankan audit lagi untuk 
mengecek progress. Target: 0 violations di semua kategori.*
