# Migration Workflow (Schema / Dependency Changes)

## Step 1: Discover
```bash
bash .ai/context.sh
```
Pay special attention to current schema list and dependency versions.

## Step 2: Plan
- Document exactly what changes
- Identify rollback strategy
- Prefer additive changes (new fields/tables) over destructive ones
- Get user approval before proceeding

## Step 3: Implement

### Ent Schema Changes (Go)
1. Edit `backend/ent/schema/*.go`
2. Run `go generate ./ent`
3. Test: `go test ./... -v`

### Dependency Changes (Frontend)
1. Update `frontend/package.json`
2. Run `npm install`
3. Test: `npm run lint && npm run test`

### Dependency Changes (Go)
1. `go get <package>@<version>`
2. `go mod tidy`
3. Test: `go test ./... -v`

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

## Checklist
- [ ] Migration is additive (no destructive changes without backup)
- [ ] Rollback path documented
- [ ] User approved change before implementation
- [ ] All tests pass after migration
