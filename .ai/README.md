# AI Instruction System

This directory contains the **self-healing AI workflow** for the AIValid monorepo.
It works across all AI providers (Claude, Cursor, Copilot, Windsurf, ChatGPT).

## Core Principles

### 1. "Discover, Don't Trust"
Documentation describes **HOW to work** (process — stable).
Scripts discover **WHAT EXISTS** (state — always current).
AI assistants must run `context.sh` before any code change.
If docs conflict with script output, the **script is correct**.

### 2. "Ask, Don't Assume"
Every workflow prompt starts with **Step 0: Clarify** — mandatory clarification questions.
AI agents must ask probing questions before implementing, especially for non-trivial changes.
It is always better to ask one too many questions than to make one wrong assumption.

### 3. "Best Practice, Not Easiest Practice"
AI agents should recommend the best engineering approach, not the quickest hack.
Reference how top-tier teams (Anthropic, Stripe, Vercel, Supabase) would solve the problem.

## Files

| File | Purpose |
|------|---------|
| `context.sh` | Dynamic state discovery (versions, schemas, files, routes, quality) |
| `RULES.md` | Coding conventions, commit format, quality gates |
| `ARCHITECTURE.md` | Service design, domain model, financial rules, auth architecture |
| `QUALITY.md` | 9-dimension quality system, merge rules, improvement protocol |
| `SECURITY.md` | 14-category defensive security checklist |
| `prompts/` | 8 workflow prompts (feature, fix, refactor, migrate, review, deploy, style-guide, audit) |

## Provider Integration

| Provider | Auto-read file | Points to |
|----------|---------------|-----------|
| Claude Code | `CLAUDE.md` | `.ai/` |
| Cursor | `.cursorrules` | `.ai/` |
| Windsurf | `.windsurfrules` | `.ai/` |
| Copilot | `.github/copilot-instructions.md` | `.ai/` |
| ChatGPT | User pastes `context.sh` output | `.ai/` |

## Why It Never Goes Stale

1. **`context.sh`** reads from `go.mod`, `package.json`, `ent/schema/*.go`, `git log` — always accurate
2. **Static docs** describe only process (how to commit, naming rules) — rarely changes
3. **No hardcoded versions, counts, or file lists** in any instruction file
4. **Provider shims** are short pointers — nothing to maintain
5. **Audit prompt** includes doc accuracy verification step
