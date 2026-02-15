# CDSS Encryption Key Rotation Runbook

## Scope

This runbook covers envelope encryption key rotation for CDSS settings, audit logs, and async job payloads.

## Preconditions

- `CDSS_ENCRYPTION_ENABLED=true`
- New key generated and stored in secret manager.
- Previous key is available for temporary decrypt-only compatibility.

## Rotation Variables

- `CDSS_ENCRYPTION_KEY_ID`: new active key id (for example `cdss-kms-v3`)
- `CDSS_ENCRYPTION_KEY`: new active Fernet data key
- `CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON`: JSON map of legacy key ids to key material used for decrypt-only reads
- `CDSS_ENCRYPTION_PROVIDER`: `local` or `kms`
- `CDSS_ENCRYPTION_KMS_KEY_ARN`: required when provider is `kms`

## Procedure

1. Add the new key as active:
   - Set `CDSS_ENCRYPTION_KEY_ID` and `CDSS_ENCRYPTION_KEY` to the new values.
2. Keep old keys for decrypt-only reads:
   - Populate `CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON` with previous key ids/values.
3. Deploy CDSS service.
4. Verify startup checks pass and `cdss_encryption_keys` has:
   - New key with `is_active=true`
   - Previous keys with `is_active=false`
5. Trigger normal traffic and confirm old encrypted records are readable.
6. Run migration job:
   - `POST /admin/encryption/reencrypt` with `{ "async_job": true, "dry_run": false, "per_table_limit": 500 }`
7. Re-encrypt old records (repeat batch runs until migration count reaches zero).
8. Remove migrated legacy keys from `CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON`.
9. Redeploy and verify no decrypt failures.

## Non-Dev Enforcement

- `CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS` must be `false`.
- Default development key must not be used.
- `CDSS_ENCRYPTION_KMS_KEY_ARN` is mandatory when `CDSS_ENCRYPTION_PROVIDER=kms`.

## Rollback

1. Revert `CDSS_ENCRYPTION_KEY_ID` and `CDSS_ENCRYPTION_KEY` to previous known-good key.
2. Keep both keys in `CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON`.
3. Redeploy CDSS.
4. Investigate failed migration batch before retrying rotation.
