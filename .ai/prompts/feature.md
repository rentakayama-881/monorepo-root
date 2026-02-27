# Feature Workflow

## Step 1: Discover
```bash
bash .ai/context.sh
```
Read `.ai/RULES.md` and `.ai/ARCHITECTURE.md` for conventions.

## Step 2: Spec
Before writing code, state clearly:
- **Goal** — what this feature does
- **Non-goals** — what it does NOT do
- **Edge cases** — error states, empty states, loading states
- **API changes** — new endpoints, request/response shapes
- **UX changes** — new pages, components, flows
- **Acceptance criteria** — how to verify it works

Wait for user approval before proceeding.

## Step 3: Plan
Break into 2-10 small tasks with exact file paths and verification steps.

## Step 4: Implement
- Write failing test first (RED)
- Make smallest change to pass (GREEN)
- Refactor if needed (REFACTOR)
- User-facing text in Indonesian
- Support dark mode + mobile viewport
- Use existing UI components from `components/ui/`

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
- [ ] User-facing text in Indonesian
- [ ] Dark mode tested
- [ ] Mobile responsive
- [ ] Loading/error/empty states handled
- [ ] Existing UI components reused
- [ ] Tests added for new logic
- [ ] Quality score maintained or improved
