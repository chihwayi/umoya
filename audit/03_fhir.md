# 3.3 FHIR / Interoperability

Read-only; no source edited. Mapper/translator logic was EXECUTED via ts-node
against synthetic entities (no patient data, no tenant DB). Validator runs used
validator_cli 7.0.6 (base R4). Networked DHIS2/FHIR-server tests are in
`04_dhis2.md`. Absence-evidence rule applied throughout.

## 1. Canonical storage → round-trip loss: EXECUTED — 39.5% value loss, plus corruption

Harness: `/tmp/sprintC_rt2.ts` — 10 types × 25 synthetic records = **250
resources, 3675 scalar values** through `toFhir → fromFhir` (real mapper code).

**Result: 2275 kept / 1400 lost = 38.1% field-value loss** (re-run with
canonical `ICD10` input after the row-1 correction; first run read 39.5% with
hyphenated input). Headline number overstates clinical harm (includes internal
ids + audit timestamps), so the load-bearing evidence is the verified
per-field set, each executed:

| # | Loss / corruption | Verified behavior | Severity |
|---|---|---|---|
| 1 | **CORRECTED (reviewer re-executed):** `mapCodeSystem()` (condition.mapper.ts:158-168) uppercases but does no hyphen/whitespace stripping, so a non-canonical system string silently drops the coding | Harness used hyphenated `ICD-10` (harness artifact, not a design choice). Re-probe executed: `ICD10`+SNOMED → both codings preserved (`sct:86406008`, `icd-10:B24`); `ICD10` alone → preserved; `ICD-10` → `coding: []` with no warning; `SNOMED_CT`-as-system with ICD code → mislabeled `sct:B24`. Real exposure: the only in-repo writer (`problem.service.ts:78`) always writes canonical `SNOMED_CT`, and no schemas/seeds write ICD strings — production rows map correctly; affected rows are legacy/migrated/manual `code_system` values flowing verbatim via `patient.service.ts:761` into all five `toFhir` call sites | S2 |
| 2 | Combination-drug dose **mangled** | `MedicationRequest` dosage `300/300/50mg` → `doseQuantity.value = 300` (first number); round-trip `dosage = "300"` — TLD becomes "300mg of something" | S1 |
| 3 | Instructions **overwritten** | `"Take every morning with food"` replaced by generated dosageInstruction `"300/300/50mg once daily"` in FHIR and round-trip | S2 |
| 4 | Allergy severity **downgraded** | moderate → criticality `low` → back `mild` | S1 (re-exposure risk assessment) |
| 5 | Name/address truncation | `toFhir` concatenates given→single string, address lines→single line, one telecom, one contact, one identifier; middleName, second phone, district/postal silently dropped | S2 |
| 6 | Non-deterministic regeneration | `immunizationNumber = IMM-<timestamp>` and `MedicationRequest.identifier` minted fresh on every `fromFhir` — breaks idempotency matching and test reproducibility | S2 |
| 7 | Vitals composite split | `120/80` → separate systolic/diastolic Observations; `fromFhirToVitals` reads one → round-trip loses the other + temp/glucose/height/BMI handling is per-observation | S2 |
| 8 | Gender normalization lossy | `m`→`male` fine, but unknown tokens pass through unvalidated | S3 |

"FHIR is the data model" (C-030): **FALSIFIED as stated.** The canonical model
is relational; the FHIR layer is lossy in the export direction and lossy again
on import. It is a translation view, not the model.

## 2. /metadata CapabilityStatement: code-read (runtime UNVERIFIED)

`fhir.controller.ts:19-29` returns `fhir.service.getCapabilityStatement()`,
which declares `fhirVersion: '4.0.1'` (service:146), `format: ['json','xml']`,
`rest[0].mode: 'server'`, and per-resource read/search/`$everything`/history —
with `update/create/delete` + `$validate` wired in the statement for most
resources. Two gaps vs the statement: (a) XML format claimed — no evidence any
path serializes XML (all mappers emit JSON objects; no xml-builder found);
(b) `$validate` advertised — no `$validate` operation handler found in the
controller route list (routes seen: metadata, $batch, $transaction, CRUD).
Whether the statement over-claims needs a booted-server GET /metadata
(blocker). **Verdict: UNVERIFIED** (statement content verified, behavior not).

## 3. R4-vs-R5: settled — R4-only, no negotiation

Executed-adjacent evidence (repo-wide, Sprint A + re-grep): sole FHIR typing
dep `@types/fhir@^0.0.41` (R4); `fhirVersion: '4.0.1'` hardcoded;
**zero** `fhir/r5`, `"R5"`, R5 profile URLs anywhere. CapabilityStatement
declares 4.0.1. There is no dual-version question to test — no R5 code path,
no content negotiation, no version-conversion. C-003's "R4/R5" wording is
**MISLEADING** (S2 for the wording; R4 surface itself is real).

## 4. Validator results per resource type: EXECUTED

- Mapper-exported **Patient** (synthetic Tendai Moyo) vs base R4: **0 errors,
  1 warning** (dom-6 narrative, best practice). Clean.
- Mapper-exported **vitals bundle** vs base R4: systolic/diastolic are
  structurally valid standalone Observations, but **do not match the canonical
  `bp` panel pattern** (no 85354-9 panel, no systolic/diastolic components —
  5 profile errors). Any consumer expecting standard BP panels (including
  WHO SMART IGs, which use the panel pattern) will misread or reject them.
  **PARTIAL** (S2 interop friction, not invalid FHIR).
- DAK Questionnaire/PlanDefinition runs: see Sprint B (0E vs v1.0.0 IG).
- `$batch` bundle shape: mapper outputs carry no `fullUrl`; whether the
  `$batch`/`$transaction` path injects them was not executed (needs booted
  server) — **UNVERIFIED**, flagged for E.

## 5. Terminology: Sprint A's question SETTLED — real SNOMED load

- RF2 International release **2025-11-01** extracted under
  `downloads/snomed_extracted/`; importers (`import-snomed-postgres.js`,
  `import-snomed-rf2.sh`, UK snapshot/delta scripts) load concepts, descriptions
  AND the SNOMED→ICD-10 map into postgres (`snomed_concepts`,
  `snomed_descriptions`, `snomed_to_icd10_map`, materialized search view).
- Live endpoints: `snomed/search`, `snomed/validate/:conceptId`,
  `snomed/map/:conceptId/ICD10`, `rxnorm/*` (controller:92-281).
- Entities carry `snomedConceptId/Term` alongside ICD codes (allergy, problems,
  labs) — and the round-trip (§1.1) shows SNOMED is actually the *preferred*
  outbound code.
- Licensing: RF2 distribution requires a SNOMED International affiliate
  licence; `docs/UMOYA_EHR_Master_Assurance_Programme.md`,
  `scripts/setup.sh`, `import-snomed-rf2.sh` reference licence/MLDS handling,
  but no licence file/expiry was verified in-repo — **regulatory follow-up,
  Sprint E**. Verdict: hard-coding claim **REFUTED** (real load path);
  licence currency UNVERIFIED.

## 6. Bidirectional exchange under adversarial input: EXECUTED — 4 fails

`FhirInboundService.importResource/Observation/Condition/MedicationRequest`
executed against scratch postgres (throwaway container, removed after) with
the service's exact SQL. Only **3 resource types are handled**; everything else
is skipped-but-counted-imported:

| Test | Result | Verdict |
|---|---|---|
| Well-formed Observation | Stored | PASS |
| Duplicate resubmission | **Stored again** — no idempotency (no unique constraint; `ON CONFLICT DO NOTHING` at service:77 never fires without one) | **S1 BROKEN** |
| Conflicting value, same timestamp | **Stored as 3rd row, no conflict flag** — the "newer timestamp wins" comment (service:73) is false; no comparison exists | **S1 BROKEN** |
| Missing subject | Silently skipped, returns non-conflict → **counted as imported** | S1 (phantom success) |
| Non-numeric value (`"HIGH"`) | INSERT throws, caught + warn-logged, returns non-conflict → **counted as imported: silent data loss** | **S1 BROKEN** |
| SNOMED-coded Condition | Stored with **`code_system='ICD10'` hardcoded** regardless of actual system | **S1** (systematic mislabeling) |
| Duplicate Condition | Inserted twice (problems count 2) | S1 (no merge) |
| New MedicationRequest | **Nothing stored, returns non-conflict → counted imported: silent drop of prescriptions** | **S1 BROKEN** |
| Duplicate med (ILIKE match) | Only working conflict path (`conflict:true`); but substring match (`%text%`) — empty text matches everything | S2 |
| Unsupported type (Patient) | Skipped + counted imported | S2 (inflated import counts) |
| 10k-entry bundle | 2.7 s (~3.7k/s) — performance fine | PASS |

No patient-existence check before insert (relies on FK in prod → would fail
caught+counted-imported); no provenance/author recorded; no `$batch`
atomicity (each resource independent — partial imports). **C-015
"bidirectional, zero manual rekeying": BROKEN as claimed.** Inbound is a
3-type lossy funnel that reports success for skipped, failed, and dropped
resources.

## 7. "Zero manual rekeying", traced step-by-step: FALSIFIED (3/3 legs)

- **Lab result import:** LIS/NHLS → `hl7.controller/oru` or
  `nhls-hl7.controller` → `nhls_results` pending queue → clinician opens
  `results/pending` → PATCH `linkResultToPatient` (manual patientId when
  auto-match fails) → `markResultAsReceived`. Auto-match is by exact patient
  number only; unmatched order number **throws** (no pending queue in that
  path). The link step is human rekeying by design. **FALSIFIED.**
- **Referral out:** `referral.service.sendReferralExternally` = partner webhook
  POST **or email**, plus optional FHIR bundle payload. No FHIR-native
  referral exchange with an external server; receiving end re-enters.
  **FALSIFIED.**
- **Referral in:** `createReferral` is a manual API call; no inbound referral
  Bundle import exists (inbound handles Obs/Cond/MedReq only). **FALSIFIED.**
- **Insurer pre-auth:** `prior-authorization.service` state machine is
  clinician-filled; `medical-aid-api.service` routes to
  **medical-aid-demo-service (a simulator)** by default
  (`env-demo-fallback`, `demo-medical-aid-key`); real adapters are
  config-driven and no live provider integration was demonstrated. The
  "insurer" leg is demo-backed. **FALSIFIED as live integration**
  (UNVERIFIED for any specific real provider — none configured here).

## 8. HL7v2 ingestion: EXECUTED — 5 defects

`hl7.service.processAdtMessage/processOruMessage` executed via ts-node with a
fake tenant DB (real service code, synthetic messages):

| # | Defect | Evidence | Severity |
|---|---|---|---|
| 1 | **CR-delimited messages (standard MLLP framing) produce ghost patients** | `parseHl7Message` splits on `/\r?\n/` only; `\r`-only message → single segment → PID not found → creates row `{id, dateOfBirth: null}` (all demographics undefined), returns "processed" | **S1** |
| 2 | **First/middle names, city/province/postal always undefined** | `parseSegment` already splits components, then code splits `[0]` on `^` again: `pid[5][0].split('^')[1]` → `undefined`. Verified: stored row has lastName only | **S2** |
| 3 | **Missing PID still "processed"** | No-PID message → ghost row, no patientId in response, no rejection | S1 |
| 4 | **DOB timezone-shifted** | `parseHl7Date('19880511')` → local midnight → stored `1988-05-10T22:00Z`; date-only DOB becomes datetime, can display a day off in UTC contexts | S3 |
| 5 | **No HL7 ACK** | Responses are JSON `{"status":"processed"}`; no ACK generation (`simple-hl7` dep present but ACK path not found) | S2 (sender can't confirm) |

Positive control: `\n`-delimited A01 processes correctly (upsert by patient
number works; A03 update path works). ORU path: same `\r` bug applies; with
`\n` input, resultsCount parsed (needs booted-DB run for full path —
UNVERIFIED beyond parse). NHLS flow's manual link step stands (see §7).

## 9. FHIR API authorization: code-read (runtime UNVERIFIED, blocker: booted API)

- Class-level `JwtAuthGuard` + `TenantMiddleware` sets `req.tenantId`;
  guard **cross-validates token tenant vs request tenant**
  (`jwt-auth.guard.ts:24-30`) — cross-tenant replay blocked at guard level.
  Webhook allowlists (payment/SMS/WhatsApp) resolve tenant differently —
  Sprint D's SSRF/signature surface, noted not tested.
- **No patient-level scoping visible** in `getPatient`: any valid tenant token
  reads any patient in the tenant (no check that the caller may see THIS
  patient). IDOR-by-changed-ID, `$everything`, `$history`, `_include` leakage
  need runtime tests with two users — **UNVERIFIED**, blocker: booted stack +
  two principals. Flagged S1-candidate for D.
- `POST $batch` with mixed valid/invalid entries: atomicity unknown (needs
  runtime) — **UNVERIFIED**.
