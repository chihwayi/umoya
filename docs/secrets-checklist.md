# MediCore Production Secrets Checklist

Run `bash scripts/validate-secrets.sh` to validate all secrets automatically before deploying.

---

## 1. Generate fresh values for each secret

```bash
# JWT_SECRET (32+ chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# CDSS_SERVICE_TOKEN (32+ chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# CDSS_SERVICE_JWT_SECRET (32+ chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# CDSS_ENCRYPTION_KEY (Fernet-compatible base64, 44 chars)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# ENCRYPTION_KEY (64-char hex for PHI at rest)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# POSTGRES_PASSWORD (16+ chars)
node -e "console.log(require('crypto').randomBytes(20).toString('base64url'))"

# MINIO_ROOT_PASSWORD (16+ chars)
node -e "console.log(require('crypto').randomBytes(20).toString('base64url'))"

# GRAFANA_ADMIN_PASSWORD
node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))"
```

---

## 2. Required `.env` variables for production

| Variable | Description | Required |
|---|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL master password | Yes |
| `POSTGRES_USER` | PostgreSQL user | Yes |
| `POSTGRES_DB` | Database name | Yes |
| `JWT_SECRET` | Signs all user JWTs (32+ chars) | Yes |
| `MINIO_ROOT_USER` | MinIO access key | Yes |
| `MINIO_ROOT_PASSWORD` | MinIO secret (16+ chars) | Yes |
| `CDSS_SERVICE_TOKEN` | Service-to-service CDSS token | Yes |
| `CDSS_SERVICE_JWT_SECRET` | CDSS JWT signing secret (32+ chars) | Yes |
| `CDSS_ENCRYPTION_KEY` | Fernet key for CDSS PHI encryption | Yes |
| `ENCRYPTION_KEY` | 64-char hex key for PHI at rest | Yes |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin UI password | Yes |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | Yes |
| `SERVER_HOST` | Public hostname | Yes |
| `SYSTEM_DOMAIN` | Domain for tenant routing | Yes |
| `WHISPER_API_KEY` | Whisper STT key | If STT enabled |
| `DAILY_API_KEY` | Daily.co video key | If telemedicine enabled |
| `DHIS2_PAT` | DHIS2 personal access token | If DHIS2 sync enabled |
| `PAGERDUTY_ROUTING_KEY` | PagerDuty routing key | If alerting enabled |
| `OPENAI_API_KEY` | OpenAI key | If PostVisit LLM = OpenAI |

---

## 3. Required GitHub Actions secrets

Register these in **Settings → Secrets and variables → Actions**:

### CI (always needed)
| Secret | Purpose |
|---|---|
| `SMTP_HOST` | Failure notification email |
| `SMTP_PORT` | Failure notification email |
| `SMTP_USERNAME` | Failure notification email |
| `SMTP_PASSWORD` | Failure notification email |
| `NOTIFICATION_EMAIL` | Failure notification recipient |

### Playwright E2E (needed for `playwright-e2e` CI job)
| Secret | Purpose |
|---|---|
| `STAGING_EHR_API_URL` | Base URL for Playwright tests |
| `STAGING_EHR_SERVICE_URL` | Health check URL |
| `STAGING_EHR_QA_TENANT` | Tenant slug for test isolation |
| `STAGING_EHR_QA_TOKEN` | Auth token for test user |

### CD Deploy (needed for `deploy` CI job)
| Secret | Purpose |
|---|---|
| `VPS_HOST` | Production server IP or hostname |
| `VPS_USER` | SSH user (e.g. `deployer`) |
| `VPS_SSH_KEY` | Ed25519 private key (no passphrase) |
| `VPS_DEPLOY_PATH` | Absolute path on VPS (e.g. `/opt/medicore`) |

---

## 4. Rotation schedule

| Secret | Rotate every |
|---|---|
| `JWT_SECRET` | 90 days (invalidates all sessions — plan maintenance window) |
| `CDSS_SERVICE_TOKEN` | 90 days |
| `CDSS_ENCRYPTION_KEY` | 180 days (coordinate with key rotation script) |
| `ENCRYPTION_KEY` | 180 days |
| `POSTGRES_PASSWORD` | 180 days |
| `MINIO_ROOT_PASSWORD` | 180 days |

---

## 5. Pre-deploy checklist

- [ ] Run `bash scripts/validate-secrets.sh` — zero errors
- [ ] Confirm `.env` is NOT committed to git (`git status` shows clean)
- [ ] Confirm `ENVIRONMENT=production` is set
- [ ] Confirm `NODE_ENV=production` is set for all Node services
- [ ] Confirm `CDSS_REQUIRE_SERVICE_AUTH=true`
- [ ] Confirm `CDSS_PHI_REDACTION_ENABLED=true`
- [ ] Confirm `CDSS_BLOCK_OUTBOUND_PHI=true`
- [ ] Database backup taken before migration
- [ ] `docker compose -f docker-compose.prod.yml pull` run to pre-pull images
