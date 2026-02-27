# Code Review Workflow

## Step 1: Discover
```bash
bash .ai/context.sh
```

## Step 2: Understand the Change
- Read the full diff (all commits, not just latest)
- Understand the intent: what problem does this solve?

## Step 3: Review Against Rules
Check the diff against:
1. `.ai/RULES.md` — Convention compliance
2. `.ai/SECURITY.md` — All 12 security categories
3. `.ai/QUALITY.md` — Quality rubric dimensions

## Step 4: Output
Structure review as:

### Must Fix
Violations of critical rules (security, data integrity, financial rules).

### Should Fix
Convention deviations, quality issues, missing tests.

### Consider
Suggestions for improvement, alternative approaches.

### Good
Things done well — positive reinforcement.

## Checklist
- [ ] No hardcoded secrets or PII
- [ ] Financial amounts as integers
- [ ] Indonesian user-facing text
- [ ] Error handling follows AppError pattern
- [ ] Tests added for new logic
- [ ] No raw console.* (use logger)
- [ ] No Math.random() for security (use crypto.randomUUID())
- [ ] All images have alt attributes
- [ ] Dark mode and mobile tested
