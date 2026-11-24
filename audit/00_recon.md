# 00 — Recon (Phase 1, Sprint A)

Branch: `audit/a-recon-ledger`. Read-only; no source files edited. Sub-agent
sweeps (backend / frontends-integrations / tests-stub-census) fed this report;
every structural claim below was re-verified inline by the parent before writing.

## 1. Repo map

| Area | Stack | Notes |
|------|-------|-------|
| `services/ehr-service/` | NestJS 10 + TypeORM, `fhir/r4` types | Clinical core. `src/` has ~419 entities, ~19 FHIR mappers, controllers/guards/interceptors/services. `mock-ehr.module.ts`, `mock-main.ts`, `simple-ehr.module.ts`, `simple-main.ts` coexist at module root. `dist/` build output is committed alongside `src/`. |
| `services/tenant-service/` | NestJS 10 + TypeORM | Tenancy, auth, provisioning (`services/database-provisioning.service.ts` — the ONLY sanctioned DDL path), payments config entities, `qrcode` dep. |
| `services/cdss-service/` | Python (FastAPI-style `main.py`), torch/statsmodels/pandas vendored under `venv/` + `.venv/` | CDS brain: `drug_interactions.py` (CYP450 tables + `CRITICAL_INTERACTIONS`), `risk_scoring.py` (simplified Framingham point sums), `dosing_calculator.py`, `hiv_testing_algorithm.py`, `dhis2_tracker.py`, `diagnostic_assistant.py`, knowledge_registry/ + data/ guideline JSONs. Tests in `tests/` (pytest). |
| `services/medical-aid-demo-service/` | NestJS (sibling) | Insurer/demo integration. |
| `ehr-frontend/` | React 18.2 + TS (CRA+craco, Tailwind) | Main clinician UI. 8 locales in `src/i18n/locales/`. |
| `web-app/` | React + TS | Second web surface. |
| `patient-portal/` | React + TS (craco), locales in `public/locales/` | Patient-facing web. |
| `mobile/` | React Native/Expo (`App.tsx`, `eas.json`, `ios/`, `android/`) | Patient + companion app, incl. `services/telemedicine.ts`, `screens/CheckInScreen.tsx`, `screens/BillPaymentScreen.tsx`. |
| `packages/` | Shared libs (`@umoya/config` etc.) | Consumed via npm workspaces. |
| Infra | `docker-compose.yml` (16 services), `docker-compose.prod.yml`, `infra/`, `infrastructure/`, `livekit/`, `monitoring/`, `amazon/`, `snowstorm/` | Postgres-master (pgvector:pg15), redis, **livekit + egress** (self-hosted WebRTC + MP4 recording to MinIO), minio, prometheus, grafana, loki, mosquitto, caddy, dex, sftpgo. DHIS2 is NOT in compose (test against `dhis2/dhis2-core`, whose 2.40.0 image is cached locally — see RUNBOOK). |
| Data/seed | `seed/`, `sample-data/dicom/`, `data/`, `database/schemas/tenant.sql`, `scripts/` (~40 audit/regression/import helpers) | Terminology importers (`import-icd10-full.js`, `import-snomed-*`), `bootstrap-dhis2-metadata.mjs`, `seed-sample-imaging.js`. |

## 2. Architecture + FHIR storage (C-003 / C-030)

- **Model: modular monolith per service, multi-service deployment.** NestJS
  modules per bounded context inside `ehr-service`; Postgres per tenant via
  the provisioning service; Redis for queue/cache; MinIO (S3) for objects
  (imaging egress); LiveKit for WebRTC.
- **Canonical storage is relational, NOT FHIR-native.** 419 TypeORM
  `*.entity.ts` files under `services/ehr-service/src/entities/` are the
  system of record. FHIR is a **translation layer**: 19 mappers in
  `src/fhir/mappers/` convert entities to `fhir/r4`-typed resources, e.g.
  `PatientMapper.toFhir()` (`fhir/mappers/patient.mapper.ts:1-8`), which even
  papers over schema gaps inline (`state: city // Using city as state if
  province not available`, line ~43). Validation helpers exist
  (`fhir/validators/fhir-validator.service.ts`, `fhir/utils/operation-outcome.util.ts`).
- **R4 only in recon; R5 not found.** All mappers import `fhir/r4`. No R5
  dependency, R5 mapper, or version-negotiation code was located. The
  "R4/R5" wording is therefore already suspect — Sprint C §3.3.3 must rule.
- **FHIR endpoint surface (read-only listing):** `controllers/fhir.controller.ts`
  exposes `GET metadata`, `POST $batch`/`$transaction`, and CRUD for
  Patient, Observation, Encounter, MedicationRequest, Medication,
  MedicationDispense (+ further resources below line 535 — full route list is
  Sprint C's job). Inbound guarded by `guards/fhir-inbound-key.guard.ts`;
  `services/fhir-inbound.service.ts` + `services/fhir.service.ts` implement it.

## 3. Security / compliance inventory

| Control | Location | Recon note |
|---------|----------|------------|
| JWT auth | `guards/jwt-auth.guard.ts`, `strategies/jwt.strategy.ts`, `guards/patient-jwt-auth.guard.ts` | Separate patient guard; MFA: `guards/mfa.guard.ts` + spec |
| RBAC | `guards/roles.guard.ts` + spec, `guards/minimum-necessary.guard.ts`, `guards/health-educator.guard.ts` | Minimum-necessary interceptor also present |
| Inbound keys | `guards/fhir-inbound-key.guard.ts`, `guards/nhls-inbound-key.guard.ts` | Lab/registry ingestion auth |
| Audit | `services/hipaa-audit.service.ts`, `interceptors/hipaa-audit.interceptor.ts`, `interceptors/minimum-necessary.interceptor.ts`, `interceptors/idempotency.interceptor.ts` | Tamper-resistance/retention unverified — Sprint D |
| Consent | `services/consent-records.service.ts`, `consent-template.service.ts`, `digital-consent.service.ts`, `patient-consent.service.ts`, `services/telemedicine-consent.service.ts` + enforcement spec | Recording vs enforcement TBD — Sprint D |
| Breach/retention | `services/breach-detection.service.ts`, `services/retention.service.ts` | Workflow + DPO fields unverified |
| Passwords | `bcrypt` in tenant-service; `services/auth.service.ts`, `users.service.ts`, `patient-auth.service.ts` + spec | Policy/lockout/MFA enforcement untested |
| De-ID | `services/research-deidentification.service.ts` (`HIPAA_18_IDENTIFIERS`, key-drop, DOB→age-band, date-shift, salted pseudo-ID) | **Default-salt fallback** — see FINDINGS R-003 |
| Secrets hygiene | `.env` (184 vars) present locally, untracked status unchecked | gitleaks/semgrep/trivy unavailable offline — Sprint D must run |
| Supply chain | `npm audit --audit-level=high`: **162 vulns (7 low, 71 moderate, 76 high, 8 critical)**, incl. `zod<4.6.6` (high, memory-exhaustion) and nested `yaml` (moderate, stack overflow). Full tail in §5. | Remediation is out of scope (report-only); Sprint D owns SCA |

## 4. Integration inventory (claim → code)

| Domain | Location | Recon note |
|--------|----------|------------|
| DHIS2 | `services/dhis2.service.ts` (~176KB), `dhis2-scheduler.service.ts` + spec, `dhis2-validation.service.ts`, `cdss/dhis2_tracker.py`, `scripts/bootstrap-dhis2-metadata.mjs` | **Env-gated MOCK mode** (`DHIS2_USE_MOCK`, `useMock` fallback logging `[MOCK] Successfully synced N patients…`, `dhis2.service.ts:2973-2981`); `dhis2-real.service.ts.example` is a 5KB uncompiled sketch. Real-vs-mock wiring is Sprint C's first test. |
| WHO DAK | `services/who-smart-guidelines.service.ts` (636 lines) + controller (128) + **`services/ehr-service/who-smart-guidelines/` (67 git-tracked files, verified `git ls-files … \| wc -l` = 67)** | **CORRECTED 24 Nov:** content EXISTS — 11 `PlanDefinition-*` + 56 `Questionnaire-HIV.*` (WHO SMART HIV DAK: testing, PrEP/PEP, ART registration/care/follow-up, stems A–I). Runtime path resolves via Dockerfile `WORKDIR /app/services/ehr-service` + `path.join(process.cwd(),'who-smart-guidelines')` to that populated dir, so the "ships empty" branch (service:171-236) does not execute in docker deploys. Gaps for Sprint B: HIV-only (sole TB file is `Questionnaire-HIV.D4ScreenForTb` *inside* the HIV DAK; no ANC/TB/NCD/immunization/FP DAKs — verified by filename grep); no ValueSet/Library/CQL shipped; currency vs official WHO SMART HIV IG unverified. Note: `services/cdss-service/who-smart-guidelines/` is a different, genuinely empty dir (`.gitkeep`s) — Sprint B to determine which service consumes which. See FINDINGS R-004. |
| AI/LLM | cdss `diagnostic_assistant.py`, `*eval*/release_gate*`, `ai_governance.py`, `outbound_guard.py`, `privacy_guard.py`, `envelope_crypto.py`; ehr `ai-*.service.ts`, `ml-models.service.ts`, `model-registry.service.ts`, `ai-surface-contract.service.ts`, `governed.controller.ts` | Governance surface looks extensive on paper; provider/model/version/prompt/validation per feature is Sprint B's job. `regression-ai-*.mjs` scripts exist. |
| CDS rules | cdss `drug_interactions.py` (CYP450 + `CRITICAL_INTERACTIONS`, e.g. warfarin+aspirin major/9.5), `dosing_calculator.py`, `risk_scoring.py` (**"Simplified Framingham"** point sums — not a validated 30-day mortality model on its face), `duplicate_therapy.py`, `food_interactions.py`, `high_risk_medications.py`, `hiv_testing_algorithm.py` | The C-011/C-012/C-020 gold-set + oracle work belongs to Sprint B. |
| Terminology | `services/terminology*.service.ts` (+postgres +spec), `controllers/terminology.controller.ts`, `scripts/import-icd10-full.js`, `import-snomed-*` | SNOMED licensing/loading state unverified — Sprint C §3.3.5. |
| Telemedicine | `services/telemedicine*.service.ts` (video, postvisit-bridge), `controllers/telemedicine.controller.ts`, `mobile/src/services/telemedicine.ts`, `NativeCallStage.tsx`; infra `livekit/` + compose `livekit`/`egress`→MinIO | Self-hosted, not Daily.co. E2E-encryption/recording-consent/bandwidth behavior untested — Sprint D. Smoke script: `scripts/smoke-telemedicine-postvisit.mjs`. |
| Payments | `services/mobile-money.service.ts` (**M-Pesa Daraja, MTN MoMo, EcoCash, Airtel Money, Flutterwave** via axios; fire-and-forget `_dispatchToProvider` + callback), `payments.service.ts` + spec, `in-app-payment.service.ts`, `mobile-money/payment-gateway-config` entities, `mobile/src/services/payments.ts`, `screens/BillPaymentScreen.tsx` | Real-vs-sandbox, idempotency, ZiG handling untested — Sprint D. |
| Wearables | `controllers/wearable.controller.ts`, `services/wearable-sync.service.ts` (**exact C-061 string at :128**), `services/vitals.service.ts`, `iot.service.ts`, `constants/wearable-ranges.ts`, `mobile/src/screens/WearableScreen.tsx`, `entities/diabetes-device-integration.entity.ts` (`healthkit`/`google_fit` integration types), HealthKit entitlements + background-delivery in `mobile/app.json` | **CORRECTED 24 Nov (methodology fix):** `mobile/ios/`+`mobile/android/` are gitignored generated folders (`mobile/.gitignore:40-41`; `git check-ignore` confirms), so nothing about the native side is assertable from a fresh clone — marked UNVERIFIED with blocker (needs pod install/gradle or populated checkout). Reviewer grep of a populated checkout: zero native hits for HealthKitModule/GoogleFitModule outside `WearableScreen.tsx` → bridge calls an unimplemented module, guard always fires → STUB (reviewer-provided, Sprint D to confirm on-device). Separately CONFIRMED: patient device list is hard-coded canned data (`PatientHealthScreen.tsx:80-87,696-699`, no API backing). No BLE transport in tracked source; native BLE likewise unverifiable here. See FINDINGS R-006. |
| QR check-in | `services/checkin.service.ts`, `mobile/src/screens/CheckInScreen.tsx`, `QueueStatusScreen.tsx`; `qrcode` dep (tenant-service) | Encryption/expiry/replay not traced — Sprint D (S0 if cross-patient). |
| Queue | 48 files incl. `QueueStatusScreen.tsx` | Concurrency + privacy untested. |
| Pre-visit/notifications | `appointment-reminder-cron.service.ts`, `appointment-ai.service.ts`, `adherence-engine.service.ts`, `notifications.service.ts`, `at-messaging.service.ts` (Africa's Talking surface) | 48h timing + failure modes untested. |
| i18n | 8 locales × 3 surfaces: `en fr pt sw sn nd zu af` | Mobile: 312 en leaf keys vs 308 others (4 missing each; 1–10 identical-to-English). ehr-frontend: 84/84 (0 missing; 2–9 identical, mostly proper nouns by inspection — **not verified**). patient-portal: 14 top-level keys each (nested parity not diffed — Sprint D). Back-translation of 20 safety-critical strings is Sprint D §3.7.4. |
| DICOM/imaging | `controllers/dicom.controller.ts`, `services/imaging.service.ts`, entities `dicom-study`/`dicom-series`, `fhir/mappers/imaging-study.mapper.ts`, `services/radiology-ai.service.ts`; `sample-data/dicom/` seeds | Heatmap producer reality + viewer stack untested — Sprint B. |
| Research | `research-portal.service.ts`, `research-deidentification.service.ts`, `kaplan-meier.service.ts` + spec (KM + Greenwood + CI fields), `research.controller.ts:118-143` (VigiBase E2B export of `art_adverse_events`), `cohort-builder` services | E2B validity, KM numerics, cohort correctness, de-ID recall are Sprint E. |
| Migration/legacy | `terminology-import.service.ts`, `openmrs-fhir.service.ts` + spec, `src/interop/disa-smartcare.*` (SmartCare), scripts `import-*`, `regression-fhir-roundtrip-*.mjs`, `regression-duplicate-detection.mjs` | Messy-import + parallel-go-live reconciliation are Sprint C. No legacy-reconciliation tool located (C-043 at risk). |
| Offline | `src/lite/` (82-line service + controller + `offline-sync-queue.entity.ts`), `services/offline-sync.service.ts` (223 lines), `controllers/offline-sync.controller.ts`, idempotency interceptor + entity | Conflict policy + coverage untested — Sprint D §3.8. |
| External collab | 4 files match `external-collaborator|time-limited` | Token lifecycle untested — Sprint E. |
| Household | 39 files incl. `cbhi/entities/cbhi-household.entity.ts`, family-risk constants | Consent/disclosure model untraced — Sprint D (S0 candidates). |

## 5. Test inventory + executed results (verbatim)

Counts exclude `node_modules`, `dist`, `build`, `venv`/`.venv`, `__pycache__`.
Spec-file counts include colocated contract/integration specs.

| Area | `*.spec.ts` / `*.test.*` files | Runner |
|------|-------------------------------|--------|
| `services/ehr-service` | **187** `.spec.ts` | jest |
| `services/tenant-service` | **11** (10 suites ran — one file is a shared helper/config) | jest |
| `services/cdss-service` | ~30 `test_*.py` in `tests/` + loose `test_*.py` | pytest |
| `ehr-frontend` | 16 | CRA jest |
| `mobile` | 7 (+ `e2e/`) | jest / expo |
| `patient-portal` | 1 (`App.test.tsx`) | CRA jest |
| `web-app` | 2 | jest |
| `qa/`, `tests/` | 6 + e2e (Playwright, `npm run test:e2e`) | playwright |

### 5a. tenant-service suite — PASS (executed 2026-11-24, verbatim tail)

```text
> @umoya/tenant-service@1.0.0 test
> jest
PASS src/services/billing-enforcer.spec.ts (17.176 s)
PASS src/config/deployment-modes.spec.ts (17.75 s)
PASS src/payment/payment-gateway.spec.ts (17.959 s)
PASS src/services/baa-registry.service.spec.ts (19.552 s)
PASS src/services/database-provisioning.clinician-network.spec.ts (19.663 s)
[Nest] Seeded 6 default Clinician Network panels (idempotent).
PASS src/filters/error-envelope.spec.ts (19.663 s)
PASS src/controllers/rollout.controller.spec.ts (20.417 s)
PASS src/config/country-packs.spec.ts
PASS src/services/demo-access-request.spec.ts (21.159 s)
[Nest] ERROR [HealthMonitorService] Tenant No DB Clinic is unhealthy: No connection string configured
PASS src/services/health-monitor.service.spec.ts (21.7 s)
A worker process has failed to exit gracefully and has been force exited. ...
Test Suites: 10 passed, 10 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        22.914 s
```

### 5b. ehr-service suite — 36 suites / 32 tests FAIL (executed 2026-11-24, verbatim tail)

```text
FAIL services/cohort-builder.service.spec.ts
  ● CohortBuilderService › builds correct parameterised SQL for sex = M
    Expected substring: "p.sex = $1"
    Received string:    "... WHERE p.gender = $1 ..."
      at Object.<anonymous> (services/cohort-builder.service.spec.ts:18:17)
  ● CohortBuilderService › builds AND query for multiple criteria
    (same p.sex-vs-p.gender alias mismatch, spec:30)
Test Suites: 36 failed, 151 passed, 187 total
Tests:       32 failed, 1169 passed, 1201 total
Snapshots:   0 total
Time:        2333.554 s
Ran all test suites.
```

Notes (read-only observations, not fixes): the visible failure is a stale
expectation (`p.sex` vs implemented `p.gender` alias) — test-vs-code drift,
not a runtime bug per se. The full failed-suite list was NOT captured
(output was piped through `tail -60`); only the tail above is verbatim.
Re-running the 39-minute suite to enumerate all 36 is Sprint E's job
(§3.13 test-quality). **The suite is red on main at this commit** —
`git log` HEAD `1d797bef`. cdss pytest, frontend/mobile suites, lint, and
Snyk-style SCA were not executed this sprint (see §7 blockers).

### 5c. Type-check — PASS both services (executed 2026-11-24)

```text
npx --prefix services/tenant-service tsc --noEmit -p services/tenant-service/tsconfig.json
tsc_exit=0
npx --prefix services/ehr-service tsc --noEmit -p services/ehr-service/tsconfig.json
tsc_exit=0
```

### 5d. npm audit — 162 vulnerabilities (executed 2026-11-24, verbatim tail)

```text
Severity: moderate
yaml is vulnerable to Stack Overflow via deeply nested YAML collections - https://github.com/advisories/GHSA-48c2-rrv3-qjmp
fix available via `npm audit fix`
ehr-frontend/node_modules/yaml ... node_modules/yaml ... patient-portal/node_modules/yaml ... web-app/node_modules/yaml
zod  <4.6.6
Severity: high
Zod can exhaust memory while validating oversized constrained collections - https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
fix available via `npm audit fix --force`
Will install zod@4.6.7, which is a breaking change
node_modules/zod
162 vulnerabilities (7 low, 71 moderate, 76 high, 8 critical)
```

gitleaks / semgrep / trivy / codeql / bandit: **not installed** in this
environment — Sprint D must run the secrets + SAST sweep (§3.9.4).

## 6. Stub / mock / TODO census (source only; vendored + specs excluded)

Method: `grep -r --include=*.ts,*.tsx,*.py --exclude-dir={node_modules,dist,build,venv,.venv,__pycache__}`
over `services/*/src mobile/src ehr-frontend/src patient-portal/src web-app/src`.

| Marker | Hits | Assessment |
|--------|------|------------|
| `\bTODO\b` | **0** | No TODO markers in real source (earlier 6k+ counts were `venv/` + `node_modules` pollution — corrected). |
| `\b(FIXME\|XXX\|HACK)\b` | 0 in real source (same pollution note) | — |
| `NotImplementedError` | 0 in real source | — |
| `\b(mock\|stub\|placeholder\|lorem\|hardcoded)\b` case-insensitive, excl. `*.spec.ts` | 28 files (ehr-service src) | Mostly `mock-*` **files that ship in src**: `mock-ehr.module.ts`, `mock-main.ts`, `mock-auth.controller/service`, `mock-patient.*`, `mock-appointment.*`, `mock-auth*` in controllers — see FINDINGS R-005. Also `population-health.controller.ts`, `offline-sync.controller.ts`, `telemedicine-video.service.ts`, `bcma.service.ts` matched (context unchecked — Sprint D/B to confirm none serve canned clinical data). |
| `sample\|fake\|dummy` | 10 files (lab-order, vitals, hiv-quality-metrics, reports, model-registry, …) | Context unchecked; flagged for Sprint B/E to confirm no sample data in clinical paths. |

## 7. What could / could not be run + environment blockers

- RAN: tenant-service jest (pass), ehr-service jest (red — 36 suites), `tsc --noEmit` ×2 (pass), `npm audit` (162 vulns), full grep/file census, locale parity diff, docker image inventory.
- NOT RUN: stack boot (`docker compose up`), seed run, endpoint calls, cdss pytest, frontend/mobile tests, lint, Playwright e2e, DHIS2/FHIR-validator runs, any LLM-keyed flow (no keys provisioned), SAST/secrets scanners (not installed).
- BLOCKERS: none for recon; for later sprints — (1) `.env` holds 184 vars incl. third-party keys; reviewers must confirm sandbox/test keys before Sprint D payment/SMS/AI tests. (2) ~~No DAK content anywhere~~ **CORRECTED: 67 HIV DAK artifacts ship at `services/ehr-service/who-smart-guidelines/`** — Sprint B's starting question is HIV-DAK currency/completeness + confirming non-HIV DAK absence (not sourcing content externally, though official WHO IG copies are still needed as oracles). (3) ehr-service suite is red at HEAD; domain sprints must re-baseline before attributing failures.
- **Self-caught recon errors (method notes). Round 1:** R-004 claimed "ships empty" from reading the constructor's empty-dir branch without resolving the runtime path or running `git ls-files` — corrected after review (67 HIV DAK files; runtime path confirmed twice: Dockerfile WORKDIR + compose mount `docker-compose.yml:493` mapping `./services/ehr-service/who-smart-guidelines:/app/services/ehr-service/who-smart-guidelines`). **Round 2 (same class, opposite direction):** R-006 asserted native-module absence from a fresh clone without checking `.gitignore` — `mobile/ios/`+`mobile/android/` are generated/ignored, so that absence was environmental. Worse, the same narrow-grep habit that caused round 1 then caused a **missed-training-module** error in C-042 (`training.controller.ts`: courses/MCQ/enrolments/certificates exists; pattern `training-module|…` never matched the filename) — caught only by broadening to stem grep + docs cross-check (`docs/ARCHITECTURE.md:54,147`). Standing rule adopted for Sprints B–E: absence requires (1) resolved runtime path, (2) `git ls-files` + `git check-ignore` scoping, (3) broad-stem grep, (4) docs cross-check. Narrow-pattern "zero hits" alone is never absence evidence.
- **Second-pass ledger sweep (24 Nov):** every "absent/empty" assertion re-scoped. Re-confirmed (tracked-source evidence, safe): R4-only (`fhirVersion 4.0.1`, `@types/fhir`), no SMART well-known (src + infra + compose greps), no legacy-reconciliation tooling (src + scripts greps), no ValueSet/CQL tracked anywhere, HIV-only DAK dir. Corrected: C-042 (training EXISTS, role-basis unverified), C-059/C-060 (bridges exist in JS; native side unverifiable here), C-032/C-043 (wording hardened with re-verification trails). Reference find: untracked `who-smart-guidelines-repos/smart-hiv/` (full WHO IG clone with `input/`, per its README also intended for smart-immunizations — dir absent) is Sprint B oracle material, NOT product content.
- No real patient data touched; no source files edited; no DDL run (nothing needed it).
