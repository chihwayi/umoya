# Sprint E — Research Platform (Section 3.6)

Stack: booted ehr-service on the Sprint-D scratch tenant (`tenant_audit_clinic`),
synthetic data only. De-id algorithms additionally executed directly via
ts-node against the real service files.

## 1. De-identification (C-034) — executed, both live paths

Two parallel implementations exist (generalization rule: traced call sites
before concluding — **both are live on different routes**):

- `POST /research/export/deid` → `DeidExportService` (12-key drop list,
  YYYY-MM date truncation, 5-year age bands + `90+`, **no pseudo-ID**).
- Research-portal query execution → `ResearchDeidentificationService` via
  `research-portal.service.ts:137` (25-key drop list, per-patient date
  shift +1…365d, `sha256(uuid+salt)[0:16]` pseudo-ID, default salts).

18-identifier battery (names/DOB/age-95/phones/address/city/ward/district/
zip/national-ID/passport/email/IP/device/photo/biometric/account/cert/
vehicle/URL/license + a free-text note containing name, ID, DOB, phone,
address, email), executed against both real implementations:

- **RES-001 (S0, RUNTIME-PROVEN): the "de-identified" outputs re-identify.**
  `DeidExportService` passes through **raw**: `patient_id` (UUID),
  `city`, `ward`, `district`, `zip`, `photo`/`biometric` refs,
  `account_number`, `certificate_number`, `vehicle_id`, `url`,
  `license_number`, full `clinical_notes` (name + national ID + DOB +
  phone + address + email intact), and full `created_at` timestamps
  (`_at` keys skip the `_date` truncation branch). 12 of 18 categories
  leak. `ResearchDeidentificationService` passes through **raw**:
  `full_name`, `age:95`/`age_years:95` (no `age` key in its drop list),
  `district`, `zip`, and the same intact `clinical_notes`. **No free-text
  NLP scrubbing exists anywhere** (verified: zero scrub/redact calls in
  either path; the dictionary claim of "exact DOB suppressed" holds, but
  only by dropping while leaking everything around it).
- **RES-002 (S0, RUNTIME-PROVEN): default-salt exploit chain is practical.**
  Salts are absent from `.env` (grep: zero hits), so the server runs the
  hard-coded defaults. Clean-room recomputation with the public default salt
  reproduced the service's pseudo-ID bit-for-bit (`19d33316727a5ddb`).
  Anyone with source access can recompute every pseudo-ID and every date
  shift (+1…365d, always forward). Combined with the already-confirmed
  horizontal IDOR census (S-001: UUIDs enumerable), this is a complete
  re-identification path for research exports — no brute force needed.
  Independent risk even without IDOR: stable pseudo-IDs link exports
  longitudinally, and forward-only shifts preserve exact within-patient
  intervals (high utility, but also high linkage value).
- **RES-003 (S1, RUNTIME-PROVEN): the export endpoint itself is broken.**
  `POST /research/export/deid` 500s: it INSERTs
  `exported_by/cohort_name/purpose/...` into `deid_export_log`, whose real
  schema has `requested_by/cohort_id/...` instead (further provisioning
  drift). The C-034 export path cannot complete; the de-id inside it (leaky
  per RES-001) never even ships.
- Dead-code logic bug (code-read + execution-confirmed): `date_of_birth`
  is in the drop list, so the `age_band` branch below it is unreachable —
  **no age band is ever emitted** (output confirms: no `age_band` key),
  even though the portal data dictionary advertises `age_band` values and
  "exact DOB suppressed". The dictionary misdescribes the behavior.
- Positive, bounded: `age 95 → '90+'` (DeidExportService, Safe-Harbor
  compliant); portal cohorts suppress below `min_records` (default 5).
  Suppression is count-only — no small-cell handling inside released rows.

## 2. Cohort builder — correctness vs hand SQL

- `CohortBuilderService.buildQuery`: flat AND/OR over a fixed allowlist
  (no NOT, no nesting, no "within N days" beyond hard-coded 12-month
  windows, `LIMIT 10000`, `LIKE prefix%` diagnosis match). Adequate for
  simple cohorts; anything temporal-compositional is inexpressible.
- **RES-004 (S1, RUNTIME-PROVEN): `runCohort` 500s on provisioned tenants**
  (`relation "hiv_enrollments" does not exist` — drift again) and, by code,
  returns **identified rows** (`full_name`, `date_of_birth`) to **any JWT
  role** (`POST /research/cohorts/run` tested as receptionist → reached the
  query, i.e., no role check before the 500). A cohort tool that returns
  names+DOBs to receptionists is a design-level privacy miss even once the
  table exists.
- Portal `buildAndRunCohortQuery` is AND-only (`conditions.join(' AND ')`),
  always includes raw `patient_id` + `date_of_birth` pre-de-id (dropped
  downstream — verified in output), and always passes `district` +
  `province` through — sub-state geography the dictionary calls
  "district level only" as if that were suppressing; with shifted dates +
  rare diagnoses it is a quasi-identifier triple.

## 3. Kaplan–Meier (C-017/C-035) — numeric oracle vs lifelines 0.30.3

Identical 16-subject dataset (ties, censoring, early/late events), executed
on both:

- Point estimates match to output precision (3dp): e.g. 0.875 / 0.808 /
  0.734 / 0.661 / 0.578 / 0.413 / 0.275 / 0.138; median 15 = 15.0 both.
- Plain-Greenwood CI matches the manual oracle to 3dp (e.g. t=5
  [0.713, 1] vs [0.712948, 1.0]); transform is **plain** (clamped [0,1],
  hits exactly 0 at the tail — lifelines' default log-scale CI differs, as
  expected for a different transform).
- **RES-005 (S3, RUNTIME-PROVEN): the advertised "1e-6" agreement is
  unachievable by construction** — outputs are rounded to 1e-3 (`Math.round
  (…*1000)/1000`), so any comparison at 1e-6 fails on rounding alone.
  Claim the precision the output actually carries (1e-3) or stop rounding.
- Edge defects (executed): all-events-at-t=0 and single-subject runs emit
  `survivalProbability: 0` with **`lowerCI/upperCI: null`** (NaN through
  `Math.round` → JSON null) — downstream consumers doing arithmetic on CI
  get nulls. No events → flat 1.0 (correct). No log-rank test, no left
  truncation, `atRisk` column present (positive). Median uses *rounded*
  survival (S=0.5004 rounds to 0.5 → early trigger at the boundary — S4).
- `computeFromDb`: month-bucketing (`/30`), LTFU = `art_status NOT IN
  ('on_art','transferred_out')` (deaths counted as events — consistent with
  the Sprint-B exclusion debate; flag for the canonical-definition work),
  treatment-failure time = first VL≥1000 else *now* (censored-at-now is
  correct only if "now" is the last-contact date — overstays survival for
  lost patients).

## 4. VigiBase (C-018/C-036) — executed

- **RES-006 (S1, RUNTIME-PROVEN): "E2B format" is raw JSON rows.** `GET
  …/export-vigibase` returns the DB rows verbatim (`patient_id` in clear,
  free-text drug/event strings) — no ICSR/E2B(R3) XML, no ICH elements, no
  MedDRA coding, no WHO-UMC causality mapping (repo-wide precise grep for
  `E2B|ICSR|MedDRA|VigiFlow` = zero implementation hits), no submission
  path to UMC/VigiFlow. Worse, it then sets `vigibase_exported=true` —
  **the flag asserts a regulatory submission that never happened**, so the
  records also disappear from the "unreported" queue. (Demonstrated: reported
  a DTG/rash/hospitalized event, exported, got JSON + `exported:1`.)
- The irony for Section 3.6.1: the pharmacovigilance export is not
  de-identified at all (raw UUID + free text), while the research export
  that claims de-identification leaks (RES-001).

## 5. External collaborator access (C-037) — executed

Token machinery itself is sound: `rpt_` + 160-bit random, expiry enforced,
`uses_remaining` enforced + decremented, token↔query binding enforced
(`Token does not match query`). No revocation endpoint exists (404 —
  revocation = waiting for expiry/uses, max default 72h/3 uses).

- **RES-007 (S1, RUNTIME-PROVEN): "without an EHR account" is false.**
  `ResearchController` is class-level `@UseGuards(JwtAuthGuard)` with zero
  `@Public()` exemptions, so `GET /portal/query/:id?token=rpt_…` **401s
  without an EHR JWT** — the token is unusable unless you already hold the
  credential it replaces. (Verified the 401 is the JWT guard, not the token
  logic.) Even with a JWT, execution 500s on `column q.tenant_id does not
  exist` (drift in `validateToken`'s JOIN) — the portal path is doubly
  inoperative. Token-in-URL (`?token=`) additionally leaks bearer credentials
  into logs/proxies (S3 note; header alternative exists but is also
  JWT-gated).

## Rule-2 rechecks

De-id: executed both real implementations (not just the endpoint's one);
salt exploit recomputed in a clean env; portal dictionary claims checked
against actual output keys. KM: independent lifelines oracle, manual plain-
Greenwood recomputation, 3dp-vs-1e-6 distinguished. VigiBase: precise
case-sensitive implementation grep + live export shape. Tokens: guard chain
read (controller → JwtAuthGuard → Public-reflector) + live 401/500s.
