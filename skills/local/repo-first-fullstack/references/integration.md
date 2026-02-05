# Frontend ↔ Backend Integration (Correctness First)

Goal: ensure frontend API calls match backend requirements (auth headers, idempotency, content types, error handling), backed by repo evidence.

## Discovery checklist

1) Discover API base configuration in frontend:

```bash
rg -n "BASE_URL|API_URL|NEXT_PUBLIC|baseURL" frontend -S
```

2) Find API wrappers and header usage:

```bash
rg -n "fetch\\(|headers\\s*:\\s*\\{|Authorization|Idempotency|X-" frontend -S
```

3) Discover backend endpoint registration:

Go (Gin):

```bash
rg -n "router\\.(GET|POST|PUT|DELETE)|Group\\(|gin\\.Default\\(|gin\\.New\\(" backend -S
```

.NET:

```bash
rg -n "\\[Http(Get|Post|Put|Delete)\\]|MapControllers\\(|MapGroup\\(" feature-service -S
rg -n "UseAuthentication\\(|UseAuthorization\\(" feature-service -S
```

## Build an API contract table (required for non-trivial integrations)

For each endpoint the frontend calls, produce a table row with:
- Endpoint + method (evidence: route registration excerpt)
- Auth model (evidence: middleware/controller attributes/config)
- Required headers (evidence: code checks or docs confirmed by code)
- Idempotency rules for mutations (evidence: code handling or existing patterns)
- Status codes + error shape (evidence: controller/handler response)

## Implement safe improvements

Only after the contract is evidence-backed:
- Centralize request helper (consistent headers, timeouts, retries if already used)
- Standardize error parsing (do not guess error format; prove it)
- Add idempotency keys only when required by backend or existing patterns
- Add structured logging without secrets (redact tokens; avoid PII)

## Validation patterns

- Run the narrowest applicable build/tests.
- For runtime verification, prefer safe read-only evidence:
  - request/response logs (redacted)
  - correlation IDs if already present
  - explicit status codes and error codes

