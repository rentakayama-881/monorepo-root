# Bug Fix Workflow

## Step 0: Clarify (MANDATORY)

Before diving into code, ask:

1. **What's the exact symptom?** — Error message, wrong behavior, or missing behavior?
2. **How to reproduce?** — Steps, URL, user role, environment
3. **When did it start?** — Recent deploy? New feature? Always been broken?
4. **What's the expected behavior?** — Don't assume — confirm with the user
5. **What's the blast radius?** — Does this affect payments, auth, or user data?

## Step 1: Discover
```bash
bash .ai/context.sh
```

## Step 2: Investigate Root Cause
- Read the failing code thoroughly — understand the full call chain
- Check git log for recent changes to the affected area
- Identify the **root cause**, not just the symptom
- Write a failing test that demonstrates the bug

**Share your root cause analysis with the user before fixing.** This prevents fixing the wrong thing.

## Step 3: Fix
- Propose the fix approach — explain WHY this fix is correct
- Make the minimal change that fixes the root cause
- Verify the test passes
- Check for related edge cases in the same area
- Do NOT fix unrelated code (but DO flag issues you notice for later)

## Step 4: Verify
```bash
./ops/preflight-full.sh
```

## Step 5: Ship
```bash
./ops/commit-push.sh "fix(scope): description"
```

## Checklist
- [ ] Root cause identified and confirmed with user (not just symptom patched)
- [ ] Regression test added
- [ ] No unrelated changes included
- [ ] Related edge cases checked
- [ ] Quality score maintained
- [ ] If financial/auth bug: security implications reviewed
