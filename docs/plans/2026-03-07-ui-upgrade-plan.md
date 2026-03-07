# UI Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Major UI upgrade across home page, header/footer/sidebar, market, and case list/detail pages — updating outdated workflow text, removing logo icons, adding Telegram community link, and redesigning case pages.

**Architecture:** Phase 1 covers home page content updates + header/footer/sidebar cleanup + market badge change. Phase 2 covers case list and case detail redesign. All changes use existing Tailwind design tokens (oklch), existing UI components (Card, Badge, Avatar, Skeleton), and must work in both light and dark mode. Vibrant accents (gradient borders, colorful icon backgrounds) are allowed ONLY on the home page.

**Tech Stack:** Next.js App Router, React, Tailwind v4 with oklch design tokens, existing UI components (Card, Badge, Avatar, Skeleton, Button)

**Constraints:**
- Color palette: existing only (white, black, gray, primary, green/success, blue, red/destructive, warning/amber)
- Light/dark mode: all changes must work in both — no white text on light bg, no black text on dark bg
- Vibrant style: home page ONLY. All other pages use consistent, clean style
- Skeleton: single skeleton only, shape must match final content layout exactly
- Language: Indonesian for all user-facing text

---

## Phase 1: Home Page + Header/Footer/Sidebar + Market

### Task 1: Update Hero section text and cards

**Files:**
- Modify: `frontend/components/home/Hero.jsx` (lines 1-103)

**Step 1: Update the protocol badge text**

In `Hero.jsx`, line 20, change:
```jsx
// OLD:
Validation Protocol (escrow-backed, stake-gated)

// NEW:
Platform Validasi AI oleh Ahli Manusia
```

**Step 2: Update the hero subtitle paragraph**

In `Hero.jsx`, lines 28-30, replace the `<p>` content:
```jsx
// OLD:
Susun Validation Case Record, tetapkan bounty, terima Final Offer, lalu Lock Funds ke escrow. Output akhir diterbitkan sebagai Certified Artifact, dengan Case Log sebagai audit trail.

// NEW:
Owner buat case dan tetapkan bounty — otomatis potong saldo. Validator ajukan request, disetujui, lalu kerjakan. Tiga validator mengerjakan, confidence tertinggi dapat bounty.
```

**Step 3: Update CTA button text**

In `Hero.jsx`, line 46, change:
```jsx
// OLD:
Open Case Index

// NEW:
Lihat Daftar Case
```

**Step 4: Update the 3 highlight cards**

Replace the 3 `<Card>` blocks (lines 51-97) with updated content:

Card 1:
- Title: `Buat Case & Bounty`
- Description: `Owner susun case, tetapkan bounty. Saldo otomatis terpotong sebagai jaminan.`
- Icon: document icon (keep existing SVG)

Card 2:
- Title: `Validator Mengerjakan`
- Description: `Validator ajukan request, disetujui owner, lalu kerjakan case. Maks 3 validator per case.`
- Icon: user icon (keep existing SVG)

Card 3:
- Title: `Confidence & Payout`
- Description: `Validator terbaik berdasarkan confidence mendapat bounty. Imbang? Dibagi rata.`
- Icon: shield/check icon (keep existing SVG)

**Step 5: Add vibrant style to highlight cards (home page only)**

Add `gradient-border` class to each highlight Card:
```jsx
<Card className="p-4 gradient-border">
```

Add vibrant icon backgrounds using existing success/primary/warning colors:
- Card 1: `bg-primary/15 text-primary` (already similar)
- Card 2: `bg-success/15 text-success`
- Card 3: `bg-warning/15 text-warning-foreground`

**Step 6: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds (exit 0)

**Step 7: Commit**

```bash
git add frontend/components/home/Hero.jsx
git commit -m "feat(frontend): update Hero section with current workflow text and vibrant cards"
```

---

### Task 2: Update HowItWorks section

**Files:**
- Modify: `frontend/components/home/HowItWorks.jsx` (lines 1-77)

**Step 1: Update the 3 STEPS array**

Replace the STEPS array (lines 3-33):

```jsx
const STEPS = [
  {
    title: "Buat Case",
    description:
      "Owner susun case, tetapkan bounty — saldo otomatis terpotong. Klasifikasi menggunakan tags untuk audit.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Validator Mengerjakan",
    description:
      "Validator ajukan request, disetujui owner, lalu kerjakan. Maks 3 validator per case.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    title: "Penilaian & Payout",
    description:
      "Owner finalisasi. Confidence tertinggi dapat bounty. Imbang = dibagi rata.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];
```

**Step 2: Add vibrant card accents (home page only)**

Add `gradient-border` class to step cards:
```jsx
<Card key={step.title} className="p-4 gradient-border">
```

**Step 3: Update the CTA banner text**

Replace the CTA banner content (lines 64-73):
```jsx
<div className="mt-6 flex flex-col gap-3 rounded-[var(--radius)] border bg-card p-4 sm:flex-row sm:items-center sm:justify-between gradient-border">
  <div>
    <div className="font-semibold text-foreground">Mulai sekarang</div>
    <p className="mt-1 text-sm text-muted-foreground">
      Buat Validation Case dengan bounty dan acceptance criteria. Validator akan mengajukan request.
    </p>
  </div>
  <div className="text-sm font-semibold text-muted-foreground">
    Gunakan tombol <span className="font-mono text-foreground">+</span> di header untuk membuat case.
  </div>
</div>
```

**Step 4: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add frontend/components/home/HowItWorks.jsx
git commit -m "feat(frontend): update HowItWorks with current bounty-based workflow"
```

---

### Task 3: Upgrade LatestValidationCases to mini-cards

**Files:**
- Modify: `frontend/components/home/LatestValidationCases.jsx` (lines 1-77)

**Step 1: Update section heading to Indonesian**

Change line 33:
```jsx
// OLD:
Latest Validation Cases

// NEW:
Case Validasi Terbaru
```

Change line 44 link text:
```jsx
// OLD:
View Index

// NEW:
Lihat Semua
```

**Step 2: Replace list items with mini-cards**

Replace the `<ol>` list (lines 49-62) with a grid of mini-cards:

```jsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {cases.map((vc) => {
    const statusLower = String(vc.status || "").toLowerCase();
    const statusColor =
      statusLower === "open" ? "bg-success/15 text-success border-success/30" :
      statusLower === "completed" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" :
      statusLower === "disputed" ? "bg-destructive/10 text-destructive border-destructive/30" :
      "bg-secondary text-muted-foreground border-border";

    return (
      <Link
        key={String(vc.id)}
        href={`/validation-cases/${encodeURIComponent(String(vc.id))}`}
        prefetch={false}
        className="group block rounded-[var(--radius)] border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {vc.title}
          </span>
          <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor}`}>
            {String(vc.status || "unknown")}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{formatIDR(vc.bounty_amount)}</span>
          <span className="text-border">|</span>
          <span>{formatDate(vc.created_at)}</span>
        </div>
        {Array.isArray(vc.tags) && vc.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {vc.tags.slice(0, 3).map((tag) => (
              <span key={tag.slug || tag.name} className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {tag.name || tag.slug}
              </span>
            ))}
            {vc.tags.length > 3 && (
              <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                +{vc.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </Link>
    );
  })}
</div>
```

**Step 3: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/home/LatestValidationCases.jsx
git commit -m "feat(frontend): upgrade LatestValidationCases to mini-cards with status badges"
```

---

### Task 4: Update Header — remove logo text

**Files:**
- Modify: `frontend/components/Header.jsx` (lines 177-183)

**Step 1: Pass `text=""` to Logo component**

Change the Logo usage in Header (lines 178-183):

```jsx
// OLD:
<Logo
  variant="horizontal"
  size={40}
  priority
  className="shrink-0 -ml-1 md:ml-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_6px_20px_rgba(0,0,0,0.22)]"
/>

// NEW:
<Logo
  variant="icon"
  size={36}
  priority
  className="shrink-0 -ml-1 md:ml-0"
/>
```

This changes from `horizontal` (icon+text) to `icon` (icon only), and reduces size from 40 to 36 for cleaner spacing without text.

**Step 2: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/components/Header.jsx
git commit -m "feat(frontend): remove logo text from Header, show icon only"
```

---

### Task 5: Update Sidebar — remove Logo icon

**Files:**
- Modify: `frontend/components/Sidebar.jsx` (lines 1-117)

**Step 1: Remove Logo import**

Remove line 4:
```jsx
// DELETE:
import { Logo } from "./ui/Logo";
```

**Step 2: Replace Logo in sidebar header with text brand**

Replace the Logo usage (lines 53-58) with clean text:

```jsx
// OLD:
<Logo
  variant="icon"
  size={40}
  onClick={handleClose}
  className="shrink-0"
/>

// NEW:
<span
  className="text-lg font-bold text-foreground cursor-pointer"
  onClick={handleClose}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClose(); }}
>
  AIValid
</span>
```

**Step 3: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/Sidebar.jsx
git commit -m "feat(frontend): remove Logo icon from Sidebar, use clean text brand"
```

---

### Task 6: Update Footer — remove Logo, add Telegram community

**Files:**
- Modify: `frontend/components/Footer.jsx` (lines 1-49)

**Step 1: Remove Logo import**

Remove line 2:
```jsx
// DELETE:
import { Logo } from "./ui/Logo";
```

**Step 2: Replace Logo icon in copyright line**

Replace lines 22-24:
```jsx
// OLD:
<span className="flex items-center gap-1.5">
  <Logo variant="icon" size={14} className="opacity-90" />
  &copy; {new Date().getFullYear()} AIvalid
</span>

// NEW:
<span className="flex items-center gap-1.5">
  &copy; {new Date().getFullYear()} AIValid
</span>
```

**Step 3: Add Komunitas section with Telegram link**

Add a third nav row after the secondaryLinks nav (after line 44), before closing the inner div:

```jsx
<nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 sm:justify-end">
  <span className="text-muted-foreground font-medium">Komunitas:</span>
  <a
    href="https://t.me/aivalidid"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 hover:text-foreground"
  >
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
    Telegram Group
  </a>
</nav>
```

**Step 4: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add frontend/components/Footer.jsx
git commit -m "feat(frontend): remove Logo from Footer, add Telegram community link"
```

---

### Task 7: Market badge "langsung" → "Live"

**Files:**
- Modify: `frontend/app/market/chatgpt/MarketChatGPTClient.jsx` (line 132)
- Modify: `frontend/app/market/chatgpt/page.jsx` (line 5)

**Step 1: Update cachedBadge value**

In `MarketChatGPTClient.jsx`, line 132:
```jsx
// OLD:
const cachedBadge = response?.cached ? "cache" : "langsung";

// NEW:
const cachedBadge = response?.cached ? "cache" : "Live";
```

**Step 2: Update TinyBadge rendering for "Live" with green dot**

Find where `TinyBadge` is rendered with `cachedBadge` (line 143) and update:
```jsx
// OLD:
<TinyBadge label={cachedBadge} />

// NEW:
{cachedBadge === "Live" ? (
  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
    <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
    Live
  </span>
) : (
  <TinyBadge label={cachedBadge} />
)}
```

**Step 3: Update page.jsx metadata**

In `page.jsx`, line 5:
```jsx
// OLD:
description: "Jelajahi listing akun ChatGPT dan lakukan pembelian langsung di platform ini.",

// NEW:
description: "Jelajahi listing akun ChatGPT dan lakukan pembelian live di platform ini.",
```

**Step 4: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add frontend/app/market/chatgpt/MarketChatGPTClient.jsx frontend/app/market/chatgpt/page.jsx
git commit -m "feat(frontend): change market badge 'langsung' to 'Live' with green dot indicator"
```

---

### Task 8: Run full test suite for Phase 1

**Step 1: Run frontend tests**

Run: `cd /home/alep/monorepo-root/frontend && npx jest --passWithNoTests 2>&1 | tail -10`
Expected: All tests pass

**Step 2: Run build verification**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds (exit 0)

**Step 3: Verify light/dark mode colors are safe**

Manual check: grep the modified files for any hardcoded white/black text colors that could be invisible in the opposite mode. All text should use `text-foreground`, `text-muted-foreground`, `text-primary`, `text-success`, etc. — never raw `text-white` or `text-black` outside of dark:/light: variants.

Run: `grep -n 'text-white\|text-black' frontend/components/home/Hero.jsx frontend/components/home/HowItWorks.jsx frontend/components/home/LatestValidationCases.jsx frontend/components/Header.jsx frontend/components/Sidebar.jsx frontend/components/Footer.jsx frontend/app/market/chatgpt/MarketChatGPTClient.jsx`
Expected: No matches (or only properly guarded ones like `dark:text-white`)

---

## Phase 2: Case List + Case Detail Redesign

### Task 9: Redesign Case List page header

**Files:**
- Modify: `frontend/app/validation-cases/page.jsx` (lines 66-88)

**Step 1: Update page header text**

Replace lines 69-80:
```jsx
<header className="mb-6">
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Daftar Case Validasi</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Lihat semua case validasi yang tersedia. Filter berdasarkan status, bounty, atau tag.
      </p>
    </div>
  </div>
</header>
```

Key changes:
- Remove "Registry" uppercase label (too technical)
- Rename "Validation Case Index" → "Daftar Case Validasi" (friendlier Indonesian)
- Rename "Dossier-style listing..." → simpler description

**Step 2: Update metadata**

Replace lines 10-12:
```jsx
// OLD:
title: "Daftar Kasus Validasi AI Terbaru",
description: "Lihat daftar kasus validasi AI terbaru di AIValid. Pantau status, hasil review, dan temuan validator untuk berbagai jenis output AI.",

// NEW:
title: "Daftar Case Validasi",
description: "Lihat semua case validasi di AIValid. Filter berdasarkan status, bounty, dan tag.",
```

**Step 3: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/app/validation-cases/page.jsx
git commit -m "feat(frontend): simplify Case List page header text"
```

---

### Task 10: Redesign ValidationCaseIndexClient with card layout

**Files:**
- Modify: `frontend/app/validation-cases/ValidationCaseIndexClient.jsx` (lines 1-165)

**Step 1: Add status color helper and format imports**

Add at the top of the file (after existing imports):
```jsx
import Avatar from "@/components/ui/Avatar";
import { formatIDR } from "@/lib/format";

function statusColor(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  switch (s) {
    case "open":
      return "bg-success/15 text-success border-success/30";
    case "completed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case "disputed":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
}

function formatDate(ts) {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
```

**Step 2: Replace ValidationCaseTable with card grid**

Replace line 162:
```jsx
// OLD:
<ValidationCaseTable cases={filtered} showCategory={false} />

// NEW:
{filtered.length > 0 ? (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {filtered.map((vc) => {
      const owner = vc?.owner || vc?.user || {};
      return (
        <a
          key={String(vc.id)}
          href={`/validation-cases/${encodeURIComponent(String(vc.id))}`}
          className="group block rounded-[var(--radius)] border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {vc.title}
            </span>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor(vc.status)}`}>
              {String(vc.status || "unknown")}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">{formatIDR(vc.bounty_amount)}</span>
            <span className="text-xs text-muted-foreground">{formatDate(vc.created_at)}</span>
          </div>

          {Array.isArray(vc.tags) && vc.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {vc.tags.slice(0, 3).map((tag) => (
                <span key={tag.slug || tag.name} className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {tag.name || tag.slug}
                </span>
              ))}
              {vc.tags.length > 3 && (
                <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  +{vc.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {owner.username && (
            <div className="mt-3 flex items-center gap-2 border-t pt-2">
              <Avatar src={owner.avatar_url} name={owner.username || owner.full_name} size="xs" />
              <span className="text-xs text-muted-foreground truncate">@{owner.username}</span>
            </div>
          )}
        </a>
      );
    })}
  </div>
) : (
  <div className="rounded-[var(--radius)] border border-dashed bg-card py-12 text-center">
    <p className="text-sm text-muted-foreground">Tidak ada case yang cocok dengan filter.</p>
  </div>
)}
```

**Step 3: Remove unused ValidationCaseTable import**

Remove line 4:
```jsx
// DELETE:
import ValidationCaseTable from "@/components/ui/ValidationCaseTable";
```

**Step 4: Update filter labels to Indonesian**

- Line 90: `Search` → `Cari`
- Line 95: `placeholder="Case id, title, owner, tag"` → `placeholder="ID, judul, owner, atau tag"`
- Line 97: `aria-label="Search validation cases"` → `aria-label="Cari case validasi"`
- Line 102: `Status` label stays (universal)
- Line 109: `<option value="">All</option>` → `<option value="">Semua</option>`
- Line 119: `Min Bounty (IDR)` → `Min Bounty`
- Line 131: `Tag` label stays
- Line 150: `Reset` label stays

**Step 5: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add frontend/app/validation-cases/ValidationCaseIndexClient.jsx
git commit -m "feat(frontend): redesign Case List with card grid, status badges, bounty, tags, owner"
```

---

### Task 11: Update Case List skeleton to match new card layout

**Files:**
- Modify: `frontend/app/validation-cases/ValidationCaseIndexSkeleton.jsx` (lines 1-56)

**Step 1: Replace table skeleton with card grid skeleton**

Replace the `ValidationCaseIndexContentSkeleton` component (lines 3-42):

```jsx
export function ValidationCaseIndexContentSkeleton({ fullHeight = false }) {
  return (
    <section className={fullHeight ? "min-h-[68vh] space-y-6" : "space-y-6"}>
      {/* Filter skeleton */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <Skeleton className="h-4 w-10 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-4 w-12 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-3">
          <Skeleton className="h-4 w-16 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-9">
          <Skeleton className="h-4 w-8 mb-1" />
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
        <div className="md:col-span-3 flex items-end">
          <Skeleton className="h-10 w-full rounded-[var(--radius)]" />
        </div>
      </div>

      <Skeleton className="h-4 w-40" />

      {/* Card grid skeleton — matches final card layout */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius)] border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <SkeletonText width="w-3/4" height="h-4" />
              <Skeleton className="h-5 w-14 rounded-full shrink-0" />
            </div>
            <div className="flex items-center justify-between">
              <SkeletonText width="w-24" height="h-4" />
              <SkeletonText width="w-16" height="h-3" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <div className="flex items-center gap-2 border-t pt-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <SkeletonText width="w-20" height="h-3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

**Step 2: Update page-level skeleton header**

Replace lines 44-55:
```jsx
export default function ValidationCaseIndexSkeleton() {
  return (
    <main className="container min-h-screen py-10" aria-busy="true" aria-live="polite">
      <header className="mb-6">
        <SkeletonText width="w-64" height="h-7" />
        <SkeletonText width="w-full max-w-xl" height="h-4" className="mt-2" />
      </header>

      <ValidationCaseIndexContentSkeleton fullHeight />
    </main>
  );
}
```

**Step 3: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/app/validation-cases/ValidationCaseIndexSkeleton.jsx
git commit -m "feat(frontend): update Case List skeleton to match card grid layout"
```

---

### Task 12: Redesign Case Detail typography and spacing

**Files:**
- Modify: `frontend/app/validation-cases/[id]/ValidationCaseDetailClient.jsx`

**Context:** This is a 2111-line file. The redesign focuses on:
1. Proportional font sizes (no oversized headings)
2. Consistent padding/margin
3. Clean status badges matching case list style
4. More prominent bounty display
5. Clear visual separation between sections

**Step 1: Read the full file to understand section structure**

Before editing, read the file in sections to map out all section headers, their line numbers, and current styling. The file has these major sections:
- Header section (case title, status, meta)
- Case details/record section
- Consultation requests section
- Artifact section
- Case log/timeline section
- Sidebar (owner info, bounty, actions)

**Step 2: Update section heading sizes**

Find all `text-2xl` or `text-3xl` headings and reduce them to `text-xl` or `text-lg` for proportional sizing. Section labels should use `text-xs font-semibold uppercase tracking-wide text-muted-foreground`.

**Step 3: Standardize section spacing**

All sections should use consistent spacing:
- Section wrapper: `space-y-4 rounded-[var(--radius)] border bg-card p-5`
- Between sections: `space-y-6`
- Section title: `text-lg font-semibold text-foreground`

**Step 4: Update status badge to match case list style**

Use the same `statusColor()` helper pattern from Task 10:
```jsx
const statusBadgeClass = (() => {
  const s = normalizeStatus(caseData.status);
  switch (s) {
    case "open": return "bg-success/15 text-success border-success/30";
    case "completed": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case "disputed": return "bg-destructive/10 text-destructive border-destructive/30";
    default: return "bg-secondary text-muted-foreground border-border";
  }
})();
```

**Step 5: Make bounty display more prominent**

In the sidebar, ensure the bounty amount is displayed prominently:
```jsx
<div className="text-xl font-bold text-foreground">{formatIDR(caseData.bounty_amount)}</div>
<div className="text-xs text-muted-foreground">Bounty</div>
```

**Step 6: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add frontend/app/validation-cases/[id]/ValidationCaseDetailClient.jsx
git commit -m "feat(frontend): redesign Case Detail with proportional typography and consistent spacing"
```

---

### Task 13: Update Case Detail skeleton to match redesigned layout

**Files:**
- Modify: `frontend/app/validation-cases/[id]/ValidationCaseRecordSkeleton.jsx` (lines 1-91)

**Step 1: Ensure skeleton matches final layout exactly**

The current skeleton already has a good structure (8/4 grid, sections with rounded-2xl bg-secondary/20). Update it to match the redesigned layout:

- Change section wrappers from `rounded-2xl bg-secondary/20 px-5 py-5` to `rounded-[var(--radius)] border bg-card p-5` to match the actual rendered cards
- Ensure the sidebar section matches (rounded-[var(--radius)] border bg-card p-5)
- Keep the same grid proportions (lg:col-span-8 / lg:col-span-4)
- Make sure skeleton shapes (heights, widths) approximate the final content

```jsx
export default function ValidationCaseRecordSkeleton() {
  return (
    <main className="container min-h-screen py-10" aria-busy="true" aria-live="polite">
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <SkeletonText width="w-12" height="h-4" />
        <SkeletonText width="w-24" height="h-4" />
        <SkeletonText width="w-20" height="h-4" />
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
        {/* Main content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header section */}
          <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <SkeletonText width="w-20" height="h-3" />
            </div>
            <SkeletonText width="w-full max-w-2xl" height="h-7" />
            <SkeletonText width="w-full max-w-3xl" height="h-4" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </section>

          {/* Case record section */}
          <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
            <SkeletonText width="w-36" height="h-5" />
            <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
          </section>

          {/* Consultations section */}
          <section className="space-y-4 rounded-[var(--radius)] border bg-card p-5">
            <SkeletonText width="w-44" height="h-5" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-[var(--radius)]" />
              <Skeleton className="h-20 w-full rounded-[var(--radius)]" />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="rounded-[var(--radius)] border bg-card p-5 space-y-4">
            {/* Owner */}
            <div className="flex items-center gap-3">
              <SkeletonCircle size="h-9 w-9" />
              <div className="flex-1 space-y-1">
                <SkeletonText width="w-28" height="h-4" />
                <SkeletonText width="w-16" height="h-3" />
              </div>
            </div>

            {/* Bounty */}
            <div className="border-t pt-3 space-y-2">
              <SkeletonText width="w-12" height="h-3" />
              <SkeletonText width="w-32" height="h-6" />
            </div>

            {/* Meta fields */}
            <div className="space-y-2 border-t pt-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-1">
                  <SkeletonText width="w-20" height="h-3" />
                  <SkeletonText width="w-24" height="h-3" />
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="space-y-2 border-t pt-3">
              <Skeleton className="h-9 w-full rounded-[var(--radius)]" />
              <Skeleton className="h-9 w-full rounded-[var(--radius)]" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
```

**Step 2: Verify build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/app/validation-cases/[id]/ValidationCaseRecordSkeleton.jsx
git commit -m "feat(frontend): update Case Detail skeleton to match redesigned layout exactly"
```

---

### Task 14: Run full test suite for Phase 2

**Step 1: Run frontend tests**

Run: `cd /home/alep/monorepo-root/frontend && npx jest --passWithNoTests 2>&1 | tail -10`
Expected: All tests pass

**Step 2: Run full build**

Run: `cd /home/alep/monorepo-root/frontend && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds (exit 0)

**Step 3: Verify no hardcoded color issues**

Run: `grep -rn 'text-white\|text-black' frontend/app/validation-cases/ --include='*.jsx' | grep -v node_modules | grep -v dark: | grep -v light:`
Expected: No unguarded matches

**Step 4: Update design doc status**

Mark Phase 1 and Phase 2 as complete in `docs/plans/2026-03-07-ui-upgrade-design.md`.

**Step 5: Final commit**

```bash
git add docs/plans/2026-03-07-ui-upgrade-design.md
git commit -m "docs: mark UI upgrade Phase 1 and Phase 2 as complete"
```

---

## Summary

| Task | Component | Key Changes |
|------|-----------|-------------|
| 1 | Hero.jsx | New workflow text, updated cards, gradient borders |
| 2 | HowItWorks.jsx | 3 new steps matching bounty workflow |
| 3 | LatestValidationCases.jsx | List → mini-cards with status/bounty/tags |
| 4 | Header.jsx | Logo variant horizontal→icon, remove text |
| 5 | Sidebar.jsx | Remove Logo icon, text brand only |
| 6 | Footer.jsx | Remove Logo, add Telegram community link |
| 7 | MarketChatGPTClient.jsx + page.jsx | "langsung"→"Live" with green dot |
| 8 | Phase 1 tests | Full test + build verification |
| 9 | validation-cases/page.jsx | Simpler Indonesian header |
| 10 | ValidationCaseIndexClient.jsx | Table → card grid with status/bounty/tags/owner |
| 11 | ValidationCaseIndexSkeleton.jsx | Skeleton matches card grid layout |
| 12 | ValidationCaseDetailClient.jsx | Proportional typography, consistent spacing |
| 13 | ValidationCaseRecordSkeleton.jsx | Skeleton matches redesigned detail layout |
| 14 | Phase 2 tests | Full test + build + color safety verification |

**Total: 14 tasks, ~14 commits**
