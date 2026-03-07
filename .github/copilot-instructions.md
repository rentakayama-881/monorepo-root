# AIValid — GitHub Copilot Instructions

## AI Behavior (MANDATORY)

1. **Always ask clarifying questions** before implementing non-trivial changes
2. **Recommend the best engineering practice**, not the easiest solution
3. **Read existing code** before modifying it — understand context first
4. **Follow existing patterns** in the codebase

## First Action (Mandatory)

Before making ANY code change, run:

```bash
bash .ai/context.sh
```

This outputs the CURRENT state of the codebase. Never trust hardcoded numbers.

## Read These Files

1. `.ai/RULES.md` — Coding conventions
2. `.ai/ARCHITECTURE.md` — Service design, auth model, market feature
3. `.ai/QUALITY.md` — Quality gates
4. `.ai/SECURITY.md` — Security checklist (14 categories)

## Workflows

Read `.ai/prompts/{feature,fix,refactor,migrate,review,deploy,style-guide,audit}.md` depending on the task. Every workflow starts with **Step 0: Clarify** — ask before you build.

## Commit

```bash
./ops/commit-push.sh "type(scope): message"
```

## Truth Hierarchy

If docs conflict with `context.sh` output, the **script is correct**.
If docs conflict with actual code behavior, the **code is correct**.
