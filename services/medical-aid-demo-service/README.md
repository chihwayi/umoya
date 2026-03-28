# Medical Aid Demo Service

File-backed demo microservice that simulates a medical aid provider for claims/pre-auth demonstrations.

## What it includes
- JSON + CSV storage in `services/medical-aid-demo-service/data`
- API endpoints for members, plans, claims, pre-authorizations, status checks
- Browser portal for creating insured patients/members and adjusting claim limits

## Default URL
- `http://localhost:3004`

## Linking with existing claims module
- `ehr-service` now supports environment-based fallback routing to this provider when no tenant API config exists.
- Supported provider names: `cimas`, `premier`, `econet_health`, `psmas`, `first_mutual`, `demo_aid`.
- Optional override: set `MEDICAL_AID_DEMO_FORCE=true` to force this provider even if tenant DB API config rows exist.

## Key integration endpoints
- `POST /api/claims` (claim submission)
- `GET /api/claims/:externalClaimId` (status check)
- `POST /api/preauth` (pre-authorization)
- `POST /api/members/verify` (member verification)

## Exports
- `GET /api/export/plans.csv`
- `GET /api/export/members.csv`
- `GET /api/export/claims.csv`
- `GET /api/export/preauths.csv`
