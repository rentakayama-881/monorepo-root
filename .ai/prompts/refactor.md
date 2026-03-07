# Refactor Workflow

## Step 0: Clarify (MANDATORY)

Before touching code, confirm with the user:

1. **What's the motivation?** — Performance? Readability? Modularity? Quality score?
2. **What's the scope?** — Single file? Module? Cross-cutting?
3. **Are there any behavior changes?** — Refactors must be behavior-preserving by default
4. **Is the area well-tested?** — If not, write tests BEFORE refactoring

## Step 1: Discover
```bash
bash .ai/context.sh
bash ops/quality-score.sh
```

## Step 2: Identify Hotspot
- Review quality score dimensions — which is lowest?
- Identify specific code smell, duplication, or modularity issue
- Verify existing tests cover the code being refactored
- Share findings and proposed approach with user

## Step 3: Plan
- List exact files to change
- Describe the transformation (extract function, split file, centralize, etc.)
- Confirm **zero behavior change**
- If splitting a large Go file: same-package decomposition (see market handler pattern in `.ai/ARCHITECTURE.md`)
- If splitting a large frontend file: extract hooks/utils first, then components
- Get user approval before starting

## Step 4: Implement
- Ensure all existing tests pass at each step
- If splitting a large file: extract one logical group at a time, build + test after each
- Verify no new dependencies are introduced

## Step 5: Verify
```bash
bash ops/quality-score.sh    # Score should improve
./ops/preflight-full.sh      # All checks pass
```

## Step 6: Ship
```bash
./ops/commit-push.sh "refactor(scope): description"
```

## Checklist
- [ ] Motivation discussed with user
- [ ] No behavior change (pure structural improvement)
- [ ] All existing tests pass after each extraction step
- [ ] Quality score improved or unchanged
- [ ] No new dependencies added
- [ ] Build verified after the split (no redeclaration or missing import errors)
