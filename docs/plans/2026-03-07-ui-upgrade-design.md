# UI Upgrade Design — 2026-03-07

## Scope

Major UI upgrade across multiple pages, executed in 2-3 phases.

## Constraints

- **Color palette:** Use existing palette only (white, black, gray, primary/crimson, green, blue, red). No new colors.
- **Light/dark mode:** All changes must work in both modes. No white text on light bg or black text on dark bg.
- **Beranda only:** Vibrant/mencolok style variations allowed ONLY on the home page. Other pages stay consistent with existing style.
- **Skeleton/loading:** Single skeleton only (no A→B→content transitions). Skeleton shape must match final content layout exactly.
- **Indonesian:** All user-facing text in Indonesian.

## Phase 1: Home Page + Header/Footer/Sidebar + Market

**Status:** Complete

### 1.1 Home Page — Hero

**Current problems:**
- Hero text describes outdated workflow (Final Offer, Lock Funds, escrow)
- Highlight cards reference "Final Offer" which no longer exists

**Changes:**
- Update hero subtitle to describe the current simplified workflow:
  - Owner buat case + tetapkan bounty (otomatis potong saldo)
  - Validator kirim request → disetujui → kerjakan
  - 3 validator mengerjakan, confidence tertinggi dapat bounty
- Update 3 highlight cards:
  1. "Buat Case & Bounty" — Owner susun case, tetapkan bounty
  2. "Validator Mengerjakan" — Validator ajukan request, kerjakan case
  3. "Confidence & Payout" — Validator terbaik dapat bounty
- Add ChatGPT Market mention (small banner or 4th card)
- Style: Add subtle gradient borders on cards, more vibrant icon backgrounds (home page only)

### 1.2 Home Page — HowItWorks

**Current problems:**
- 3 steps describe old workflow (stake-gated consultation, Final Offer)

**Changes:**
- Step 1: "Buat Case" — Owner susun case, tetapkan bounty (otomatis potong saldo)
- Step 2: "Validator Mengerjakan" — Validator ajukan request, disetujui, lalu kerjakan. Maks 3 validator per case
- Step 3: "Penilaian & Payout" — Owner finalisasi. Confidence tertinggi dapat bounty. Imbang = dibagi rata.
- CTA banner text updated to match new flow
- Style: Vibrant card accents (home page only)

### 1.3 Home Page — LatestValidationCases

**Changes:**
- Upgrade from simple list items to mini-cards
- Show status badge (colored), bounty amount, tags
- Match style of redesigned case list

### 1.4 Header

**Changes:**
- Remove "aivalid.id" text from Logo component (pass `text=""` or modify variant)
- Remove logo image — clean text-only brand or just icon without text
- Polish spacing for cleaner feel

### 1.5 Sidebar

**Changes:**
- Remove Logo icon from sidebar header
- Keep navigation links clean (Home, Case Index, Market only)
- Telegram community link goes to Footer instead

### 1.6 Footer

**Changes:**
- Remove Logo icon
- Add "Komunitas" section with Telegram Group link → https://t.me/aivalidid
- Restructure footer layout for clean organization

### 1.7 Market ChatGPT

**Changes:**
- Badge "langsung" → "Live" with green dot indicator
- page.jsx metadata: "pembelian langsung" → "pembelian live"
- Polish spacing and card styling (consistent with existing style, NOT vibrant like home)

## Phase 2: Case List & Case Detail Redesign

**Status:** Complete

### 2.1 Case List (`/validation-cases`)

**Changes:**
- Header: Simplify description, more user-friendly language
- Case items → proper cards with:
  - Status badge (colored: Open=green, Completed=blue, Disputed=red)
  - Bounty amount prominent
  - Tags visible
  - Owner info (avatar + username)
  - Proportional font sizes, consistent spacing
- Style: Clean, consistent with rest of site (NOT vibrant like home)

### 2.2 Case Detail (`/validation-cases/[id]`)

**Changes:**
- Typography: Proportional font sizes, no oversized headings
- Spacing: Consistent padding/margin throughout
- Status badge: Clean, consistent with case list
- Section layout: Clear visual separation between sections
- Bounty display: More prominent
- Skeleton: Single skeleton that matches final layout exactly (no double transition)
- Style: Clean and consistent (NOT vibrant)

## Phases

| Phase | Scope | Files |
|-------|-------|-------|
| 1 | Home + Header/Footer/Sidebar + Market | Hero.jsx, HowItWorks.jsx, FocusAreas.jsx, LatestValidationCases.jsx, Header.jsx, Sidebar.jsx, Footer.jsx, MarketChatGPTClient.jsx, page.jsx (market) |
| 2 | Case List + Case Detail | ValidationCaseIndexClient.jsx, ValidationCaseDetailClient.jsx, ValidationCaseRecordSkeleton.jsx, validation-cases/page.jsx |
