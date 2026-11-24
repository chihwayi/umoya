# 3.5 HIV, NCD & Specialty Modules

Read-only; no source edited. Cascade SQL and the ART switch engine were
EXECUTED (scratch postgres 55433 + ts-node, 2026-11-24); disclosure/CDPA/NCD
are code/data-read with exact paths (behavior needs booted stack — blockers
stated). This is the highest patient-safety-risk section: S0s are not softened.

## HIV cascade 95-95-95: EXECUTED — definitions wrong (S1)

Ran the EXACT headline + strata SQL from `cascade-metrics.service.ts:14-65`
against a throwaway postgres with a hand-built 12-patient cohort (edge cases:
transfer-out, deceased, LTFU, discontinued, `closed`, stale 13-month VL,
boundary VL 999 vs 1000, no-VL, ART-naive with VL). Tear-down done
(container removed); no tenant/master DB touched.

Code output: `diagnosed=10 onART=9 suppressed=3 second95=90.0 third95=33.3`
— matches hand computation exactly (so the code runs as written; the
definitions are what's wrong):

1. **Deaths, LTFU, and discontinued patients inflate every denominator (S1).**
   Exclusion is `NOT IN ('closed','transferred_out')`, but the provisioned
   status CHECK (`database-provisioning.service.ts`, `hiv_care_enrollments`
   CHECK: active/transferred_out/lost_to_followup/deceased/discontinued) has
   no `'closed'` value — the exclusion is vacuous except for transfers.
   Executed proof: deceased P06 counted in diagnosed+onART+suppressed; LTFU
   P07 and discontinued P08 counted in diagnosed+onART. A program with 20%
   mortality reports a *better* cascade than one with 0%.
2. **Strata contradict the headline (S2).** By-sex/by-age suppressed counts
   filter visits by VL/date only — they do NOT re-check `on_art`. Executed:
   strata suppressed total = 4 (F=3 incl. ART-naive P04 with VL 300; M=1) vs
   headline suppressed = 3. Dashboards summing strata disagree with the
   headline number.
3. **Two parallel truths.** `cascade-metrics` reads `hiv_enrollments`;
   `cascade-analytics` (`cascade-analytics.service.ts:36-98`) reads
   `hiv_care_enrollments` with different exclusions
   (`NOT IN ('deceased','discontinued')` for gaps, TX_CURR proxy logic) and a
   fabricated denominator (`population = round(diagnosed*1.45)`, "rough 69%
   diagnosis rate proxy", :69). Two services, two tables, three exclusion sets.
4. Boundary behavior correct: VL 999 counts, 1000 does not (strict `< 1000`
   matches WHO <1000 threshold); 13-month VL correctly excluded (12-month
   window); transfer-out correctly excluded everywhere.

**Verdict on C-019/C-025 cascade reporting: BROKEN definitions (S1).**
Blocks any "95-95-95 ready / PEPFAR/MOHCC ready" claim until exclusion sets are
unified to a documented standard (deaths/LTFU/discontinued out of all cascade
denominators; strata gated identically to headline).

## ART regimen-switch engine: EXECUTED — DTG-failure contradiction (S0)

`hiv-resistance.service.ts` executed via ts-node (real code, synthetic inputs):

| Case | assessRisk | recommendRegimenSwitch | Assessment |
|---|---|---|---|
| NNRTI fail 14 mo, VL 5000 (was 200) | high (K103N/Y181C) | TDF+3TC+**ATV/r** 300/100 OD, no specialist flag | Runs; PI-based per code |
| Same, pregnant | high | TDF+3TC+**LPV/r** BD ("preferred in pregnancy") | Runs; pregnancy branch works |
| Same, creatinine 2.5 | high | **AZT**+3TC+ATV/r ("TDF avoided, creatinine > 1.5") | Runs; renal branch works |
| PI rebound 30 mo | high (M184V) | DRV/r+DTG+optimised NRTI, NATC approval required | Runs |
| Suppressed TLD | low | Continue + EAC | Correct |
| **DTG failing 18 mo, VL 7000** | **high (M184V)** | **"Continue current regimen… Resistance risk is low"** | **S0 contradiction: assessment high, recommendation claims low risk, no switch** |

Findings:

1. **S0 — DTG-failure blind spot.** The INSTI rule matches only `RAL`
   (`hiv-resistance.service.ts:38-44`); DTG failure falls through every switch
   branch to the default "continue" text whose hardcoded rationale asserts
   *low* risk — directly contradicting the high assessment one call earlier.
   A clinician seeing "risk is low" continues a failing DTG regimen (resistance
   accumulation). Fix direction (not implemented): INSTI rule must include DTG,
   and the default branch must echo the assessed risk, never hardcode "low".
2. **S1 — `recommend-regimen` endpoint has no safety gates.**
   `POST patients/:id/recommend-regimen` (`hiv.controller.ts:581-588`) takes a
   **client-supplied** `resistanceAssessment`, defaults creatinine to 1.0 when
   absent, and calls the switch function directly — no EAC verification, no
   precheck (`precheckRegimenChange` with its pregnancy/TB/renal blocks and CDSS
   DDI append at `hiv.service.ts:2907-3144` is a *separate* flow used by
   `createArvChangeRequest`). A switch recommendation is obtainable without
   the EAC and renal/TB gates the change-request flow enforces. Needs
   endpoint-level test with crafted assessment JSON (blocker: booted stack) —
   but the missing call is visible in the controller source.
3. **S2 — second-line choice dated.** NNRTI failure → ATV/r-based second line as
   *the* recommendation; current WHO consolidated guidance prefers DTG-based
   second line (DTG + optimized NRTIs) with boosted PI as alternative, and has
   moved away from ATV/r specifically. Inside the alternative set, but not the
   preferred path the brochure's "Centre of Excellence" implies.
4. **S1 — DTG+rifampicin gap.** Safety matrix warns ("protocol-level dosing
   review", `hiv.service.ts:2724-2738`) but no switch output implements WHO's
   DTG 50 mg BID with rifampicin; TB/HIV co-infected patients get no actionable
   dose. Code-read; needs dosing-path execution.
5. Verified sound: TLD `1i` preferred first-line seed; VL<1000 suppression
   threshold throughout; EAC gating (≥2 consecutive VL≥1000) + doctor-only
   approval inside the change-request flow (`hiv.controller.ts:273-325`;
   change validation :3158-3339 incl. <6-months-on-ART and suppressed-VL
   rejections). Paediatric bands + BSA Mosteller exist
   (`hiv-pediatric-dosing.service.ts:27-108`); weight/age edge testing of the
   paediatric tables is Sprint E/desired follow-up (blocker: cross-check
   against WHO weight-band tables).

## Adolescent disclosure: code-read — no age/role gates (S0 candidates)

- Data model sound: `hiv_disclosure_records` with 4-state enum incl.
  `disclosure_not_applicable` (`hiv-disclosure.service.ts:9`), `patient_age`
  recorded (:21) — **but age is never used for gating** (no call-site filters
  on it).
- Endpoints guarded by `JwtAuthGuard` only (`psychosocial.controller.ts:10-11`);
  no role check (counsellor-only scoping exists for sessions at :85-94 but not
  for disclosure reads/writes at :21-36).
- Offline sync allowlists disclosure records (controller :8-11 + frontend
  `offlineSync.ts:24`) — status syncs to devices with whatever the device
  auth is.
- No disclosure linkage found in patient app (portal-hiv controller: only
  MMD/ANC-EID fields), mobile (`HivCareScreen` zero matches), SMS (templates
  generic by design — good), household/family-risk (zero hiv/disclosure
  matches — good). So the leakage surface is the clinician API + offline
  stores, not the app/SMS — but **any authenticated role can read any
  adolescent's disclosure status, with no MINOR_ASSENT tie-in** (consent type
  exists in `consent-records.service.ts`, no call-site links it).
- **Verdict: PARTIAL with S0-leaning gaps** — capture exists, access control
  does not. Needs role×age matrix testing on a booted stack (blocker).

## CDPA 2021 technical-controls check (explicitly NOT legal advice)

- Consent capture: 6-type consent (`hiv_testing, data_sharing_research,
  sms_communication, treatment, photography, minor_assent`),
  grant/withdraw/expiry, tokenised digital consent (24 h),
  `hasActiveConsent` checks (`consent-records.service.ts:16-67`).
- Data-subject rights: access paths exist (consent export, portal records,
  `getAccessReport`); **no dedicated rectification/erasure endpoint found** —
  revocation is status-flip, audit logs are delete-protected by trigger
  (`trg_prevent_hipaa_audit_logs_delete`), session cleanup deletes only
  `active_staff_sessions`. A "delete my data" request has no technical path
  for clinical rows.
- Breach: POTRAZ pipeline implemented (hourly 48 h check, 72 h overdue flag,
  `NEWLANDS-BREACH` refs, `dpa@potraz.gov.zw`, Section 43 + 30-day patient
  notice template, `detectBreaches` heuristics incl. >500-record bulk export).
- Retention: **no clinical-data retention/purge policy found** (only session
  cleanup cron). Consent expiry is per-record.
- Cross-border: DISA VL pull (Bearer [REDACTED]) + SmartCare sync persist to tenant DB
  with **no `hasActiveConsent`/data-sharing gate call** in
  `disa-smartcare.service.ts`; a `cross_border_patient_flags` entity exists.
  LLM/cloud paths are env-gated (Bedrock/Gemini/Anthropic keys present in
  `.env` — values never read) with CDSS redaction + egress allowlists as
  backstops (both env-overridable).
- **Verdict: PARTIAL** — capture/breach-notification machinery present;
  erasure, clinical retention, and cross-border consent gating absent. Sprint D
  owns endpoint verification; a lawyer owns the legal conclusion.

## NCD calculators: EXECUTED where pure; equation gaps confirmed

- **eGFR: no CKD-EPI/MDRD/CG computation anywhere in clinical code (S1).**
  Only creatinine-based computation in the product is Cockcroft-Gault CrCl in
  the dosing module (not eGFR). Staging (`nephrology.localCkdStaging`,
  `ncd-complication.localCkdStage`, CDSS `main.py:9570+`) maps a
  *supplied* eGFR to KDIGO G1–G5/A1–A3 (cutoffs correct). `egfr_equation`
  columns default to the `'CKD-EPI'` label with no computation behind it, and
  the frontend instructs "Enter eGFR directly". Mixed units (µmol/L in
  entities, mg/dL in lab interpreter, mg/mmol ACR) with no converter found.
  Any C-026 "CKD GFR staging" claim rests on user-entered eGFR.
- **CVD: two divergent Framinghams (S2).** EHR points-table
  (`ncd-comorbidity.service.ts:7-64`) vs CDSS additive score
  (`risk_scoring.py:12-116`). Hand-trace on identical high-risk man (55 y,
  TC 6.2, HDL 1.0, SBP 150 treated, smoker, diabetic): **EHR 20% vs CDSS 40%**
  (CDSS `min(score*2,40)`). Worse, the EHR `riskMap[Math.min(points,15)]`
  makes the `?? (points > 15 ? 30 : 1)` fallback dead code — the effective cap
  is 20%, so the highest-risk men under-read (published Framingham would put
  21 points ≈ 30%). Band thresholds still land "very_high" (≥20), so triage
  bands survive but the number is wrong. EHR table shape otherwise tracks
  published D'Agostino points; CDSS version is a cruder sum.
- **Diabetes foot: sound rule set (code-read).** Wagner≥4 critical / 3 high /
  2 high / 1 moderate, sensation/pulse gating, ABI bands (<0.4 critical …
  >1.3 non-compressible), amputation-risk thresholds, review intervals
  (`main.py:16032-16126`) — internally consistent; needs oracle comparison
  against IWGDF risk strata (blocker: guideline cross-check, Sprint E).
- **Epilepsy/AED: present and directionally right (code-read).** Valproate
  contraindicated in WRA unless no alternative, lamotrigine preferred,
  VPA+lamotrigine halving, LPV/r→VPA induction warning, enzyme-inducer×OCP
  warning, folate 5 mg, status-epilepticus IV valproate 40 mg/kg
  (`epilepsy_protocol.json`, `main.py:9065-9112`, `mental-health.service:339`).
  Needs dose/level numeric validation (blocker).

## Inpatient/pharmacy (brief, per §3.5 scope)

Not executed (needs concurrency harness + booted stack): ADT race conditions,
BCMA five-rights bypass, OR Gantt math, FEFO/cold-chain, demand-forecast
backtest. Code-read only: FEFO/cold-chain/demand paths exist per recon;
**no validation of the forecasting model against a naive baseline was found** —
flag for Sprint E. PDMP: literal `'pharmacy_pdmp_check_proxy'` only; no
counterparty integration identified — the C-021 "PDMP monitoring" clause has
no implementation behind it (S1, code-read; Sprint B scope confirms absence
of wiring, behavior UNVERIFIED).
