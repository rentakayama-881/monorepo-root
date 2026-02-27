# Plan: Self-Healing AI Workflow System

**Date:** 2026-02-27
**Goal:** Buat sistem instruksi AI yang tidak pernah basi — AI selalu membaca kondisi faktual repo sebelum bekerja, lintas provider (Claude, Cursor, Copilot, Windsurf, ChatGPT).

---

## Diagnosis: Masalah Saat Ini

8 file instruksi AI (1.296 baris total, ~40% overlap):

| File | Baris | Masalah |
|------|-------|---------|
| `AGENTS.md` | 67 | Campur proses + state, referensi path user-home |
| `.claude/skills/fullstack/SKILL.md` | 441 | Hardcode: "25 Ent schemas", "Go 1.24.5", "Next.js 16.1.6" |
| `docs/AI_OPERATING_SYSTEM.md` | 87 | OK — sudah stabil, fokus ops |
| `docs/SUPERPOWER_SKILL_OPERATIONS.md` | 312 | ~60% overlap dengan SKILL.md |
| `docs/frontend/QUALITY_RUBRIC.md` | 51 | OK — stabil |
| `docs/QUALITY_CONTRACT_2026.md` | 113 | OK — stabil |
| `.github/instructions/CODEBASE_RULES.md` | 198 | Tulis "Next.js 15" padahal sudah 16, IP salah |
| `.github/instructions/com.instructions.md` | 27 | OK — working agreement |

**Fakta yang sudah salah/akan salah:**
- SKILL.md: "25 Ent schemas" — sebenarnya ada 26 (IpGeoCache sudah ditambah)
- CODEBASE_RULES.md: "Next.js 15" — sebenarnya Next.js 16
- SKILL.md: pin exact version "16.1.6", "19.1.0" — akan drift saat upgrade

---

## Prinsip Desain: "Discover, Don't Trust"

> Dokumentasi statis = menjelaskan **CARA KERJA** (proses — jarang berubah)
> Script dinamis = menemukan **APA YANG ADA** (state — selalu berubah)

AI tidak boleh percaya angka hardcode. AI harus **jalankan script** untuk tahu state terkini.

---

## Struktur File Baru

```
monorepo-root/
├── AGENTS.md                          # REWRITE: 30 baris, bootstrap universal
├── .ai/                               # NEW: Direktori instruksi universal
│   ├── README.md                      # Penjelasan sistem untuk manusia
│   ├── context.sh                     # Script discovery state dinamis
│   ├── RULES.md                       # Konsolidasi aturan proses (stabil)
│   ├── ARCHITECTURE.md                # Arsitektur tanpa versi (stabil)
│   ├── QUALITY.md                     # Gabungan rubrik kualitas (stabil)
│   ├── SECURITY.md                    # Checklist keamanan (stabil)
│   └── prompts/                       # Workflow prompt berpasangan
│       ├── feature.md
│       ├── fix.md
│       ├── refactor.md
│       ├── migrate.md
│       ├── review.md
│       └── deploy.md
├── .cursorrules                       # NEW: Shim → .ai/
├── .windsurfrules                     # NEW: Shim → .ai/
├── .github/copilot-instructions.md    # NEW: Shim → .ai/
└── .claude/skills/fullstack/SKILL.md  # REWRITE: Referensi .ai/
```

---

## Inovasi Inti: `.ai/context.sh`

Script yang **menggantikan semua fakta hardcode**. Output-nya:

```
=== GIT STATE ===
Branch: main | SHA: 1ded875 | Dirty: 0 files

=== VERSIONS (from source files) ===
Go: 1.24.5 | Next.js: ^16.1.6 | React: 19.1.0 | .NET: net8.0

=== ENT SCHEMAS ===
Count: 26
Names: Admin, BackupCode, Badge, Category, ...

=== FILE COUNTS ===
Frontend source: 208 | Frontend tests: 21
Backend .go: 89 | Backend tests: 16

=== FRONTEND PAGES (app router) ===
/page.jsx, /login/page.jsx, /account/page.jsx, ...

=== LAST QUALITY REPORT ===
FINAL QUALITY SCORE: 77 / 100
```

Script ini membaca dari `go.mod`, `package.json`, `ent/schema/*.go`, dll — **selalu akurat tanpa maintenance manual**.

---

## AGENTS.md Baru (~30 baris)

```markdown
# AI Assistant Instructions

## First Action (Mandatory)
Before making ANY code change, run:
  bash .ai/context.sh

This outputs CURRENT state. Never trust hardcoded numbers in docs.

## Instruction Files (read in order)
1. .ai/RULES.md — Coding conventions
2. .ai/ARCHITECTURE.md — Service design
3. .ai/QUALITY.md — Quality gates
4. .ai/SECURITY.md — Security checklist

## Workflow Prompts
- .ai/prompts/feature.md — New features
- .ai/prompts/fix.md — Bug fixes
- .ai/prompts/refactor.md — Refactoring
- .ai/prompts/migrate.md — Migration
- .ai/prompts/review.md — Code review
- .ai/prompts/deploy.md — Deployment

## Critical Invariant
If docs conflict with context.sh output, the SCRIPT is correct.
```

---

## Provider Shim Strategy

| Provider | File auto-read | Isi |
|----------|---------------|-----|
| Claude Code | `AGENTS.md` + `.claude/skills/` | Keduanya → `.ai/` |
| Cursor | `.cursorrules` | 15 baris → `.ai/` |
| Windsurf | `.windsurfrules` | 15 baris → `.ai/` |
| Copilot | `.github/copilot-instructions.md` | 15 baris → `.ai/` |
| Codex/OpenAI | `AGENTS.md` | Sudah ter-cover |
| ChatGPT manual | User paste | User jalankan `context.sh`, paste output |

Setiap shim hanya 10-15 baris: "jalankan context.sh, baca .ai/". **Zero state, zero maintenance.**

---

## Workflow Prompts (6 pasang)

Setiap prompt mengikuti pola yang sama:

```
1. DISCOVER — bash .ai/context.sh
2. ANALYZE — pahami area yang terdampak
3. PLAN — buat spec, minta approval
4. IMPLEMENT — kerjakan dengan quality gates
5. VERIFY — bash ops/quality-score.sh
6. SHIP — bash ops/commit-push.sh
```

| Prompt | Untuk |
|--------|-------|
| `feature.md` | Fitur baru: spec → plan → RED/GREEN/REFACTOR |
| `fix.md` | Bug fix: reproduce → root cause → minimal fix → regression test |
| `refactor.md` | Refactor: quality score → identify hotspot → zero behavior change |
| `migrate.md` | Schema/dependency migration: rollback plan → additive first |
| `review.md` | Code review: diff vs RULES + SECURITY + QUALITY |
| `deploy.md` | Deploy: preflight → deploy → verify-live → rollback jika gagal |

---

## Cara Sistem Tetap Fresh Tanpa Maintenance

| Mekanisme | Cara Kerja |
|-----------|-----------|
| **Dynamic discovery** | `context.sh` baca `go.mod`, `package.json`, `ls ent/schema/` — selalu akurat |
| **Process-only docs** | `.ai/RULES.md` jelaskan CARA, bukan STATE — jarang berubah |
| **Script-as-truth** | `quality-score.sh` ADALAH rubriknya, bukan deskripsi rubrik |
| **Redundancy elimination** | 8 file overlap → 6 file tanpa overlap = 1 tempat update |
| **Git history** | `context.sh` output SHA + recent commits — selalu tersedia |

---

## Aksi per File Lama

| Aksi | File | Alasan |
|------|------|--------|
| ARCHIVE | `docs/SUPERPOWER_SKILL_OPERATIONS.md` | Diserap ke `.ai/SECURITY.md` + `.ai/ARCHITECTURE.md` |
| ARCHIVE | `.github/instructions/CODEBASE_RULES.md` | Diserap ke `.ai/RULES.md`, diganti `copilot-instructions.md` |
| KEEP | `docs/AI_OPERATING_SYSTEM.md` | Sudah stabil, fokus ops |
| KEEP | `docs/frontend/QUALITY_RUBRIC.md` | Sudah stabil |
| KEEP | `docs/QUALITY_CONTRACT_2026.md` | Sudah stabil |
| KEEP | `.github/instructions/com.instructions.md` | Working agreement — stabil |
| REWRITE | `AGENTS.md` | Slim down ke ~30 baris universal bootstrap |
| REWRITE | `.claude/skills/fullstack/SKILL.md` | Hapus semua hardcode, referensi `.ai/` |

---

## Implementation Tasks

### Phase 1: Core Infrastructure
1. Create `.ai/context.sh` — dynamic state discovery script
2. Create `.ai/README.md` — penjelasan sistem untuk manusia
3. Test `context.sh` output akurat

### Phase 2: Consolidated Docs
4. Write `.ai/RULES.md` — konsolidasi process rules dari 4 file
5. Write `.ai/ARCHITECTURE.md` — arsitektur stabil tanpa versi
6. Write `.ai/QUALITY.md` — gabungan quality system
7. Write `.ai/SECURITY.md` — defensive security checklist

### Phase 3: Workflow Prompts
8. Write `.ai/prompts/feature.md`
9. Write `.ai/prompts/fix.md`
10. Write `.ai/prompts/refactor.md`
11. Write `.ai/prompts/migrate.md`
12. Write `.ai/prompts/review.md`
13. Write `.ai/prompts/deploy.md`

### Phase 4: Entry Points & Shims
14. Rewrite `AGENTS.md` — slim universal bootstrap
15. Rewrite `.claude/skills/fullstack/SKILL.md` — referensi `.ai/`
16. Create `.cursorrules`
17. Create `.windsurfrules`
18. Create `.github/copilot-instructions.md`

### Phase 5: Archive & Cleanup
19. Archive `docs/SUPERPOWER_SKILL_OPERATIONS.md` → `docs/archive/ai-legacy/`
20. Archive `.github/instructions/CODEBASE_RULES.md` → `docs/archive/ai-legacy/`
21. Commit all changes

### Phase 6: Validate
22. Run `context.sh` dan verifikasi output
23. Simulasi fresh AI session — apakah AGENTS.md + context.sh berikan konteks yang benar?
