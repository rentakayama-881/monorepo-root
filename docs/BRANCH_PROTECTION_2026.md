# Branch Protection Runbook 2026

Last updated: February 20, 2026

## Objective

Define repository-level protection settings required for strict engineering quality gates.

## Target Branches

1. `main`
2. `develop`

## Required Status Checks

Configure these checks as required before merge:

1. For `main`
- `✅ Quality Gate (Full Lane)`

2. For `develop`
- `✅ Quality Gate (Quick Lane)`

## Required Reviews

Enable minimum 1 required reviewer for pull requests.

For sensitive scope (auth/financial/security), enforce reviewer ownership policy:

1. Backend auth/validation and wallet:
- `backend/handlers/**`
- `backend/services/**`

2. Feature service wallet/dispute/transfer:
- `feature-service/src/FeatureService.Api/Controllers/**`
- `feature-service/src/FeatureService.Api/Services/**`

3. Frontend account/admin/auth flows:
- `frontend/app/account/**`
- `frontend/app/admin/**`
- `frontend/lib/auth*`

## Protection Flags

Enable all of the following:

1. Require pull request before merging.
2. Require status checks to pass before merging.
3. Require branches to be up to date before merging.
4. Restrict force pushes.
5. Restrict branch deletion.

## Verification Checklist

1. Open repository settings and verify all required checks are active.
2. Create a test PR with intentionally failing quick lane and confirm merge is blocked.
3. Validate main merge requires full lane pass.
4. Capture screenshots or settings export and link in `docs/QUALITY_SCORECARD_2026.md`.

## Notes

This document is operational guidance; enforcement must be enabled in GitHub repository settings.

