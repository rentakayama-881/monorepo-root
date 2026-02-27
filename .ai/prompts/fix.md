# Bug Fix Workflow

## Step 1: Discover
```bash
bash .ai/context.sh
```

## Step 2: Reproduce
- Identify exact failure (error message, stack trace, or behavior)
- Find root cause file and line
- Write a failing test that demonstrates the bug

## Step 3: Fix
- Make the minimal change that fixes the bug
- Verify the test passes
- Check for related edge cases
- Do NOT fix unrelated code

## Step 4: Verify
```bash
./ops/preflight-full.sh
```

## Step 5: Ship
```bash
./ops/commit-push.sh "fix(scope): description"
```

## Checklist
- [ ] Root cause identified (not just symptom patched)
- [ ] Regression test added
- [ ] No unrelated changes included
- [ ] Quality score maintained
