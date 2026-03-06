# Targeted Depth Audit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize the market feature (biggest pain point), harden security, and fix quality issues to raise the quality score from 77 to 80+.

**Architecture:** Four phases executed sequentially. Phase 1 decomposes the 2,943-line market handler into a service layer + thin handler. Phase 2 adds Next.js edge middleware and fixes go vet. Phase 3 cleans up docs/deps. Phase 4 validates everything.

**Tech Stack:** Go/Gin (backend), Next.js 16/React 19 (frontend), Ent ORM, SWR, Tailwind v4

---

## Phase 1: Stabilize Market Feature

### Task 1: Fix go vet — deduplicate roundTripFunc in backend test files

The `roundTripFunc` type is declared in both `services/lzt_market_client_test.go:14` and `services/feature_wallet_client_test.go:12` (same Go package). This causes `go vet` to fail with "redeclared in this block".

**Files:**
- Modify: `backend/services/lzt_market_client_test.go:14-18`

**Step 1: Remove the duplicate type from lzt_market_client_test.go**

The type already exists in `feature_wallet_client_test.go:12`. Remove lines 14-18 from `lzt_market_client_test.go` (the type declaration and RoundTrip method). Also remove the unused `newJSONResponse` helper if it's only used locally — check first.

The `newJSONResponse` helper in `lzt_market_client_test.go:20-28` is only used in that file, so keep it. Only remove the `roundTripFunc` type and `RoundTrip` method.

**Step 2: Run go vet to verify fix**

Run: `cd backend && go vet ./...`
Expected: No errors (0 exit code)

**Step 3: Run tests to verify nothing broke**

Run: `cd backend && go test ./services/... -v -count=1 -run "TestLZTMarketClient|TestFeatureWallet" 2>&1 | tail -20`
Expected: All PASS

**Step 4: Commit**

```bash
git add backend/services/lzt_market_client_test.go
git commit -m "fix(backend): deduplicate roundTripFunc in service test files"
```

---

### Task 2: Extract market service layer from handler — types and helpers

Extract pure functions and types from `lzt_market_handler.go` into a new `backend/services/lzt_market_service.go`. This is the core decomposition — moving ~1,000+ lines of business logic out of the handler.

**Files:**
- Create: `backend/services/lzt_market_service.go`
- Create: `backend/services/lzt_market_types.go`
- Modify: `backend/handlers/lzt_market_handler.go`

**Step 1: Create `backend/services/lzt_market_types.go`**

Move these types from the handler to the new file:
- `supplierBalanceState` type + constants (`enough`, `insufficient`, `unknown`)
- `supplierBalanceCheckResult` struct
- `providerItemReadiness` struct

**Step 2: Create `backend/services/lzt_market_service.go`**

Move these pure/helper functions from the handler (they have no handler receiver or only use `h.client` / `h.fxRates`):
- `normalizeItemID`
- `normalizeProviderIDValue`
- `normalizeItemTitle`
- `normalizeItemPrice`
- `extractNumericPrice`
- `normalizeItemState`
- `normalizeSeller`
- `extractCanBuyItem`
- `extractCannotBuyItemError`
- `extractListMaps`
- `cloneStringAnyMap`
- `cloneLZTMarketResponse`
- `cloneJSONValue`
- `extractPositiveIntFromMap`
- `extractBoolFromMap`
- `extractFloatFromMap`
- `parseProviderNumericString`
- `evaluateSupplierBalance`
- `extractSupplierBalanceFromProfile`
- `applyPriceFactor`
- `formatIDR`
- `formatSourcePrice`
- `formatThousands`
- `currencySymbol`
- `buildLZTItemURL`
- `normalizeProviderFailureReason`
- `normalizeUserFacingFailureReason`
- `normalizeCheckerErrorMessage`
- `isProviderIntegrationFailureReason`
- `extractProviderErrors`
- `hasStatusValue`
- `normalizeProviderPath`
- `logMarketOrderReject`
- `toProviderConfirmPrice`
- `newPublicMarketOrderID`
- `readPositiveIntEnvLocal`
- `readBoolEnvLocal`
- `isRetryRequestResponse`
- `isSuccessfulPurchaseResponse`
- `hasPurchasingPayload`
- `shouldFallbackAfterFastBuy`
- `shouldTryConfirmBuyFallback`
- `isHardFailResponse`
- `extractDeliveryPayload`
- `extractCredentialsFromBuyResponse`
- `extractPurchasedItemSummary`
- `readMap`
- `firstNonEmptyString`

These are all pure functions with no handler state dependency.

**Step 3: Update handler imports**

In `lzt_market_handler.go`, update references to use `services.NormalizeItemID(...)` etc. for any functions that were promoted to exported. Keep unexported functions that are only used in the handler in the handler file.

Alternatively (simpler): since both files are in different packages (`handlers` vs `services`), the extracted functions need to be exported (capitalized). The handler will import them via `services.FormatIDR(...)` etc.

**Step 4: Verify compilation**

Run: `cd backend && go build ./...`
Expected: Compiles successfully

**Step 5: Run all backend tests**

Run: `cd backend && go test ./... -count=1 2>&1 | tail -20`
Expected: All PASS

**Step 6: Commit**

```bash
git add backend/services/lzt_market_service.go backend/services/lzt_market_types.go backend/handlers/lzt_market_handler.go
git commit -m "refactor(backend): extract market pure functions to service layer"
```

---

### Task 3: Extract market order persistence into service

Move order CRUD operations from the handler to a dedicated `LZTMarketOrderService` in the services layer.

**Files:**
- Create: `backend/services/lzt_market_order_service.go`
- Modify: `backend/handlers/lzt_market_handler.go`

**Step 1: Create `backend/services/lzt_market_order_service.go`**

Create `LZTMarketOrderService` struct with an `*ent.Client` dependency. Move these handler methods:
- `saveOrder` -> `SaveOrder`
- `appendOrderStep` -> `AppendOrderStep`
- `markOrderFailed` -> `MarkOrderFailed`
- `markOrderFulfilled` -> `MarkOrderFulfilled`
- `getOrderForUser` -> `GetOrderForUser`
- `loadOrderSteps` -> `LoadOrderSteps`
- `applyOrderItemSnapshot` -> `ApplyOrderItemSnapshot`
- `mapEntityToPublicMarketOrder` -> `MapEntityToPublicOrder`

**Step 2: Wire the new service into handler**

In `NewLZTMarketHandler`, add `orderSvc *services.LZTMarketOrderService` field. Initialize in constructor using `database.Client`.

Update all handler methods that call the moved functions to go through `h.orderSvc.*`.

**Step 3: Verify compilation and tests**

Run: `cd backend && go build ./... && go test ./... -count=1 2>&1 | tail -20`
Expected: All PASS

**Step 4: Commit**

```bash
git add backend/services/lzt_market_order_service.go backend/handlers/lzt_market_handler.go
git commit -m "refactor(backend): extract market order persistence to service"
```

---

### Task 4: Extract market listing cache and pricing into service

Move the listing cache, aggregation, and pricing logic into the existing or new service files.

**Files:**
- Create: `backend/services/lzt_market_listing_service.go`
- Modify: `backend/handlers/lzt_market_handler.go`

**Step 1: Create `backend/services/lzt_market_listing_service.go`**

Create `LZTMarketListingService` struct. Move these handler methods:
- Cache management: `getCachedChatGPT`, `getAnyCachedChatGPT`, `setCachedChatGPT`
- Listing loading: `loadChatGPTListing`, `refreshChatGPTListing`, `startChatGPTListingFlight`, `finishChatGPTListingFlight`
- Aggregation: `fetchAggregatedChatGPTListing`, `fetchChatGPTListingPage`
- Item lookup: `findChatGPTItem`, `resolveOrderItemForCheckout`
- Pricing: `extractSourcePriceAndCurrency`, `computeIDRPrice`, `withDisplayPricing`
- Provider checks: `checkSupplierBalance`, `checkAccountItem`, `getProviderItemReadiness`

The struct will hold: `client *LZTMarketClient`, `fxRates *FXRateService`, cache mutex/fields, listing flight map.

**Step 2: Update handler to delegate**

Replace the handler's direct calls with `h.listingSvc.*` calls. The handler struct becomes:
```go
type LZTMarketHandler struct {
    client     *services.LZTMarketClient
    listingSvc *services.LZTMarketListingService
    orderSvc   *services.LZTMarketOrderService
    walletSvc  *services.FeatureWalletClient
}
```

**Step 3: Verify compilation and tests**

Run: `cd backend && go build ./... && go test ./... -count=1 2>&1 | tail -20`
Expected: All PASS

**Step 4: Verify handler size reduction**

Run: `wc -l backend/handlers/lzt_market_handler.go`
Expected: Under 800 lines (down from 2,943)

**Step 5: Commit**

```bash
git add backend/services/lzt_market_listing_service.go backend/handlers/lzt_market_handler.go
git commit -m "refactor(backend): extract market listing cache and pricing to service"
```

---

### Task 5: Finalize frontend market refactoring

The uncommitted work already extracted `marketChatGPTUtils.js` and `useMarketChatGPTListing.js`. Verify these work correctly with the modified `MarketChatGPTClient.jsx`.

**Files:**
- Verify: `frontend/app/market/chatgpt/marketChatGPTUtils.js` (new)
- Verify: `frontend/app/market/chatgpt/useMarketChatGPTListing.js` (new)
- Verify: `frontend/app/market/chatgpt/MarketChatGPTClient.jsx` (modified)
- Verify: `frontend/app/market/chatgpt/__tests__/MarketChatGPTClient.test.jsx` (modified)
- Verify: `frontend/app/market/chatgpt/page.jsx` (modified)

**Step 1: Run frontend tests**

Run: `cd frontend && npx jest app/market/chatgpt --verbose 2>&1`
Expected: All tests pass

**Step 2: Run frontend lint**

Run: `cd frontend && npx eslint app/market/chatgpt/ --no-error-on-unmatched-pattern 2>&1`
Expected: No errors

**Step 3: Check MarketChatGPTClient line count**

Run: `wc -l frontend/app/market/chatgpt/MarketChatGPTClient.jsx`
Expected: Under 500 lines (modularity dimension)

**Step 4: Commit all frontend market changes together**

```bash
git add frontend/app/market/chatgpt/
git commit -m "refactor(frontend): finalize market component decomposition into utils and hook"
```

---

### Task 6: Commit remaining backend market changes

The uncommitted backend changes in `lzt_market_handler.go`, `lzt_market_client.go`, `lzt_market_handler_test.go`, and the new `lzt_market_client_test.go` need to be committed.

**Step 1: Run backend tests**

Run: `cd backend && go test ./handlers/... ./services/... -v -count=1 -run "Market|LZT" 2>&1 | tail -30`
Expected: All PASS

**Step 2: Commit backend market changes**

```bash
git add backend/handlers/lzt_market_handler.go backend/handlers/lzt_market_handler_test.go backend/services/lzt_market_client.go backend/services/lzt_market_client_test.go backend/.env.example
git commit -m "fix(backend): finalize market handler improvements and client test coverage"
```

---

## Phase 2: Security Hardening

### Task 7: Add Next.js middleware for server-side auth protection

**Files:**
- Create: `frontend/middleware.js`

**Step 1: Create the middleware**

```javascript
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/account", "/market/chatgpt/orders"];
const ADMIN_PREFIXES = ["/admin"];
const ADMIN_PUBLIC = ["/admin/login"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Admin routes: check admin token cookie
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (ADMIN_PUBLIC.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // User protected routes: check access token cookie
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/market/chatgpt/orders/:path*"],
};
```

**Step 2: Verify dev server starts**

Run: `cd frontend && SKIP_PREBUILD_CHECK=1 npx next build 2>&1 | tail -5` (or just lint)
Expected: No build errors

**Step 3: Commit**

```bash
git add frontend/middleware.js
git commit -m "fix(frontend): add Next.js middleware for server-side auth route protection"
```

> **Note:** This middleware checks for the presence of auth cookies. It does NOT validate JWT signatures at the edge (that stays server-side). This prevents the flash-of-protected-content issue where unauthenticated users see the page before client-side redirect kicks in. Adjust cookie names to match what `lib/auth.js` actually sets.

---

### Task 8: Consolidate API base URL env vars

**Files:**
- Modify: `frontend/lib/api.js:46-80`

**Step 1: Simplify getApiBase()**

Keep only `NEXT_PUBLIC_API_BASE_URL` as the single env var. Remove the 3 fallback names. Add a comment explaining the migration.

```javascript
export function getApiBase() {
  const isServer = typeof window === "undefined";

  if (isServer) {
    const serverBase = String(process.env.API_BASE_URL || "").trim();
    if (serverBase) return serverBase.replace(/\/+$/, "");
  }

  let base = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();

  if (typeof window !== "undefined" && window.location?.protocol === "https:" && base.startsWith("http://")) {
    base = `https://${base.slice("http://".length)}`;
  }

  if (!base && typeof window !== "undefined") {
    const host = window.location?.hostname || "";
    if (host === "aivalid.id" || host === "www.aivalid.id" || (host.endsWith(".aivalid.id") && host !== "api.aivalid.id")) {
      base = "https://api.aivalid.id";
    }
  }

  return base.replace(/\/+$/, "");
}
```

**Step 2: Run frontend tests**

Run: `cd frontend && npx jest lib/__tests__/api.test.js --verbose 2>&1`
Expected: PASS (update test if it references old env var names)

**Step 3: Commit**

```bash
git add frontend/lib/api.js
git commit -m "fix(frontend): consolidate API base URL to single NEXT_PUBLIC_API_BASE_URL env var"
```

---

## Phase 3: Code Quality Quick Wins

### Task 9: Fix font documentation mismatch in RULES.md

**Files:**
- Modify: `.ai/RULES.md:50`

**Step 1: Update the font reference**

The actual fonts (from `globals.css`) are IBM Plex Sans and IBM Plex Mono, not Source Sans / Source Serif / Geist Mono.

Change line 50 from:
```
- Typography: Source Sans (body), Source Serif (headings), Geist Mono (code)
```
To:
```
- Typography: IBM Plex Sans (body/headings), IBM Plex Mono (code)
```

**Step 2: Commit**

```bash
git add .ai/RULES.md
git commit -m "docs(ai): fix font reference to match actual IBM Plex usage"
```

---

### Task 10: Migrate seed commands from lib/pq to pgx

**Files:**
- Modify: `backend/cmd/seed_admin/main.go`
- Modify: `backend/cmd/seed_admin/main_ent.go`
- Modify: `backend/cmd/seed_tags/main.go`
- Modify: `backend/tests/enttest/test_helpers.go`
- Modify: `backend/go.mod`

**Step 1: Replace lib/pq imports with pgx**

In each file, replace:
```go
_ "github.com/lib/pq"
```
With:
```go
_ "github.com/jackc/pgx/v5/stdlib"
```

If they use `sql.Open("postgres", ...)`, change to `sql.Open("pgx", ...)`. If they use Ent's `Open`, the driver is already configured in `database/ent.go` via pgx.

**Step 2: Run go mod tidy**

Run: `cd backend && go mod tidy`
Expected: `lib/pq` removed from go.mod and go.sum

**Step 3: Verify**

Run: `cd backend && go build ./... && go test ./... -count=1 2>&1 | tail -10`
Expected: All PASS, no `lib/pq` in go.mod

**Step 4: Commit**

```bash
git add backend/cmd/ backend/tests/ backend/go.mod backend/go.sum
git commit -m "refactor(backend): migrate seed commands and test helpers from lib/pq to pgx"
```

---

### Task 11: Commit remaining ops changes

**Files:**
- Verify: `ops/README.md` (modified)
- Verify: `ops/test-market-backend.sh` (new)

**Step 1: Review and commit ops changes**

```bash
git add ops/README.md ops/test-market-backend.sh
git commit -m "docs(ops): add market backend test script and update README"
```

---

### Task 12: Clean up docs/plans/prompt if it's stale

**Files:**
- Check: `docs/plans/prompt` (untracked)

**Step 1: Inspect the file**

If it's a leftover prompt dump (not a plan document), remove it. If it's useful, rename with proper naming convention.

**Step 2: Either delete or commit**

```bash
# If stale:
rm docs/plans/prompt
# Or if useful, rename and commit
```

---

## Phase 4: Validate

### Task 13: Run full preflight validation

**Step 1: Run backend checks**

Run: `cd backend && go vet ./... && go test ./... -count=1 2>&1 | tail -20`
Expected: 0 vet errors, all tests PASS

**Step 2: Run frontend checks**

Run: `cd frontend && npx eslint . && npx jest --ci 2>&1 | tail -20`
Expected: No lint errors, all tests PASS

**Step 3: Run quality score**

Run: `bash ops/quality-score.sh 2>&1 | tail -20`
Expected: Score >= 80 (up from 77 baseline)

**Step 4: Check for remaining dirty files**

Run: `git status`
Expected: Clean working tree (all changes committed)

**Step 5: Final commit summary**

Review all commits made during this plan:
```bash
git log --oneline -15
```

---

## Risk Mitigation

- **Phase 1 (market refactor)** is the highest risk. If extraction breaks compilation, work in small increments: extract one batch of functions at a time, compile, test, commit.
- **Phase 2 (middleware)** is low risk — it's additive. If cookie names don't match, the middleware will redirect too aggressively. Check `lib/auth.js` for actual cookie/localStorage key names before finalizing.
- **Phase 3 (cleanup)** is very low risk — docs and import changes only.
- **Phase 4 (validate)** catches any regressions.

## Execution Notes

- The market handler decomposition (Tasks 2-4) is the bulk of the work. Expect ~60% of total effort there.
- Each task produces a commit. Never leave the repo in a broken state between commits.
- If `go vet` or tests fail after an extraction step, fix before moving on.
- The frontend market changes (Task 5) are already mostly done in the dirty tree — this is primarily validation and commit.
