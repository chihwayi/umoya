# FX-002 Backfill (S-004): silently-plaintext / truncated values

## What happened

Two compounding defects on `patients.id_number/phone/email`:

1. `encrypt()` returned the value **unchanged (plaintext)** when
   `ENCRYPTION_KEY` was missing or invalid — no error, no log.
2. `VARCHAR(50)` truncated real ciphertext (`iv:tag:ct` hex needs 66 chars of
   overhead before a single plaintext char).

So a tenant DB may hold three classes: healthy ciphertext, plaintext (missing
key era), truncated/corrupt (overflow era).

## What R1 changed (code)

- Columns widened to TEXT via bundle `r1_fx002_width` (provisioning path).
- Transformer + boot fail closed in non-dev without a valid 64-hex key.
- Nothing auto-rewrites existing rows — that is this document's procedure.

## Procedure

1. **Report** (safe, read-only):
   `node scripts/repair-encryption-backfill.mjs --db <tenant-url>`
   Records counts per class per column. Keep the output with the tenant's
   change record.
2. **Plaintext class**: re-encrypt in place:
   `ENCRYPTION_KEY=<current-key> node scripts/repair-encryption-backfill.mjs --db <tenant-url> --apply`
   The script refuses without a valid key and logs every row touched.
3. **Truncated class**: NEVER auto-fixed. Recover from source documents
   (paper intake / ID copy) and re-register; the truncated value is
   unrecoverable by construction (ciphertext cut mid-stream fails auth).
4. **Ciphertext-shape class**: spot-check decrypt of ≥5 rows per column with
   the tenant's key (e.g. via the app's patient read), then sign off.
5. **Verify**: re-run in report mode — expect `plaintext: 0`, `truncated: 0`
   (or a tracked manual-review list), and confirm the app reads the rows.

## Residue accepted by R1

- Plaintext-era rows are readable by anyone with DB access until step 2 runs
  per tenant — tenant operators must schedule it; R8's secrets rotation covers
  key lifecycle, not this backlog.
