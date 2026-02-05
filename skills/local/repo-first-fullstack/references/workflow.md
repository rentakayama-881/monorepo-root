# Workflow (Discovery-First, Evidence-Backed)

## Phase A — Discovery (mandatory)

Goal: build an evidence-based map of the repo and (optionally) runtime without assuming paths/endpoints.

### A1) Minimal repo map

Run (or equivalent) and capture output excerpts:

```bash
pwd
ls -lah
git status
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
```

Find stack entrypoints (do not assume locations):

```bash
find . -maxdepth 4 -type f \( -name "package.json" -o -name "go.mod" -o -name "*.csproj" -o -name "Program.cs" -o -name "main.go" \)
```

Search for stack markers:

```bash
rg -n "next|app router|tailwind|globals\\.css|ThemeProvider|Providers" .
rg -n "gin\\.Default|gin\\.New|router\\.Group|http\\.ListenAndServe" .
rg -n "MapControllers|AddControllers|WebApplication\\.CreateBuilder|UseRouting" .
```

If `rg` is not installed, use `git grep` as a fast fallback:

```bash
git grep -n -E -- 'next|app router|tailwind|globals\\.css|ThemeProvider|Providers' -- .
git grep -n -E -- 'gin\\.Default|gin\\.New|router\\.Group|http\\.ListenAndServe' -- .
git grep -n -E -- 'MapControllers|AddControllers|WebApplication\\.CreateBuilder|UseRouting' -- .
```

Locate API call sites on frontend (for integration correctness):

```bash
rg -n "fetch\\(|axios|ky\\(|baseURL|API_URL|NEXT_PUBLIC|FEATURE" . -S
```

### A2) Runtime/services map (read-only; only if applicable)

If systemd is present:

```bash
systemctl list-units --type=service | rg -i "nginx|backend|feature|api" || true
journalctl -u nginx -n 100 --no-pager -o cat || true
journalctl -u backend -n 200 --no-pager -o cat || true
journalctl -u feature-service -n 200 --no-pager -o cat || true
```

If Docker is used:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" || true
docker logs --tail 200 SERVICE || true
```

### A3) Evidence ledger (what to record)

Record:
- Repo root layout (top folders)
- Entry points for each service (file paths + excerpts)
- Endpoint registration evidence (route setup excerpts)
- Frontend API wrapper evidence (fetch/helper excerpts)
- Env/config usage evidence (names only; redact values)
- Any contradictions and what you used as truth

Tip for file excerpts with line numbers:

```bash
nl -ba path/to/file | sed -n 'START,ENDp'
```

## Safe-mode command policy

Allowed by default:
- Repo inspection: `pwd`, `ls`, `cat`, `head`, `tail`, `sed -n`, `nl -ba`
- Search: `find`, `rg`, `grep`
- Git read-only: `git status`, `git diff`, `git log -1`, `git rev-parse`
- Build/test (only after discovering the correct tool/lockfile): `npm|pnpm|yarn`, `go test ./...`, `dotnet test`
- Read-only runtime: `systemctl status SERVICE`, `journalctl -u SERVICE ...`, `docker ps`, `docker logs --tail ...`

Not allowed unless explicitly requested:
- deleting files, resets/force pushes
- editing secrets/env or printing secret values
- key rotation, database migrations
- restarting services

## Stop conditions (halt and report)

Stop and report if:
- Frontend calls an endpoint that is not registered in backend code.
- Backend requires auth/headers/idempotency that frontend does not send (or vice versa).
- Docs contradict code in a way that affects correctness.
- Tests/build cannot run due to missing environment prerequisites (report exact missing items).

## Quickstart (5 minutes)

1) Generate an evidence ledger:

```bash
python3 skills/local/repo-first-fullstack/scripts/discovery_repo.py --out /tmp/evidence-ledger.md
```

2) Pick one concrete use case (UI modernization or integration correctness) and implement the smallest safe change.
3) Validate with the narrowest relevant build/tests.
4) Produce the full report using `references/output-template.md`.
