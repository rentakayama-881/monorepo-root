# Load Testing (k6) — AIValid Platform

## Prerequisites

k6 is **not currently installed** on this machine.

### Install k6

```bash
# Debian / Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6

# Docker (no install needed)
docker run --rm -i grafana/k6 run - < tests/load/smoke.js
```

Full instructions: <https://k6.io/docs/get-started/installation/>

## Run Tests

```bash
# Smoke test — quick health check (1 VU, 30s)
k6 run tests/load/smoke.js

# Auth flow test — login simulation (10 VUs, 1m)
k6 run tests/load/auth-flow.js

# Stress test — ramp to 50 VUs
k6 run tests/load/stress.js
```

### Override URLs

All scripts default to production URLs. Override with environment variables for
local or staging environments:

```bash
k6 run \
  -e BASE_URL_API=http://localhost:8080 \
  -e BASE_URL_FEATURE=http://localhost:5000 \
  -e BASE_URL_FRONTEND=http://localhost:3000 \
  tests/load/smoke.js
```

### Auth Flow with Credentials

```bash
k6 run \
  -e TEST_EMAIL=test@example.com \
  -e TEST_PASSWORD='s3cret!' \
  tests/load/auth-flow.js
```

## Scripts Overview

| Script | What it tests | VUs | Duration | Key threshold |
|--------|---------------|-----|----------|---------------|
| `smoke.js` | Health endpoints (API, Feature, Frontend) | 1 | 30s | p95 < 500ms, errors < 1% |
| `auth-flow.js` | Login endpoint (`POST /api/v1/auth/login`) | 10 | 1m | p95 < 1000ms |
| `stress.js` | Health endpoints under load | 0→50→0 | 2m | p95 < 2000ms, errors < 5% |

## Baseline Targets

| Metric | Target |
|--------|--------|
| p95 latency (normal) | < 500ms |
| p95 latency (stress) | < 2000ms |
| Error rate (normal) | < 1% |
| Error rate (stress) | < 5% |
| Concurrent users | 50+ |

## Endpoints Tested

| Endpoint | Service | Notes |
|----------|---------|-------|
| `GET /health` | Go backend (`api.aivalid.id`) | Lightweight readiness probe |
| `GET /api/v1/health` | Feature Service (`feature.aivalid.id`) | .NET health check |
| `GET /` | Frontend (`aivalid.id`) | Next.js SSR |
| `POST /api/v1/auth/login` | Go backend (`api.aivalid.id`) | Rate-limited auth endpoint |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL_API` | `https://api.aivalid.id` | Go backend base URL |
| `BASE_URL_FEATURE` | `https://feature.aivalid.id` | Feature Service base URL |
| `BASE_URL_FRONTEND` | `https://aivalid.id` | Frontend base URL |
| `TEST_EMAIL` | `loadtest@example.com` | Test account email |
| `TEST_PASSWORD` | `LoadTest_P@ssw0rd!` | Test account password |

## Notes

- **Rate limiting**: The Go backend uses `EnhancedRateLimiter` middleware.
  Running stress tests against production may trigger rate limits. Use
  local/staging URLs for heavy tests.
- **Auth test**: Uses placeholder credentials by default. The test still
  measures latency even when the backend returns 401 (invalid credentials).
  Supply real test-account credentials via env vars for full flow testing.
- **No paid services**: All tests run locally with the open-source k6 CLI.
  No cloud subscriptions required.
