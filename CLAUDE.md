# CLAUDE.md — AI Development Instructions

## First Action (Mandatory)

Before making ANY code change, run:

```bash
bash .ai/context.sh
```

This outputs the **current** state of the codebase: versions, schemas, file counts,
routes, and quality score. Never trust hardcoded numbers — always discover state dynamically.

## Instruction Files

Read these in order for full context:

1. `.ai/RULES.md` — Coding conventions, commit format, design tokens, invariants
2. `.ai/ARCHITECTURE.md` — Service boundaries, domain model, middleware stack
3. `.ai/QUALITY.md` — 9-dimension quality scoring, coverage floors, merge rules
4. `.ai/SECURITY.md` — 12-category defensive security checklist

## Workflow Prompts

For specific tasks, read the matching workflow in `.ai/prompts/`:

| Task | Prompt |
|------|--------|
| New feature | `.ai/prompts/feature.md` |
| Bug fix | `.ai/prompts/fix.md` |
| Refactor | `.ai/prompts/refactor.md` |
| Migration | `.ai/prompts/migrate.md` |
| Code review | `.ai/prompts/review.md` |
| Deploy | `.ai/prompts/deploy.md` |
| Frontend styling | `.ai/prompts/style-guide.md` |
| Repo audit/cleanup | `.ai/prompts/audit.md` |

## Quality Gate (Before Every Commit)

```bash
./ops/preflight-full.sh
```

## Commit + Push

```bash
./ops/commit-push.sh "type(scope): message"
```

This automatically runs preflight, commits, and pushes. On `main`, it also triggers VPS deploy.

## Degrees of Freedom

### Agent Decides
- File organization within established patterns
- Variable/function naming following conventions
- Which existing UI components to compose
- Tailwind utility classes following `.ai/prompts/style-guide.md`
- SWR cache keys and revalidation strategy
- Error message wording (Indonesian, matching existing tone)
- Commit message content (conventional commits format)
- Test structure and assertions

### Agent Asks First
- New Ent schema or field changes
- New API endpoint design
- Financial rule changes (amounts, fees, limits)
- Adding new dependencies
- Auth/authorization logic changes
- Workflow state machine changes
- Deployment config changes
- Removing features or endpoints
- Destructive database operations

## Critical Invariant

If documentation conflicts with `context.sh` output, **the script is correct**.
Documentation describes process. Scripts discover state.
