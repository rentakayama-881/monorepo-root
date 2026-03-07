# Code Review Workflow

## Philosophy

Review as if you're the last line of defense before production. Be thorough, specific, and constructive. Recommend the BEST solution, not the easiest.

## Step 1: Discover
```bash
bash .ai/context.sh
```

## Step 2: Understand the Change
- Read the **full diff** (all commits, not just latest)
- Understand the intent: what problem does this solve?
- Check if the approach follows existing patterns in the codebase
- Verify the change is complete (no missing files, no partial implementations)

## Step 3: Review Against Standards

Check the diff against:
1. `.ai/RULES.md` — Convention compliance
2. `.ai/SECURITY.md` — All 14 security categories
3. `.ai/QUALITY.md` — Quality rubric dimensions
4. `.ai/ARCHITECTURE.md` — Service boundaries, patterns, financial rules

## Step 4: Output

Structure review as:

### Must Fix (P0)
Violations of critical rules: security vulnerabilities, data integrity issues, financial rule violations, auth bypasses.

### Should Fix (P1)
Convention deviations, quality issues, missing tests, missing error handling, accessibility gaps.

### Consider (P2)
Suggestions for improvement, alternative approaches, performance optimizations, better patterns.

### Good
Things done well — positive reinforcement for patterns worth repeating.

## Step 5: Verify Claims

**NEVER trust that tests pass based on code alone. Run them:**
```bash
./ops/preflight-full.sh
```

If the PR claims "all tests pass" — verify it. Evidence before assertions.

## Checklist
- [ ] Full diff reviewed (all commits, not just latest)
- [ ] No hardcoded secrets or PII exposure
- [ ] Financial amounts as integers (never floats)
- [ ] Indonesian user-facing text
- [ ] Error handling follows `AppError` pattern (Go) or FluentValidation (.NET)
- [ ] Tests added for new logic
- [ ] No raw `console.*` (use `logger`)
- [ ] No `Math.random()` for security (use `crypto.randomUUID()`)
- [ ] All images have `alt` attributes
- [ ] Dark mode and mobile tested (for frontend changes)
- [ ] API env vars use `NEXT_PUBLIC_API_BASE_URL` only (no legacy names)
- [ ] Presence cookies maintained if auth flow changed
- [ ] Market handler changes touch correct decomposed file (types/helpers/listing/orders/handler)
