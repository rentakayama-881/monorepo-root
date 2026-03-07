# Feature Workflow

## Step 0: Clarify (MANDATORY — before writing any code)

Ask these questions. Do NOT proceed until you have clear answers:

1. **What problem does this solve?** — Understand the user's actual need, not just the stated request
2. **Who uses this?** — Which user role (owner, validator, admin, public)?
3. **What's the scope?** — Backend only? Frontend only? Both? Feature Service?
4. **What should NOT change?** — Identify boundaries and non-goals
5. **Are there financial implications?** — Any money/wallet/escrow involved?
6. **Are there auth implications?** — Does this need login? Admin? Sudo?

If the user's answer is vague, ask follow-up questions. It is better to over-clarify than to build the wrong thing.

## Step 1: Discover
```bash
bash .ai/context.sh
```
Read `.ai/RULES.md` and `.ai/ARCHITECTURE.md` for conventions.

## Step 2: Spec
Before writing code, state clearly:
- **Goal** — what this feature does (one sentence)
- **Non-goals** — what it explicitly does NOT do
- **Edge cases** — error states, empty states, loading states
- **API changes** — new endpoints, request/response shapes, auth requirements
- **UX changes** — new pages, components, flows
- **Data changes** — new Ent schemas, new MongoDB collections, migrations
- **Acceptance criteria** — specific, testable statements of "done"

**Present 2-3 implementation approaches** with trade-offs. Recommend the best one.
Wait for user approval before proceeding.

## Step 3: Plan
Break into 2-10 small tasks with:
- Exact file paths
- What changes in each file
- Verification command for each task
- Dependencies between tasks

## Step 4: Implement
- Write failing test first (RED)
- Make smallest change to pass (GREEN)
- Refactor if needed (REFACTOR)
- User-facing text in Indonesian
- Support dark mode + mobile viewport
- Use existing UI components from `components/ui/`
- Follow existing patterns — check how similar features are built

## Step 5: Verify
```bash
bash ops/quality-score.sh
./ops/preflight-full.sh
```

## Step 6: Ship
```bash
./ops/commit-push.sh "feat(scope): description"
```

## Checklist
- [ ] Clarification questions asked and answered
- [ ] User approved the spec before implementation
- [ ] User-facing text in Indonesian
- [ ] Dark mode tested
- [ ] Mobile responsive
- [ ] Loading/error/empty states handled
- [ ] Existing UI components reused
- [ ] Tests added for new logic
- [ ] Security checklist reviewed (`.ai/SECURITY.md`)
- [ ] Quality score maintained or improved
