# AI Instruction System

This directory contains the **self-healing AI workflow** for the AIValid monorepo.
It works across all AI providers (Claude, Cursor, Copilot, Windsurf, ChatGPT).

## Core Principle: "Discover, Don't Trust"

Documentation describes **HOW to work** (process — stable).
Scripts discover **WHAT EXISTS** (state — always current).

AI assistants must run `context.sh` before any code change.
If docs conflict with script output, the **script is correct**.

## Files

| File | Purpose |
|------|---------|
| `context.sh` | Dynamic state discovery (versions, schemas, files, routes, quality) |
| `RULES.md` | Coding conventions, commit format, quality gates |
| `ARCHITECTURE.md` | Service design, domain model, financial rules |
| `QUALITY.md` | 9-dimension quality system, merge rules, coverage floors |
| `SECURITY.md` | 12-category defensive security checklist |
| `prompts/` | 6 workflow prompts (feature, fix, refactor, migrate, review, deploy) |

## Provider Integration

| Provider | Auto-read file | Points to |
|----------|---------------|-----------|
| Claude Code | `AGENTS.md` + `.claude/skills/fullstack/SKILL.md` | `.ai/` |
| Cursor | `.cursorrules` | `.ai/` |
| Windsurf | `.windsurfrules` | `.ai/` |
| Copilot | `.github/copilot-instructions.md` | `.ai/` |
| ChatGPT | User pastes `context.sh` output | `.ai/` |

## Why It Never Goes Stale

1. **`context.sh`** reads from `go.mod`, `package.json`, `ent/schema/*.go`, `git log` — always accurate
2. **Static docs** describe only process (how to commit, naming rules) — rarely changes
3. **No hardcoded versions, counts, or file lists** in any instruction file
4. **Provider shims** are 15-line pointers — nothing to maintain
