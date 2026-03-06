# Environment Variable Matrix (Server-Ready)

This matrix is the baseline for running MediCore across environments without code edits.
Set values in env files, secret manager, or CI/CD variables instead of changing source URLs/hosts.

## Core Platform

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `ENVIRONMENT` | Yes | All services | `development`, `staging`, `production` |
| `JWT_SECRET` | Yes | `ehr-service`, `tenant-service`, `cdss-service` | Must be strong and shared where token verification is required |
| `DB_HOST` | Yes | `ehr-service`, `tenant-service`, `cdss-service` | Master DB host |
| `DB_PORT` | Yes | `ehr-service`, `tenant-service`, `cdss-service` | Postgres port |
| `DB_USERNAME` | Yes | `ehr-service`, `tenant-service`, `cdss-service` | DB user |
| `DB_PASSWORD` | Yes | `ehr-service`, `tenant-service`, `cdss-service` | DB password |
| `POSTGRES_DB` | Yes | `ehr-service`, `tenant-service`, `cdss-service` | Master DB name |
| `DATABASE_URL` | Recommended | `tenant-service` | Preferred single connection string |
| `REDIS_URL` | Yes | `ehr-service`, `cdss-service` | Cache + queue backend |
| `CORS_ORIGINS` | Yes | `cdss-service`, `whisper` | Explicitly list frontend origins |

## Service Routing (No Hardcoded Host Switches)

| Variable | Required | Used By | Example |
|---|---|---|---|
| `SERVICE_BASE_URL` | Recommended | Backend + Frontends | `https://api.example.com` |
| `SERVICE_TENANT_PATH` / `SERVICE_EHR_PATH` / `SERVICE_CDSS_PATH` | Optional | Config resolver | `/tenant-service`, `/ehr-service`, `/cdss-service` |
| `REACT_APP_API_BASE_URL` | Recommended | Frontends | `https://api.example.com` |
| `REACT_APP_TENANT_API_PATH` / `REACT_APP_EHR_API_PATH` / `REACT_APP_CDSS_API_PATH` | Optional | Frontend config resolver | `/tenant-service`, `/ehr-service`, `/cdss-service` |
| `SERVICE_TENANT_URL` / `REACT_APP_TENANT_API_URL` | Yes | Frontends | `https://tenant.example.com/api` |
| `SERVICE_EHR_URL` / `REACT_APP_EHR_API_URL` | Yes | Frontends + CDSS | `https://ehr.example.com/api` |
| `SERVICE_CDSS_URL` / `REACT_APP_CDSS_API_URL` | Yes | EHR + Frontends | `https://cdss.example.com` |
| `FRONTEND_URL` | Yes | `ehr-service` links | Public app URL |
| `PORTAL_BASE_URL` | Yes | `ehr-service` patient auth links | Patient portal URL |
| `REACT_APP_BASE_DOMAIN` | Recommended | Admin/web frontends | Tenant URL rendering |
| `REACT_APP_PROTOCOL` | Recommended | Admin/web frontends | `https` in production |
| `LOCAL_AI_BASE_URL` + `LOCAL_WHISPER_PATH` / `LOCAL_OCR_PATH` | Optional | EHR AI pipeline | One base for local AI endpoints (whisper/OCR) |
| `LOCAL_WHISPER_URL` / `LOCAL_OCR_URL` | Optional override | EHR AI pipeline | Explicit full endpoint URLs override inherited local AI base |

### URL Resolution Precedence

1. Explicit URL wins: `SERVICE_EHR_URL`, `REACT_APP_EHR_API_URL` (and tenant/CDSS equivalents).
2. If explicit URL is not set, resolver builds URL from single base + path:
   - `SERVICE_BASE_URL + SERVICE_*_PATH`
   - `REACT_APP_API_BASE_URL + REACT_APP_*_API_PATH`
3. Development fallback defaults are used only when neither explicit URL nor base URL is provided.

This lets you set one base URL once and avoid repeating full server URLs across variables.

## CDSS Security and AI

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `CDSS_REQUIRE_SERVICE_AUTH` | Yes | `cdss-service` | Keep `true` outside local sandbox |
| `CDSS_SERVICE_AUTH_MODE` | Yes | EHR + CDSS | `token`, `jwt`, `both` |
| `CDSS_SERVICE_TOKEN` | If token mode | EHR + CDSS | Shared secret |
| `CDSS_SERVICE_JWT_SECRET` | If jwt mode | EHR + CDSS | Service JWT signing key |
| `CDSS_SERVICE_AUTH_ISSUER` | Yes | EHR + CDSS | Must match both sides |
| `CDSS_SERVICE_AUTH_AUDIENCE` | Yes | EHR + CDSS | Must match both sides |
| `CDSS_SERVICE_AUTH_JWT_REPLAY_STRICT` | Recommended | `cdss-service` | Enable stricter replay behavior |
| `CDSS_OUTBOUND_TIMEOUT_MS` | Recommended | `ehr-service` | Default timeout for EHR->CDSS calls |
| `CDSS_OUTBOUND_RETRY_MAX` | Recommended | `ehr-service` | Retry attempts for retryable CDSS failures |
| `CDSS_OUTBOUND_RETRY_BASE_MS` | Recommended | `ehr-service` | Exponential backoff base delay |
| `CDSS_CIRCUIT_BREAKER_FAIL_THRESHOLD` | Recommended | `ehr-service` | Consecutive failures before opening circuit |
| `CDSS_CIRCUIT_BREAKER_OPEN_MS` | Recommended | `ehr-service` | Circuit open duration before half-open probe |
| `CDSS_PHI_REDACTION_ENABLED` | Yes | `cdss-service` | PHI redaction gate |
| `CDSS_BLOCK_OUTBOUND_PHI` | Yes | `cdss-service` | Fail/deny policy for disallowed PHI egress |
| `CDSS_STRICT_EGRESS_ALLOWLIST` | Yes | `cdss-service` | Keep `true` in production |
| `CDSS_EGRESS_ALLOWLIST` | Recommended | `cdss-service` | Comma-separated allowlisted targets |
| `CDSS_ENCRYPTION_ENABLED` | Yes | `cdss-service` | At-rest envelope encryption switch |
| `CDSS_ENCRYPTION_PROVIDER` | Yes | `cdss-service` | `local` or `kms` |
| `CDSS_ENCRYPTION_KEY_ID` | Yes | `cdss-service` | Rotation tracking key id |
| `CDSS_ENCRYPTION_KMS_KEY_ARN` | Required when `provider=kms` | `cdss-service` | KMS CMK/alias ARN for envelope control plane |
| `CDSS_ENCRYPTION_KEY` | Yes | `cdss-service` | Encryption key material |
| `CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON` | Optional | `cdss-service` | Decrypt-only legacy keyring during rotations |
| `CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS` | Transitional | `cdss-service` | Keep `false` after migration |
| `OWNER_EMAILS` | Yes | `cdss-service` admin | Comma-separated owner principals |
| `CDSS_OWNER_SCOPE_STRICT` | Recommended | `cdss-service` admin | Enable strict scope enforcement |
| `LLM_API_URL` | If AI enabled | `cdss-service` | LLM endpoint |
| `LLM_MODEL_NAME` | If AI enabled | `cdss-service` | Active model |
| `LLM_TIMEOUT_SECONDS` | Recommended | `cdss-service` | Request timeout |

## Storage and External Services

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `STORAGE_S3_ENDPOINT` / `MINIO_ENDPOINT` | Yes | EHR + CDSS | S3/MinIO endpoint |
| `STORAGE_S3_ACCESS_KEY` / `MINIO_ACCESS_KEY` | Yes | EHR + CDSS | Access key |
| `STORAGE_S3_SECRET_KEY` / `MINIO_SECRET_KEY` | Yes | EHR + CDSS | Secret key |
| `STORAGE_S3_BUCKET` / `MINIO_BUCKET` | Yes | EHR + CDSS | Bucket name |
| `STORAGE_S3_REGION` | Yes | EHR + CDSS | Region |
| `STORAGE_S3_FORCE_PATH_STYLE` | Recommended | EHR + CDSS | Usually `true` for MinIO |
| `MINIO_PUBLIC_URL` | Recommended | Frontend links | Public object URL base |
| `SENTRY_DSN` | Optional | EHR + tenant services | Observability |

## Migration Rule

When moving to server, only change environment values.
Do not change source files for hostnames, IP addresses, or protocol changes.

## Quick Validation

1. Run startup checks in each service with production-like env values.
2. Verify frontend can call tenant, EHR, and CDSS APIs using env URLs.
3. Verify EHR->CDSS auth (`issuer`/`audience`/secret mode) end-to-end.
4. Verify `X-Request-ID` is present and consistent across logs and error envelopes (frontend, EHR, tenant, CDSS).
5. Verify tenant isolation: missing or invalid `X-Tenant-ID` yields fast 4xx and no data access.
6. Verify CDSS egress allowlist blocks unknown outbound hosts.
7. Verify EHR behavior when CDSS (`SERVICE_CDSS_URL`) is slow or down: bounded timeouts and controlled fallback responses.
8. Verify email/portal links resolve to `FRONTEND_URL` and `PORTAL_BASE_URL`.
