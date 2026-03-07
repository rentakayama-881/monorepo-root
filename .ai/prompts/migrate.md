# Migration Workflow (Schema / Dependency Changes)

## Step 0: Clarify (MANDATORY)

Migrations are high-risk. Confirm with the user:

1. **What exactly is changing?** — New field? New table? Dependency version bump?
2. **Is this additive or destructive?** — Adding is safe. Removing/renaming is dangerous.
3. **What's the rollback plan?** — How do we undo this if it goes wrong?
4. **Does this affect production data?** — If yes, extra caution required
5. **Are there dependent services?** — Will the Feature Service or Frontend break?

**NEVER proceed with destructive migrations without explicit user approval.**

## Step 1: Discover
```bash
bash .ai/context.sh
```
Pay special attention to current schema list and dependency versions.

## Step 2: Plan
- Document exactly what changes (before → after)
- Identify rollback strategy
- Prefer additive changes (new fields/tables) over destructive ones
- Check for compatibility with existing code
- Get user approval before proceeding

## Step 3: Implement

### Ent Schema Changes (Go)
1. Edit `backend/ent/schema/*.go`
2. Run `go generate ./ent`
3. Test: `go vet ./... && go test ./... -v`
4. Note: Ent uses `ent.Open("postgres", dsn)` — the dialect name "postgres" is required

### Dependency Changes (Frontend)
1. Update `frontend/package.json`
2. Run `npm install`
3. Test: `npm run lint && npm run test`

### Dependency Changes (Go)
1. `go get <package>@<version>`
2. `go mod tidy`
3. Test: `go vet ./... && go test ./... -v`
4. Note: Do NOT change `github.com/lib/pq` to pgx without refactoring `ent.Open()` calls

### .NET Changes
1. Update `.csproj`
2. `dotnet restore`
3. Test: `dotnet test`

## Step 4: Verify
```bash
./ops/preflight-full.sh
```

## Step 5: Ship
```bash
./ops/commit-push.sh "feat(scope): description"
```

## Known Pitfalls
- **lib/pq → pgx:** Ent's `Open("pgx", ...)` is NOT supported. The dialect must be "postgres". Migration requires using `entsql.OpenDB(dialect.Postgres, pgxDB)` pattern instead.
- **Ent schema field removal:** Requires careful migration — existing data may reference the field
- **Next.js major version:** Check App Router API changes, middleware behavior

## Checklist
- [ ] User approved the migration plan
- [ ] Migration is additive (no destructive changes without backup)
- [ ] Rollback path documented and tested
- [ ] All services build and test after migration
- [ ] No compatibility breaks with other services
