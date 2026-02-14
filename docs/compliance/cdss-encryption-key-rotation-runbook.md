# CDSS Encryption Key Rotation Runbook

Last updated: 2026-02-14
Owner: Security + Platform

## Purpose

Rotate CDSS envelope-encryption key material with controlled cutover and auditable evidence.

## Preconditions

1. New key generated and stored in secret manager.
2. Change window approved.
3. Rollback key retained for emergency decrypt-read compatibility.

## Environment Variables

- `CDSS_ENCRYPTION_KEY_ID`
- `CDSS_ENCRYPTION_KEY`
- `CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS` (temporary migration control)

## Rotation Procedure

1. Generate new key and assign a new key ID.
2. Update deployment secrets with:
   - new `CDSS_ENCRYPTION_KEY_ID`
   - new `CDSS_ENCRYPTION_KEY`
3. Deploy CDSS service and worker.
4. Verify startup passes security validation.
5. Verify key registration row in `cdss_encryption_keys`:
   - `key_id`
   - `provider`
   - `key_fingerprint`
   - `rotated_at`
6. Validate read/write:
   - Existing encrypted settings/audit/jobs still readable.
   - New writes use new key ID.
7. Record evidence bundle:
   - deployment SHA
   - key ID transition
   - timestamp
   - operator

## Rollback

1. Revert secrets to previous key ID/key.
2. Redeploy CDSS.
3. Verify decrypt-read success for recent payloads.
4. Document rollback reason and impact.

## Post-Rotation Checks

1. `cdss_admin_jobs` writes and reads healthy.
2. `cdss_admin_audit_logs` decrypt and display correctly.
3. No increase in decrypt failures in logs.

## Audit Evidence

Attach to quarterly control review:
- `cdss_encryption_keys` snapshot
- deployment logs
- smoke test output
- incident notes (if any)

