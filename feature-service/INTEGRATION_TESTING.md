# Integration Testing Guide — Feature Service

Dokumen ini berisi contoh request untuk Feature Service sesuai domain saat ini:

- wallet
- escrow transfers
- disputes (admin arbitration)
- documents
- reports + admin moderation

Tidak ada fitur forum/sosial (tidak ada replies/reactions/likes/stars).

## Base URLs

- Local: `http://localhost:5000`
- Production (reverse-proxy): `https://feature.aivalid.id`

## Prerequisites

- Feature Service berjalan + MongoDB + Redis.
- JWT access token dari Go backend (`api.aivalid.id`).
- Untuk operasi finansial: akun harus punya 2FA (TOTP) enabled + PIN.
- Beberapa endpoint finansial memakai PQC signature middleware (lihat bagian “PQC Signature”).

## Get JWT Token (Go Backend)

Feature Service memvalidasi JWT yang diterbitkan oleh Go backend.

```bash
curl -sS -X POST https://api.aivalid.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Simpan access token sebagai environment variable
TOKEN="eyJhbGc..."
```

## Health

```bash
curl -sS https://feature.aivalid.id/api/v1/health
curl -sS https://feature.aivalid.id/api/v1/health/ready

# HealthChecks endpoint (ASP.NET HealthChecks)
curl -sS https://feature.aivalid.id/health
```

## PQC Signature (Untuk Endpoint Finansial)

Beberapa endpoint finansial ditandai dengan `[RequiresPqcSignature]` dan memerlukan header:

- `X-PQC-Signature` (Base64)
- `X-PQC-Key-Id`
- `X-PQC-Timestamp` (ISO 8601 UTC, suffix `Z` atau `+00:00`)
- `X-Idempotency-Key` (wajib untuk operasi yang mengubah state jika `RequireIdempotencyKey=true`)

Payload yang di-sign (urutan konkatenasi) mengikuti middleware:

1. `HTTP_METHOD`
2. `PATH` (tanpa host)
3. `QUERY_STRING` (jika ada)
4. `X-PQC-Timestamp` (jika ada)
5. `X-Idempotency-Key` (jika ada)
6. raw request body (jika endpoint include body dan content-length > 0)

Catatan kompatibilitas:

- Jika user belum punya PQC key aktif, middleware akan *melewati* verifikasi signature, namun tetap mewajibkan `X-Idempotency-Key` bila endpoint mengharuskannya.
- Jika user punya PQC key aktif, verifikasi signature wajib lolos.

## Wallet (Read)

```bash
curl -sS https://feature.aivalid.id/api/v1/wallets/me \
  -H "Authorization: Bearer $TOKEN"

curl -sS https://feature.aivalid.id/api/v1/wallets/pin/status \
  -H "Authorization: Bearer $TOKEN"

curl -sS "https://feature.aivalid.id/api/v1/wallets/transactions?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

## Set PIN (2FA Required + Idempotency)

```bash
IDEMP="pinset_$(date +%s)"

curl -sS -X POST https://feature.aivalid.id/api/v1/wallets/pin/set \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMP" \
  -d '{
    "pin": "123456",
    "confirmPin": "123456"
  }'
```

## Escrow Transfers

### Create Transfer (2FA + PIN + Idempotency)

```bash
IDEMP="transfer_$(date +%s)"

curl -sS -X POST https://feature.aivalid.id/api/v1/wallets/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMP" \
  -d '{
    "receiverUsername": "bob",
    "amount": 100000,
    "message": "Final Offer accepted, locking funds",
    "pin": "123456",
    "holdHours": 168
  }'
```

### Release Transfer (Receiver)

```bash
IDEMP="release_$(date +%s)"
TRANSFER_ID="trf_01HXYZ..."

curl -sS -X POST "https://feature.aivalid.id/api/v1/wallets/transfers/${TRANSFER_ID}/release" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMP" \
  -d '{
    "pin": "123456"
  }'
```

## Disputes (Global Dispute Center)

### Create Dispute

```bash
IDEMP="dispute_$(date +%s)"
TRANSFER_ID="trf_01HXYZ..."

curl -sS -X POST https://feature.aivalid.id/api/v1/disputes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMP" \
  -d '{
    "transferId": "'"$TRANSFER_ID"'",
    "reason": "Validator did not submit the agreed artifact. Requesting arbitration.",
    "category": "Other"
  }'
```

### Get Dispute / List Disputes

```bash
DISPUTE_ID="65d2c0f4a6e7b1c2d3e4f5a6"

curl -sS "https://feature.aivalid.id/api/v1/disputes/${DISPUTE_ID}" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "https://feature.aivalid.id/api/v1/disputes?status=Open" \
  -H "Authorization: Bearer $TOKEN"
```

## Documents (Profile + Workflow Artifacts)

### Upload Document (PDF/DOCX)

```bash
curl -sS -X POST https://feature.aivalid.id/api/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./artifact.pdf" \
  -F "title=Artifact Submission" \
  -F "description=Full deliverable for Validation Case #123" \
  -F "category=research" \
  -F "visibility=private"
```

### Download Document

```bash
DOC_ID="doc_01HXYZ..."

curl -sS -L "https://feature.aivalid.id/api/v1/documents/${DOC_ID}/download" \
  -H "Authorization: Bearer $TOKEN" \
  -o artifact.pdf
```

## Reports + Admin Moderation

### Create Report (User)

```bash
curl -sS -X POST https://feature.aivalid.id/api/v1/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetType": "validation_case",
    "targetId": "123",
    "validationCaseId": 123,
    "reason": "spam",
    "description": "Case appears fraudulent / irrelevant."
  }'
```

### List Pending Reports (Admin)

```bash
curl -sS "https://feature.aivalid.id/api/v1/admin/moderation/reports?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

## Error Response Format

Feature Service menggunakan format error terstandardisasi:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data tidak valid",
    "details": null
  },
  "meta": {
    "requestId": "req_xyz",
    "timestamp": "2026-02-10T00:00:00Z"
  }
}
```

