# 3.10 Data Integrity, Migration & Legacy Interop

Read-only; no source edited. Migration controller + MPI query executed via
ts-node against scratch postgres (throwaway containers). Absence-evidence rule
applied (notably: re-ran C-043 with new terms after Sprint B's narrow-grep
lesson).

## 1. Messy legacy import: EXECUTED — works for clean data, fails open on mess

`migration.controller` upload→dry-run→import executed (synthetic CSV,
TypeORM-shaped facade):

- **Working:** exact-identifier duplicate detection (in-file case-insensitive
  + against-DB), quoted fields with embedded commas, UTF-8 diacritics
  (Tendái Mùkőnó preserved), missing-field errors, bad-gender rejection,
  non-date rejection, existing-patient skip (verified: `skipped` fires only
  with array-shaped rows — harness note, product uses TypeORM which returns
  arrays).
- **Defects (all executed):**
  1. **Stray quote silently eats rows (S2).** `PN8,"Quoted, Name",O"Brien,…`
     (unbalanced quote) swallowed the next 2 rows: 10 data rows → 8 parsed,
     no error. Silent row loss in a migration tool.
  2. **Impossible dates accepted (S2).** `2024-02-30` passes (`Date.parse`
     rolls to Mar 1; `toDateOnly` persists the rolled date). No calendar
     validation.
  3. **No transaction (S2).** Row-by-row INSERTs, no BEGIN/COMMIT — a mid-file
     failure (constraint, disconnect) leaves a partial import with no rollback
     marker. For 100k-row jobs this is a recoverability defect.
  4. **No fuzzy matching (S2).** Twins/same-person-different-ID double-import;
     only exact identifier match dedupes (MPI exists elsewhere but is not
     wired into migration).
  5. **Meds/history NOT imported (C-040 partially falsified).** Only 16
     demographic columns + free-text allergies/medicalHistory; no
     medications, no diagnoses, no visits. "Import of existing patient
     records, meds, history" delivers demographics-only.
  6. **Job store is in-memory** (`migrationJobs` Map): restart loses jobs;
     multi-instance doesn't share. S3.
  7. Generated fallback numbers (`MIG<ts6><row4>`) collide for same-ms
     imports (edge, S3).
- **100k scale:** parse 100k rows 57 ms; dry-run 2000 rows 590 ms (~0.3
  ms/row → ~30 s per 100k dry-run; import ~2 queries/row → minutes, no
  batching). No hard 100k blocker found, but no resume/checkpoint either —
  combined with (3), a failed 100k job restarts from zero. **PARTIAL.**

## 2. Parallel go-live: re-checked, still nothing (S2 wording risk)

Re-ran with broadened terms (`reconcil*`, `parallel`, `go.?live`,
`legacy.*sync|sync.*legacy`, `cutover`, `dual.?run`, `shadow`, `diff.*legacy`,
`reconciliation`) across `services/*/src` + `scripts/`: hits are
payment-reconciliation, clinical med-rec, finance/claims, and two regression
scripts (`regression-role-authorization-matrix`, `regression-fhir-roundtrip`) —
**no legacy-parallel-run reconciliation, diff, or cutover tooling.**
Per the absence-evidence rule this is a broad-stem + multi-dir + docs
cross-check, so ABSENT is asserted with high confidence (residual risk: a
runbook-only process in docs/ — `docs/` grep for cutover/parallel-go-live
found only the audit prompt itself). If go-live support is purely the API +
migration import above (with defects 1–4), the "two systems running
simultaneously" narrative has no tooling behind it — **MISLEADING (S2)** as a
product claim; UNVERIFIED as an operations claim (a runbook could exist
outside the repo).

## 3. Referential & clinical integrity: code-read (execution needs booted tenant DB)

- Soft-delete: `isActive` flags used in sync queries (`syncPatients` filters
  `isActive`); hard-delete paths and cascade behavior not traced — **UNVERIFIED**.
- Amendment vs overwrite: `Object.assign(patient, patientData); save()` in HL7
  ADT path overwrites demographics with no history/audit trail visible at the
  call site (audit interceptor may log the API call, not the field diff) —
  **PARTIAL, needs record-level history check (Sprint E)**. Same pattern in
  referral update path (assumed, spot-check only).
- Orphaned records: inbound FHIR skips patient-existence check (§3.3.6)
  creates orphan-ready rows where FKs don't exist; migration inserts patients
  without linked records (fine) — **PARTIAL**.
- Concurrent-write conflicts: last-write-wins everywhere observed (HL7 ADT
  upsert, FHIR inbound unconditional insert, migration sequential) — no
  optimistic locking (`@VersionColumn`) found via grep — **UNVERIFIED at
  runtime, code suggests absent (S2 for ADT race double-booking, Sprint E
  load test)**.

## 4. MPI fuzzy matching: EXECUTED — precedence bug + missing index

Ran the service's EXACT duplicate query (`registration-ai.service.ts:52-69`)
on scratch PG with Shona/Ndebele variants, twins, DOB swaps, and 100k rows:

- Variant matching works: Tendai/Tendayi 0.80, Nkosana/Nkosazana 0.85,
  twins both returned. Good core.
- **BUG (S2): DOB filter bypassed by operator precedence.** SQL is
  `... SIMILARITY(...) > 0.5 OR SOUNDEX(...) = SOUNDEX(...) AND (dob = $3 ...)`
  — AND binds tighter, so any same-surname candidate passes regardless of
  DOB. Verified: searching DOB 1988-11-05 returns DOB 1988-05-11 patients and
  vice versa. Both false-positive merge candidates AND (via the
  `OR date_of_birth IS NULL` reading) noise. Fix: parenthesize the OR group.
- **No trigram GIN index on patients names** (verified: only
  `storeroom_catalog` has one; provisioning creates the extension but no
  patient index). 100k-row search measured 106 ms (seq scan, tolerable) —
  fine now, degrades linearly; add index before 1M scale. S3.
- DOB-typo'd records (transposed digits) are missed entirely (exact DOB
  required) — the false-negative direction of the same bug family. S2.
- `cleanString`/`cleanName`/`convertToTitleCase` helpers exist (verified
  present, behavior spot-checked only) — PARTIAL.

## 5. Encoding: PARTIAL

UTF-8 diacritics survive CSV parse + insert (executed: Tendái Mùkőnó round
trips). No BOM strip needed (header regex drops non-alphanumerics — verified).
No latin-1→UTF-8 repair: a Windows-1252 legacy file would mojibake silently
Latin-1 detection/conversion absent (code-read, S3). Shona/Ndebele/Portuguese
content has no special handling beyond UTF-8 — sufficient if source is UTF-8,
silent corruption if not.
