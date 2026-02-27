# AI Assistant Instructions

## First Action (Mandatory)

Before making ANY code change, run:

```bash
bash .ai/context.sh
```

This outputs the **current** state of the codebase: versions, schemas, file counts,
routes, and quality score. Never trust hardcoded numbers in documentation —
always run this script first.

## Instruction Files

Read these in order for full context:

1. `.ai/RULES.md` — Coding conventions and process rules
2. `.ai/ARCHITECTURE.md` — Service design and domain model
3. `.ai/QUALITY.md` — Quality gates and scoring system
4. `.ai/SECURITY.md` — 12-category security checklist

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

## Commit Workflow

```bash
./ops/commit-push.sh "type(scope): message"
```

## Critical Invariant

If documentation conflicts with `context.sh` output, **the script is correct**.
Documentation describes process. Scripts discover state.
