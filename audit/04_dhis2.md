# 3.4 DHIS2

Read-only; no source edited. Tested against a **real DHIS2 2.40.0.1** stood up
for this sprint (docker `dhis2/core:2.40.0` + postgis, throwaway data, org unit
`tnPY4GUlHZ3`, dataset `z6BZYWD44BF`). Umoya-side behavior below the API line
is code-read with exact paths; wire behavior was executed against the live
server. Containers left stopped (not removed) for Sprint D/E reuse; no
production system touched.

## 1. Aggregate push: EXECUTED end-to-end (server side) — works, with caveats

Against live 2.40.0.1, in Umoya's exact `sendDataValues` shape:

- First push: **200 SUCCESS, imported 2, 0.23–0.32 s**.
- Identical resubmission: **200, updated 2** (idempotent server-side, no dupes).
- Changed values: **200, updated 2** (correct update path). Read-back
  confirms `lastUpdated` bump. Per-push latency ~0.15–0.3 s on localhost —
  "real-time" is plausible per-push, but see §5 (schedule).
- Server conflict taxonomy verified hands-on: missing org-unit assignment →
  `E7617`; bad dataset → import ERROR; future period → "after latest open
  future period"; wrong COC → 409 WARNING. **Umoya's `sendDataValues` posts and
  extracts import counts, then logs `status:'success'` + returns "Data values
  sent to DHIS2 successfully"** (`dhis2.service.ts:3270-3295`). Whether a 409
  WARNING with `ignored>0` surfaces as failure depends on `extractImportCounts`
  — read it: counts are logged, `status` comes from `response.data.status`.
  A partial-ignore (WARNING) still returns success-shaped payload with the
  counts inside; no alert is raised on partial ignores at this layer
  (scheduler alerts only on error-count threshold). **PARTIAL**: plumbing is
  real and idempotent; partial-failure surfacing is weak — a rejected value
  inside a WARNING batch is logged, not escalated. S2.

## 2. Tracker (legacy `/events`) push: EXECUTED — works on 2.40

Built program + stage + TEI (unique-attribute dedup verified: second TEI with
same MRN rejected) + enrollment on the live server; posted Umoya's exact
`sendEvent` shape (`{program, programStage, orgUnit, eventDate,
status:'COMPLETED', trackedEntityInstance, enrollment, dataValues:[]}`):
**200 SUCCESS, imported 1, 0.78 s**. Duplicate event POST: **409 ERROR,
ignored 1** (server-side duplicate guard, 0.17 s).
Legacy `/events`, `/enrollments`, `/trackedEntityAttributes` all functional
on 2.40.0.1 — Umoya's legacy-API choice executes today (upgrade risk noted:
DHIS2 is moving to `/tracker/*`; no new-API path exists in repo).

## 3. Bidirectional claim: PUSH-HEAVY, read-analytics-back — PARTIAL

Wire inventory of every `context.client.get` in `dhis2.service.ts` (lines
638–4266): trackedEntityAttributes, dataSets, programs, dataElements,
organisationUnits, system/info, **analytics**, validationRules. Data flows
Umoya→DHIS2 for clinical records (patients→TEI, encounters/lab/vitals→events,
aggregates→dataValueSets); DHIS2→Umoya is **metadata + computed analytics +
validation rules only** — no download of TEI, dataValues, or enrollments into
clinical tables exists (verified by grep: no `/dataValueSets` GET, no TEI
download). "Bidirectional, real-time two-way sync" (C-004) is **PARTIAL as
claimed**: push leg real, analytics-readback leg real, inbound record sync
absent. Pull-direction tests (analytics recompute vs server, validation-rule
evaluation) need a seeded analytics job — UNVERIFIED, blocker: analytics
tables build on booted server (documented for E).

## 4. Mock vs real: DEFINITIVELY RESOLVED (code-read, exact logic)

`resolveContext` (`dhis2.service.ts:535-588`): `DHIS2_USE_MOCK=true` forces
mock; else tenant config wins, else env (`DHIS2_URL` + PAT-or-basic). Missing
credentials → `useMock:true` with reason logged and **`[MOCK] … Successfully
synced` messages that mimic success** (service:2973-2981, 3111, 3249).
This checkout's `.env`: `DHIS2_URL=http://${SERVER_HOST}:8888` (template —
resolves via compose envsubst), `DHIS2_API_VERSION=40`, PAT present (48 ch),
`DHIS2_USE_MOCK=false`, `DHIS2_SCHEDULED_SYNC_ENABLED=false`. So here real
mode engages (and would hard-fail on unreachable URL — error, not mock). Any
environment WITHOUT URL/PAT (e.g. plain `.env.example` values) silently runs
mock-success. **The mock path is not hypothetical: it is the default whenever
credentials are absent, and its messages are indistinguishable from success in
logs.** Whether a given deployment ever ran real sync = check its env +
`dhis2_sync_log` rows for `MOCK_` references. Sprint E: add a startup banner
`DHIS2 MODE=REAL|MOCK` (recommendation, not implemented).

## 5. "Real-time": FALSIFIED as scheduled behavior

Scheduled sync is **opt-in and default-off**
(`DHIS2_SCHEDULED_SYNC_ENABLED=false`; hourly `@Cron` gated at
scheduler:42,188). With defaults, sync happens only via manual
`triggerTenantSync` / controller POSTs. Per-push latency (~0.2–0.8 s measured)
is real-time-capable; the *system* as shipped is manual-or-hourly, not
real-time. **Verdict: PARTIAL** (capable, not configured). Latency budget for
a real claim: push 0.2–0.8 s + scheduler hourly + retry backoff (limit 20
default) — worst-case visibility delay is hours, not seconds.

## 6. Indicators: recomputed definitions; cascade bug does NOT propagate (verified by reading both)

Critical cross-check with Sprint B's S1: the scheduled `sendAggregateReport`
**does not use `cascade-metrics.service`** (the buggy `NOT IN
('closed','transferred_out')` denominators). Its `hiv_monthly` profile runs
its OWN queries against `hiv_care_enrollments` (`dhis2.service.ts:1180-1269`):

- `plhivActiveInCare` / `artCoverageCount`: `enrollment_status IN
  ('active','in_care','incare','on_art')` — deaths/LTFU/discontinued/
  transferred_out correctly EXCLUDED. **The DHIS2-bound aggregate uses the
  right exclusion set.**
- BUT: (a) VL-suppressed counts visits in the *month window* with no ART or
  enrollment gate (`viral_load < 1000`, period-bounded only) — includes
  non-ART VLs and differs from the 12-month cascade definition; (b) the
  dashboard cascade (Sprint B, wrong denominators) and the DHIS2 push (right
  denominators, different window/gating) report **different numbers for the
  same concept** — verified by reading both; (c) missing tables degrade to 0
  via `safeMetricCount` (service:944-960) — silent zeros, not errors.
- **Finding: the wrong numbers reach the dashboard, the differently-defined
  numbers reach DHIS2/PEPFAR.** Neither is the hand-verified cascade. The
  Sprint B bug does not flow into DHIS2 payloads, but indicator
  inconsistency across surfaces is itself an S1 reporting-integrity issue
  (C-019/C-025). Needs a single canonical cascade definition consumed by
  both (Sprint E).

## 7. "Without a single spreadsheet": code-path FALSIFIED? No — NARROWLY TRUE, honestly scoped

`grep` over cascade/DHIS2 services + controllers: **zero CSV/XLSX code** in
the DHIS2/cascade path. The API-to-API pipeline (compute → POST
/dataValueSets → import summary) has no export-import step. HOWEVER:
spreadsheet capability exists repo-wide (`report-export.controller`,
`migration.controller`, research export, frontend `reportExport`), so a human
workflow could still route through Excel — that is behavioral and untested.
Honest verdict: **the DHIS2 sync code path is spreadsheet-free (VERIFIED at
code level); the human-workflow claim is UNVERIFIED** (would need
observational study of M&E staff practice).

## 8. Tracker metadata gaps (code-read)

`sendEvent` resolves data elements by `MC_DE_*` codes and **silently drops
unmapped fields** (`deMap.x && {...}` filter, service:3357-3366) — an
encounter missing mapped elements posts an event with empty dataValues and
still returns success. TEI mapping missing → ERROR with "run patient sync
first" (correct gate, verified in code). patient sync itself (`syncPatients`,
service:2956+) pushes all active patients — including, by its own query,
anyone `isActive` regardless of consent flags (consent-gating of DHIS2 export
not found — **S1 candidate for D**: exporting identifiable records to a
national system without a data-sharing consent check in the push path).
