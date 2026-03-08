# Production Runbook – Post-Visit AI & Enterprise

## Overview

This runbook covers operational procedures for the post-visit AI companion, FHIR write-back, peer consultation, and enterprise hardening in production.

## Feature flags

| Flag | Purpose | Default |
|------|---------|--------|
| `FEATURE_POSTVISIT_PREVISIT_BRIEF` | Pre-visit brief generation | off |
| `FEATURE_POSTVISIT_FHIR_WRITEBACK` | Queue FHIR write-back on signed docs | off |
| `FEATURE_POSTVISIT_PEER_CONSULT` | Peer consultation workflow | off |
| `FEATURE_POSTVISIT_TRIAL_MATCHER` | Clinical trial matcher | off |
| `FEATURE_POSTVISIT_COMPANION_MEMORY` | Companion memory & topic persistence | on |

Enable in production only after UAT sign-off and secret/DB readiness.

## Scheduled jobs

- **Pre-visit briefs:** Call `POST /post-visit/jobs/generate-previsit-briefs?withinMinutes=60` every 15–30 minutes (admin auth). Ensures briefs for appointments in the next 60 minutes.

## Secret rotation

1. Run `node scripts/check-secret-rotation.js` before and after rotation.
2. Set `KEY_LAST_ROTATED_ISO` (e.g. `2026-01-15`) after rotating JWT/DB encryption keys.
3. Use `SECRET_KEY_MAX_AGE_DAYS` (default 365) to enforce max key age in CI or cron.

## SOC2/HIPAA evidence

- Generate report: `node scripts/soc2-hipaa-evidence-report.js` or `--format=csv`.
- Run periodically (e.g. weekly) and retain output for auditors.
- Ensure audit tables (e.g. `audit_events`, `fhir_sync_log`) are retained per retention policy.

## Incidents

### Red-team suite failing in CI

- Do not deploy until fixed. Failures indicate possible regression in parameterization, auth, or PHI handling.
- Review failing test; fix service/controller to restore safe behavior; re-run full test suite.

### FHIR write-back queue backing up

- Check `fhir_sync_log` for `status = 'pending'` and `next_retry_at`. Resolve external FHIR endpoint or credentials; worker should retry up to `max_attempts`.

### Peer consult or trial matcher disabled

- Verify `FEATURE_POSTVISIT_PEER_CONSULT` / `FEATURE_POSTVISIT_TRIAL_MATCHER` and env (no typos). Restart EHR service after change.

## Rollback

- Disable feature flags for post-visit modules (see table above).
- Redeploy; no DB rollback required for flag-only disable.
- For schema rollback, use migration rollback scripts per `database-migration-guide.md`.

## Contacts

- Platform / DB: per deployment docs.
- Security / compliance: per `compliance/hipaa-nist-control-register.md`.
