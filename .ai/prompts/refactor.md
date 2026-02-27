# Refactor Workflow

## Step 1: Discover
```bash
bash .ai/context.sh
bash ops/quality-score.sh
```

## Step 2: Identify Hotspot
- Review quality score dimensions — which is lowest?
- Identify specific code smell, duplication, or modularity issue
- Verify existing tests cover the code being refactored

## Step 3: Plan
- List exact files to change
- Describe the transformation (extract function, split file, centralize, etc.)
- Confirm **zero behavior change**
- Get user approval before starting

## Step 4: Implement
- Ensure all existing tests pass at each step
- If splitting a large file: extract components one at a time, verify after each

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
- [ ] No behavior change (pure structural improvement)
- [ ] All existing tests pass
- [ ] Quality score improved or unchanged
- [ ] No new dependencies added
