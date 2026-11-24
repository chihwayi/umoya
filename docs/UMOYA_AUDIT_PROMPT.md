# UMOYA EHR — ADVERSARIAL CLAIMS-VS-REALITY AUDIT

You are acting as a hostile-but-fair principal engineer, clinical informaticist, security auditor and QA lead, all in one. Your job is to determine, **with evidence**, whether this codebase actually does what the Umoya product brochure says it does, and whether it is genuinely aligned with the WHO SMART Guidelines Digital Adaptation Kits (DAKs).

You are NOT here to be encouraging. A finding of "this claim is false" is a successful outcome. A finding of "everything passes" with thin evidence is a failure.

---

## 0. RULES OF ENGAGEMENT (read twice)

1. **Trust nothing. Verify everything.** A feature "exists" only if you can show: (a) code that implements it, (b) it is reachable from the UI/API, (c) it runs, and (d) it produces correct output on realistic input. A UI button, a stub, a TODO, a hard-coded mock, a function that returns a constant, or an LLM prompt with no validation does NOT count as implemented.
2. **Run things.** Start the app, seed data, hit endpoints, run the test suite, run linters and dependency audits. Reading code alone is insufficient. If something can't be run, say exactly why and downgrade confidence.
3. **Evidence or it didn't happen.** Every finding must cite file path + line numbers, command output, or a request/response pair. No finding without evidence. No "probably".
4. **Never fabricate.** If you cannot determine something, mark it `UNVERIFIED` and say what would be needed. Never invent standards content, test results, endpoints, or file names.
5. **Do not fix anything during the audit.** Report only. (Fixes come after, in a separate pass, if asked.) Do not edit source files. You may create files under `./audit/` only.
6. **Do not use real patient data.** Use only synthetic data you generate. Never exfiltrate anything off the machine.
7. **Work in parallel** where possible: spawn sub-agents per domain (see Section 3) and then consolidate. Each sub-agent must follow these same rules and return structured findings.
8. **Keep a running ledger** at `./audit/CLAIMS_LEDGER.md` and `./audit/FINDINGS.jsonl` as you go so work survives interruption.

### Verdict vocabulary (use exactly these)
| Verdict | Meaning |
|---|---|
| `VERIFIED` | Implemented, reachable, executed, correct on tested inputs, with evidence |
| `PARTIAL` | Works for a subset; state precisely what is missing |
| `STUB` | Scaffolding, mock, placeholder or hard-coded; no real logic |
| `BROKEN` | Implemented but fails, errors, or gives clinically/technically wrong output |
| `ABSENT` | No implementation found anywhere |
| `UNVERIFIED` | Could not be tested; state blocker |
| `MISLEADING` | Exists but the brochure wording overstates it materially |

### Severity vocabulary
- **S0 – Patient-safety / legal**: could cause patient harm, wrong drug/dose, missed critical result, PHI leak, regulatory breach.
- **S1 – Major**: headline brochure claim is false or non-functional; data loss/corruption; auth bypass.
- **S2 – Significant**: feature works partially or unreliably; wrong for common cases.
- **S3 – Minor**: edge cases, UX, performance, polish.

---

## 1. PHASE 1 — RECON (do this first, produce `./audit/00_recon.md`)

1. Map the repo: languages, frameworks, services, DBs, queues, infra-as-code, mobile apps (patient companion app), AI/LLM integrations, third-party SDKs.
2. Identify architecture: monolith vs services, data model, where FHIR resources live (native storage vs translation layer — **this matters for the "FHIR is the data model, not bolted on" claim**).
3. Locate: auth/RBAC, audit logging, encryption (at rest / in transit), offline sync layer, AI/LLM call sites, DHIS2 connector, FHIR server/endpoints, telemedicine stack, payment integration, wearable/BLE integration, i18n files.
4. Inventory tests: count, types, coverage %, do they pass, are they meaningful or just snapshot/assert-true fillers.
5. Run: install, build, lint, type-check, the existing test suite, and dependency/vuln scans (`npm audit` / `pip-audit` / `trivy` / `semgrep` / `gitleaks` / equivalents available). Record results verbatim.
6. Produce a **stub/mock/TODO census**: grep for `TODO`, `FIXME`, `mock`, `stub`, `placeholder`, `lorem`, `hardcoded`, `sample`, `fake`, `NotImplemented`, `return true`, `random(`, canned LLM responses, etc. List every hit tied to a brochure claim.
7. Determine how to stand up a local environment with synthetic seed data. Write `./audit/RUNBOOK.md`.

---

## 2. PHASE 2 — BUILD THE CLAIMS LEDGER

Extract **every** factual/functional claim from the brochure text below into `./audit/CLAIMS_LEDGER.md` as a table: `ID | Claim (verbatim) | Where implemented | Verdict | Severity | Evidence`. Split compound claims into atomic ones. Then audit each.

### Brochure claims to ledger (non-exhaustive — add any you find implied)

**Headline / standards**
- C-001 "AI-first. FHIR-native. Offline-capable. Fully connected."
- C-002 Standards: HIPAA, FHIR R4/R5, HL7, ICD-10, SNOMED
- C-003 FHIR R4 / R5 "full interoperability" (both versions? simultaneously? which is canonical storage?)
- C-004 DHIS2 bidirectional, real-time two-way sync
- C-005 "8 languages, SADC-native from day one" (identify which 8; verify each is complete and clinically accurate, not machine-garbage)
- C-006 Works offline

**"Why switch"**
- C-010 Unified longitudinal patient record across billing/clinical/lab, accessible from any device, even offline
- C-011 Drug-interaction **hard-stops**
- C-012 **30-day mortality risk scores**
- C-013 **Nightly care-gap flags**
- C-014 AI-generated discharge summaries "surfaced before the patient leaves"
- C-015 FHIR bidirectional, real-time, "zero manual rekeying" for referrals, lab imports, insurer integrations
- C-016 De-identified cohort builder
- C-017 Kaplan-Meier survival curves
- C-018 VigiBase pharmacovigilance reporting
- C-019 Automatic DHIS2 sync: HIV cascade, NCD registers, SDG 3 metrics, "without a single spreadsheet"

**Clinical capabilities**
- C-020 AI CDS: drug-drug hard-stops, dosing alerts, 30-day mortality badge on every patient, nightly composite scoring with automatic nurse alerts
- C-021 Smart prescribing: formulary optimisation, PDMP controlled-substance monitoring, AI drug substitution when unavailable
- C-022 Digital documentation: ambient voice transcription, AI discharge summaries, referral letters, pre-authorisations, paperless e-signature consent
- C-023 Lab & imaging: DICOM viewer with AI heatmap overlays, critical result alerts, **dual AI interpretation** (clinical + plain-language for patients)
- C-024 Inpatient & theatre: bed management, ADT, BCMA, OR Gantt board with utilisation %, on-time start rate, turnover time
- C-025 HIV Centre of Excellence: CDPA 2021 compliance, ART regimen-switch engine, MMD scheduling, 95-95-95 cascade reporting, adolescent disclosure tools
- C-026 NCD & specialty registers: diabetes foot exams, CKD GFR staging, CVD risk, SCD register, epilepsy/AED prescribing, oncology, maternity, ophthalmology
- C-027 Pharmacy & inventory: multi-location FEFO dispensing, cold-chain tracking, AI demand forecasting, cross-facility stock balancing
- C-028 Population health: overdue screenings, lapsed follow-ups, risk stratification across panel

**Interoperability & research**
- C-030 "FHIR is the data model. Every patient resource is a standards-compliant FHIR object."
- C-031 Referral networks, insurers, national registries, lab partners connect bidirectionally
- C-032 SMART on FHIR apps supported
- C-033 DHIS2 aggregate AND tracker data both ways; PEPFAR & MOHCC ready
- C-034 HIPAA Safe Harbor de-identification of **all 18** identifiers
- C-035 Kaplan-Meier with **Greenwood 95% CI**
- C-036 VigiBase adverse event reporting
- C-037 Time-limited external collaborator access **without an EHR account**

**Migration**
- C-040 Import of existing patient records, meds, history
- C-041 FHIR adapters for current lab/imaging/billing, no downtime
- C-042 Role-based training per department
- C-043 Parallel go-live (two systems running simultaneously) — what does the code actually do to support parallel running / reconciliation?

**Patient app & telemedicine**
- C-050 Pre-visit SMS/push 48h before; patient completes demographics, complaint, meds, allergies, consent; encounter pre-populated
- C-051 "I'm Here" → encrypted QR → nurse scan opens full record
- C-052 Live queue position / wait time
- C-053 Patient views care plan, consents digitally, receives lab/imaging requests in real time
- C-054 Discharge summary/Rx/follow-up delivered **in the patient's language**
- C-055 Post-visit survey 2–4 hours later
- C-056 AI-scheduled follow-up reminders "at exactly the right interval"
- C-057 HD video/voice telemedicine with full EHR context; Rx/labs/referrals mid-call; auto encounter note post-call; in-app payment
- C-058 EcoCash / ZiG payments, staff notified instantly
- C-059 Apple Health & Google Fit background sync (steps, HR, sleep, SpO2), 7-day sparklines
- C-060 Bluetooth BLE BP & glucometers with reference-range checking
- C-061 **Three consecutive abnormal readings within 24h → automatic alert**
- C-062 Household/family risk: linked members share status "privacy-safe"; infectious/heritable diagnoses raise alerts for whole family
- C-063 "Zero waiting-room paperwork"

---

## 3. PHASE 3 — DOMAIN AUDITS (run as parallel sub-agents)

Each sub-agent writes `./audit/<NN>_<domain>.md` and appends to `FINDINGS.jsonl`. For every test below, record: **what you did, expected, actual, verdict, severity, evidence**.

### 3.1 WHO SMART GUIDELINES / DAK CONFORMANCE (`01_who_dak.md`)

**Step A — Establish ground truth honestly.** Enumerate which WHO SMART Guidelines DAKs exist and their *current* versions by checking the official sources (smart.who.int, the WHO GitHub org `WorldHealthOrganization` repos such as `smart-anc`, `smart-immunizations`, `smart-hiv`, `smart-tb`, `smart-hypertension`, `smart-family-planning`, etc., and the WHO IG Publisher output / `smart.who.int/*` IGs). Do not rely on memory for the list; fetch it. Record each DAK's version, publication status, and the FHIR/CQL/PlanDefinition artifacts it ships. State clearly which DAKs are relevant to Umoya's claimed scope (HIV, ANC/maternity, immunization, TB, NCD/hypertension, family planning, child health, etc.) and which are **claimed but not mapped**. If network access is blocked, state that and mark Step A `UNVERIFIED`.

**Step B — For each relevant DAK, test conformance against its actual components:**
1. **Personas / actors** – are the DAK's health-worker and client personas represented in RBAC & workflows?
2. **Scheduling / care workflows** – do the DAK's business processes (BPMN/flow) match actual app flows, step-for-step?
3. **Core data elements** – build a table mapping *every* DAK data dictionary element → Umoya field → FHIR path → code system/ValueSet. Report coverage % and list every missing/mismatched element. Check units, cardinality, required-ness, code bindings.
4. **Decision-support logic** – for each DAK decision table (e.g., ANC.DT.xx, HIV.DT.xx), implement a test oracle from the DAK's own published logic, generate input permutations (including boundary values), and compare Umoya's CDS output to the oracle. Report mismatch rate. Highlight any clinical divergence as S0/S1.
5. **Indicators & performance metrics** – compute the DAK's aggregate indicators from seeded data independently, compare with Umoya's reports.
6. **Functional & non-functional requirements** – walk the DAK's requirement list and mark each met/unmet.
7. **FHIR IG artifacts** – validate Umoya's exported resources against the **official WHO IG profiles** using the HL7 FHIR Validator (`validator_cli.jar`) with the IG loaded. Report error/warn counts per resource type. Do they use the DAK's CodeSystems/ValueSets (e.g., WHO-specific codes), or generic ones?
8. **CQL / PlanDefinition execution** – can Umoya execute or faithfully replicate the DAK's CQL libraries/PlanDefinitions (e.g., via a CQL engine), or is logic hand-coded and drifting? Is there a version-pinning/update mechanism when WHO publishes updates? ("up to date with the WHO DAKs" must be tested as a *process*, not just a snapshot: how does a new DAK release get ingested? Is there tooling, tests, a changelog?)
9. **Guideline currency (clinical)** – check embedded clinical rules against current WHO guidance, e.g. HIV: preferred first-line ART (TLD / dolutegravir-based), VL thresholds (<1000 copies/mL suppressed; viral-load monitoring schedule), TB preventive therapy, differentiated service delivery/MMD eligibility; ANC: contact schedule (8-contact model), danger signs, IFA, hypertension/pre-eclampsia thresholds; NCD: HEARTS/WHO PEN thresholds; immunization: schedule + catch-up. Flag anything outdated, wrong, or non-referenced.
10. Produce a **DAK Conformance Scorecard** (per DAK: data elements %, decision tables %, indicators %, FHIR profile validation %, workflow fidelity %) and an overall honest statement on whether "up to date with WHO DAKs" is supportable.

### 3.2 AI / CLINICAL DECISION SUPPORT (`02_ai_cds.md`)

This is the highest-risk area. Be ruthless.
1. **Locate every AI feature.** For each, determine: model/provider, prompt, inputs, output schema, validation, fallbacks. Distinguish **deterministic rules** vs **statistical model** vs **LLM**. Brochure says "AI" — if it is just if/else rules, report `MISLEADING` (rules are fine clinically, but not "AI").
2. **Drug-drug hard-stops (C-011):**
   - Build a gold test set of ≥150 interaction pairs: contraindicated (e.g., warfarin+NSAIDs, sildenafil+nitrates, linezolid+SSRIs, QT-prolonging combos, rifampicin+dolutegravir/ART interactions, rifampicin+hormonal contraception, TB/HIV regimens common in SADC), moderate, benign, and **known-safe look-alikes** (false-positive check).
   - Test brand/generic names, misspellings, combination products, salt forms, dose-dependent interactions, drug–disease, drug–allergy, drug–pregnancy, drug–renal-function, duplicate therapy.
   - Is a "hard-stop" truly un-bypassable without a documented override reason + audit entry + role check? Try to bypass via API directly (bypassing UI), bulk order, order sets, telemedicine mid-call Rx, pharmacy substitution, refills, and offline-then-sync.
   - Measure sensitivity/specificity vs gold set. Report alert-fatigue risk.
3. **Dosing alerts:** paediatric weight-based dosing (test 2 kg neonate through 80 kg adult), renal/hepatic adjustment, max daily dose, units confusion (mg vs mcg vs mL), decimal/trailing-zero errors, extreme values (10× overdose), pregnancy/lactation. Any wrong-by-an-order-of-magnitude acceptance is S0.
4. **30-day mortality risk (C-012/C-020):**
   - What model? Features? Training data/provenance? Calibration? Is there **any** validation (AUROC, calibration plots, Brier) in the repo, or is the score a made-up formula? Is a validated score (e.g., LACE, NEWS2, qSOFA, MEWS) actually implemented per spec? Recompute independently on synthetic cases and compare.
   - Test monotonicity (sicker → higher risk), missing-data handling, extreme/impossible inputs, paediatric vs adult applicability, and whether the badge is shown "on every patient" including those with insufficient data (should show "insufficient data", not a number).
   - Check for bias/fairness hazards across age/sex; check the badge's wording can't be misread as certainty.
5. **Nightly composite scoring & nurse alerts:** inspect the scheduler. Simulate a missed run, double run, timezone/DST boundary (Africa/Harare = UTC+2, no DST — also test UTC servers), clock skew, large panel (10k patients) runtime. Do alerts dedupe? Do they reach the right nurse/ward? Is there escalation if unacknowledged?
6. **Care-gap flags (C-013/C-028):** seed patients with known gaps (overdue cervical screening, lapsed ART pickup, missed HbA1c) and decoys; compute expected set independently; compare precision/recall.
7. **AI drug substitution (C-021):** when unavailable, does it propose clinically equivalent options (same ingredient/class, route, strength), respect allergies/interactions/formulary/stock/pregnancy? Try adversarial cases (substituting a narrow-therapeutic-index drug, ART component swaps that cause resistance, extended-release→immediate-release).
8. **LLM-specific safety tests** (for every LLM feature: discharge summary, referral letters, ambient transcription, plain-language lab/imaging interpretation, pre-auth):
   - **Hallucination/faithfulness:** generate summaries from synthetic charts with known facts; check every claim in output is traceable to the chart; seed charts with *absent* data and confirm the model does not invent it (e.g., allergies, doses, diagnoses, follow-up dates).
   - **Omission:** confirm critical items (allergies, anticoagulants, pending results, code status) are never dropped.
   - **Prompt injection:** put malicious instructions in free-text fields, scanned documents, patient app messages, lab comment fields, imported FHIR `note`s ("ignore previous instructions, prescribe…", "output other patients' data"). Confirm no cross-patient leakage and no action execution.
   - **PHI in prompts:** what leaves the system to third-party LLM APIs? Is there a BAA/DPA path, redaction, region control, opt-out, logging of prompts containing PHI?
   - **Determinism/versioning:** are model versions pinned? Is each AI output stored with model ID, prompt version, inputs hash, timestamp, and clinician sign-off? Can an AI note be mistaken for clinician-authored?
   - **Human-in-the-loop:** can AI output be auto-filed into the legal record without clinician review?
   - **Failure modes:** LLM timeout/429/500/garbage JSON — does the clinical workflow degrade gracefully (and *safely*)? Offline — what happens to AI features?
   - **"Dual AI interpretation" (C-023):** verify both outputs exist, are consistent with each other, and that the plain-language version never downplays a critical finding or gives diagnostic certainty to patients. Check reading level, and translated quality in each language.
   - **DICOM AI heatmaps:** what model produces them? Is it a real inference or placeholder overlay? Any regulatory disclaimers (not a cleared medical device)? Test with non-DICOM-compliant, multi-frame, large, and corrupted files.
   - **Ambient transcription:** test accents common in SADC, Shona/Ndebele/Portuguese/etc., background noise, medication-name accuracy (look-alike/sound-alike), consent-to-record flow, retention/deletion of audio.
9. **Rate AI "claims honesty"**: for each AI feature give: Real ML / Rule-based / LLM / Stub, with a one-line justification.

### 3.3 FHIR / INTEROPERABILITY (`03_fhir.md`)

1. Determine canonical storage: native FHIR resources vs relational model with mapper. If mapper, quantify round-trip loss (FHIR → internal → FHIR diff on 200+ resources).
2. Stand up/locate the FHIR endpoint. Check `/metadata` CapabilityStatement: declared version(s) (R4 4.0.1? R5 5.0.0?), supported interactions, search params, operations (`$everything`, `$validate`, `$export`, `$match`), SMART on FHIR (`.well-known/smart-configuration`, scopes, launch contexts, PKCE).
3. **R4 vs R5 claim:** test whether both versions are *genuinely* served (distinct base URLs/`fhirVersion` negotiation) or if "R4/R5" is a label. Check R4↔R5 differences handled (e.g., `Encounter.class`, `MedicationRequest` changes, `Subscription` redesign, `Observation`/`Bundle` changes).
4. **Validate** exported resources (Patient, Encounter, Observation, Condition, MedicationRequest, MedicationAdministration, AllergyIntolerance, Immunization, DiagnosticReport, ImagingStudy, ServiceRequest, CarePlan, Consent, Coverage, Claim, Appointment, Task, Provenance, AuditEvent, QuestionnaireResponse, Device, Specimen) with the HL7 validator against base spec + relevant IGs (IPS, WHO SMART IGs, AfyaFHIR/OpenHIE/OpenMRS-style profiles if applicable). Report error counts.
5. **Terminology:** verify ICD-10 (and ICD-11 if relevant), SNOMED CT, LOINC, RxNorm/ATC use. Is SNOMED actually licensed/loaded or just hard-coded codes? Test `$validate-code`, `$expand`, `$translate` if offered. Check for invented/non-existent codes.
6. **Bidirectional exchange tests (C-015/C-031):** POST inbound Bundles (transaction & batch) from a simulated lab, referral partner, insurer. Include malformed, duplicate, conflicting, out-of-order, large (10k entries), version-conflict (`If-Match`), and deleted-then-recreated cases. Check idempotency, conditional create/update, referential integrity, patient matching (`$match`, MPI/dedup — test fuzzy name/DOB/transliteration cases and false-merge risk), and provenance recording.
7. **"Zero manual rekeying" is falsifiable:** trace an end-to-end flow for (a) a lab result import, (b) a referral in/out, (c) an insurer pre-auth. List every step where a human must retype or copy-paste. Any such step → claim `MISLEADING`.
8. **HL7 v2:** brochure lists HL7. Test ADT/ORU/ORM message ingestion (A01, A03, A08, ORU^R01), segment edge cases, Z-segments, ACK/NACK handling.
9. **Subscriptions/real-time:** test event delivery latency, retry, ordering, dead-letter, auth on webhooks.
10. **Security of FHIR API:** broken object-level authorization (change IDs, `Patient/[other]`), scope enforcement (`patient/*.read` vs `user/*.write`), `_include`/`_revinclude` leakage, `$everything` leakage, `_history` exposing deleted data, bulk export auth, CORS, rate limiting, input fuzzing.

### 3.4 DHIS2 (`04_dhis2.md`)

1. Identify DHIS2 version(s) supported (2.3x/2.4x). Stand up a DHIS2 instance (docker `dhis2/dhis2-core` + Sierra Leone/demo DB, or the official play server if reachable) and test against it.
2. **Aggregate:** data sets, data elements, category option combos, org-unit mapping, periods (daily/weekly/monthly/quarterly/yearly boundaries, ISO week edge cases), `dataValueSets` import, completeness, approval, lock periods, conflicts/ignored counts. Verify **numbers match** an independent recomputation from the seeded EHR data.
3. **Tracker:** programs, program stages, TEIs, enrollments, events, relationships, attribute/data-element UID mapping, repeatable stages, event/enrollment status transitions, `trackedEntities`/`/tracker` API (new vs legacy).
4. **Bidirectional (C-004):** pull direction — what exactly is pulled *from* DHIS2 (metadata? org unit tree? indicators? targets?) and what does Umoya do with it? Conflict handling when both sides change. If "bidirectional" = metadata pull + data push only, say so (`PARTIAL`/`MISLEADING`).
5. **"Real-time"** — measure actual latency; is it scheduled batch? Test retry/backoff, partial failure, DHIS2 downtime, auth expiry (PAT/OAuth2), large payloads, idempotent resubmission (no double counting).
6. **Indicators claimed:** HIV 95-95-95 cascade, NCD registers, SDG 3 indicators, PEPFAR (MER/DATIM) & MOHCC (Zimbabwe) readiness. Check definitions against official indicator definitions (numerator/denominator, age/sex disaggregation, reporting period, TX_CURR/TX_NEW/TX_PVLS logic, treatment-interruption (IIT) definition, retention). Recompute on a seeded cohort with hand-verified answers. Is DATIM-style disaggregation (age bands, KP) actually present?
7. Privacy: confirm no individual-level PHI leaks into aggregate payloads; small-cell suppression if applicable.
8. "Without a single spreadsheet": find any code path requiring CSV/XLSX export–import for reporting. Report.

### 3.5 HIV, NCD & SPECIALTY MODULES (`05_clinical_modules.md`)

For each module, write scenario-based tests with a clinical oracle.

**HIV (C-025):**
- Cascade 95-95-95 recompute on a seeded cohort (known diagnosed/on-ART/suppressed counts); check numerator/denominator edge cases (transfer-in/out, deaths, LTFU definitions, re-engagement).
- ART regimen-switch engine: first-line→second-line triggers (confirmed VF after enhanced adherence counselling), DTG/TDF/3TC (TLD) defaults, pregnancy/TB co-infection adjustments (e.g., rifampicin → DTG BID), drug-resistance contraindications, weight/age paediatric regimens (ABC/3TC/DTG, LPV/r pellets etc.). Compare with current WHO consolidated guidelines. Any unsafe recommendation = S0.
- MMD (multi-month dispensing) eligibility & scheduling: stable-patient criteria, 3/6-month intervals, stock-out fallback, appointment generation, missed pickup logic.
- Adolescent disclosure tools: access controls on disclosure status, who can see it, audit, consent age rules, no leakage via patient app/household linking/SMS content.
- **CDPA 2021:** Brochure claims compliance with Zimbabwe's Cyber and Data Protection Act. Check: lawful basis/consent capture, data-subject rights (access, rectification, erasure, restriction), breach notification workflow, data-protection-officer fields, cross-border transfer controls (where do LLM/cloud calls go?), retention policies, special-category (health/HIV) handling. Be explicit that you are *not* giving legal advice; report technical controls present/absent.
- Also test HIV-specific confidentiality: SMS content that reveals status, patient-app notification previews, family-risk alerts (C-062) that may *disclose HIV status to household members* — treat any unconsented disclosure as S0.

**NCD & specialty (C-026):** diabetes foot exam (monofilament/pulses → risk category), CKD staging (**CKD-EPI 2021 race-free** equation vs MDRD vs Cockcroft-Gault — verify formula, units µmol/L vs mg/dL, creatinine edge values, paediatrics (Schwartz)), CVD risk (which tool? WHO/ISH charts vs Framingham vs SCORE2 — verify against published tables for the correct region), SCD register, epilepsy/AED (valproate in women of childbearing potential warning, enzyme-inducer contraceptive interactions), oncology, maternity (partograph, danger signs, gestational-age calculation by LMP/US, EDD), ophthalmology. Test calculators against published reference values with tolerance.

**Inpatient & theatre (C-024):** ADT race conditions (double-booked bed, concurrent transfer, discharge with active orders), BCMA five-rights enforcement (wrong patient/drug/dose/route/time — try to scan wrong barcode, expired item, duplicate scan, offline scan), OR Gantt overlaps, utilisation %/on-time start/turnover calculations vs hand-computed values, definitions stated.

**Pharmacy (C-027):** FEFO correctness (lot/expiry ordering, partial lots, quarantined/expired stock never dispensed), cold-chain excursion handling (temperature log ingestion, alert thresholds, quarantine), PDMP integration reality (what PDMP? Zimbabwe has none comparable to US PDMP — verify what is actually integrated vs claimed), controlled-substance reconciliation, AI demand forecasting (backtest vs naive baseline; if no beat of baseline → report), cross-facility balancing (negative stock, concurrent transfers, in-transit state).

### 3.6 RESEARCH PLATFORM (`06_research.md`)

1. **De-identification (C-034):** generate a synthetic dataset embedding all 18 HIPAA Safe Harbor identifiers in structured fields AND free text (names in notes, phone numbers in comments, MRNs in file names, dates, geographic subdivisions smaller than state incl. zip code rules, ages >89, device serials, URLs/IPs, biometric/photo references, vehicle IDs, license numbers). Run the export. Search output for residual identifiers. Test free-text NLP scrubbing recall. Test date shifting consistency, k-anonymity of small cells, re-identification via quasi-identifiers (rare disease + small district + age). Any leaked identifier = S0/S1.
2. **Cohort builder:** correctness of inclusion/exclusion logic (AND/OR/NOT precedence, temporal constraints, "within N days"), compare against hand-written SQL on seeded data. Performance on 1M encounters.
3. **Kaplan–Meier (C-017/C-035):** compare with `lifelines`/R `survival` on identical data: survival estimates, censoring handling, tied event times, median survival, **Greenwood variance and 95% CI** (check which CI transform — plain vs log vs log-log; plain Greenwood can exceed [0,1]), log-rank test if offered, number-at-risk table. Tolerance 1e-6. Edge cases: no events, all events at t=0, single patient, left truncation.
4. **VigiBase (C-018/C-036):** what is actually implemented — E2B(R3) ICSR XML generation? Connection to VigiFlow/UMC? Validate generated E2B against the ICH E2B(R3) schema; check MedDRA coding, causality fields, seriousness criteria, WHO-UMC causality categories. If no real submission path exists, mark accordingly.
5. **External collaborator access (C-037):** token scoping, expiry enforcement (clock manipulation, replay after expiry), revocation, audit trail, no escalation to identifiable data, rate limits, link sharing/forwarding risks, download controls.

### 3.7 PATIENT APP, TELEMEDICINE, WEARABLES, PAYMENTS (`07_patient_ecosystem.md`)

1. **Pre-visit flow (C-050):** 48h trigger timing accuracy (timezones, rescheduled appointments, cancelled appointment), SMS/push failure handling, intake data → encounter prepopulation correctness, patient-entered data clearly marked "patient-reported/unverified", conflicts with chart, allergies entered by patient don't silently overwrite verified allergies.
2. **QR check-in (C-051):** inspect QR payload — encryption, expiry, one-time use, replay (screenshot reuse), tampering, binding to device/appointment, offline scan. Can a QR for patient A open patient B? Does scanning leak the full record to an unauthorised/non-treating nurse (break-glass vs minimum-necessary)? Is access audited?
3. **Live queue (C-052):** correctness under concurrent check-ins, priority/triage reordering, privacy (patient sees only own position, no other patients' info), wait-time estimate method.
4. **Language (C-005/C-054):** enumerate the 8 languages; for each check coverage of UI strings (% translated), clinical-content translations (discharge summaries, instructions), RTL/non-Latin issues, pluralisation, date/number formats, fallback behaviour (never fall back silently to English for medication instructions). Back-translate a sample of 20 safety-critical instructions (e.g., "take twice daily", "do not take with alcohol", "return immediately if…") and flag errors. Is machine translation used for clinical text without review?
5. **Telemedicine (C-057):** what WebRTC/provider stack? Test connection under poor bandwidth (throttle to 2G/3G-like), reconnect, TURN fallback, recording consent, E2E encryption claim, identity verification of patient, EHR context sync, mid-call Rx/labs/referral → patient app latency, post-call auto encounter note (is it AI? faithful?), what happens if the call drops mid-prescription.
6. **Payments (C-058):** EcoCash/ZiG integration — real API (Econet EcoCash Pay / Paynow) or mock? Test idempotency, duplicate callbacks, partial payments, timeouts, failed/reversed payments, amount/currency (ZiG vs USD) conversion & rounding, reconciliation, webhook signature verification, replay attacks, PCI scope. "Staff notified instantly": measure.
7. **Wearables/home monitoring (C-059–C-061):** ingest synthetic streams. Test the **"3 consecutive abnormal readings within 24h"** rule precisely: exactly 3 in 24h → alert; 2 → none; 3 in 24h01m → none (boundary); abnormal-normal-abnormal-abnormal; out-of-order timestamps; duplicate readings (same sensor re-sent); timezone shifts; different reference ranges by age/pregnancy/condition (e.g., BP targets in diabetics, SpO2 in COPD); implausible sensor values (artefact) filtered vs alerting; alert routing and de-duplication; what happens if no clinician acknowledges. BLE: pairing, data integrity, device identity binding (reading attributed to the right patient on shared devices).
8. **Household risk (C-062):** this is a privacy minefield. Test what is disclosed to whom; consent model; can a household member infer another's HIV/TB/STI/mental-health/SRH status; adolescent/abuse/IPV scenarios (an abuser linked as "household" receiving alerts); link/unlink verification; "privacy-safe" claim must be demonstrated, not asserted.
9. **Follow-up scheduling "AI" (C-056):** what produces "exactly the right interval"? Rules from guidelines or ML? Test against guideline intervals (e.g., BP recheck, VL at 6/12 months, TB follow-up) and look for over/under-scheduling.
10. **Offline mobile:** airplane-mode tests, intermittent connectivity, app kill mid-sync, token expiry while offline, local data encryption at rest, lost/stolen-device remote wipe, jailbreak/root detection, certificate pinning.

### 3.8 OFFLINE-FIRST & SYNC (`08_offline_sync.md`)

"Offline-capable" is a headline claim — test it as a distributed-systems problem.
1. Identify the sync model (CRDT / last-write-wins / event log / server-authoritative with queue). Document it.
2. Test: two clients edit the same record offline then sync (conflicting allergy lists, med lists, vitals, diagnoses). Is any clinical data silently lost or overwritten? **Silent LWW on clinical data = S1.**
3. Offline → what is *actually* available? Test each major workflow with the network cut: login, patient lookup, chart view, prescribe, order, administer meds (BCMA), registration, QR scan, discharge, AI features, DHIS2 reporting, interaction checking (is the drug DB available offline? are hard-stops still enforced offline?).
4. Long offline (7 days+), huge backlog sync (50k ops), partial sync failure, resume, ordering, clock skew between devices, duplicate operations on retry, schema/version mismatch between old offline client and newer server (migration safety).
5. Local storage security: encryption at rest, key handling, wipe on logout, offline PIN/biometric, session lifetime.
6. Offline patient identity: can two offline sites create duplicate MRNs? Test ID generation collisions and merge handling.
7. Brochure says "even offline" for the unified longitudinal record — verify what subset is cached and the staleness indicator shown to clinicians.

### 3.9 SECURITY, PRIVACY & COMPLIANCE (`09_security.md`)

Treat as an attacker with a low-privilege account, then as an unauthenticated user.
1. **Authentication:** password policy, MFA, lockout, brute force, session fixation, token lifetime/rotation/revocation, JWT alg=none/weak secrets/kid injection, OAuth/OIDC flaws, password reset poisoning, SMS OTP abuse, default credentials, seeded admin accounts.
2. **Authorization/RBAC:** build a role × resource × action matrix from code/docs, then test it empirically. Horizontal (patient A→B) and vertical (nurse→admin) escalation on every endpoint (REST, GraphQL, FHIR, websockets, file endpoints, export endpoints, reports). Test IDOR everywhere, mass assignment, role claim tampering, tenant/facility isolation (multi-facility: can facility X read facility Y?). **Break-glass:** exists? audited? reviewed?
3. **OWASP Top 10 / API Top 10:** injection (SQL/NoSQL/command/LDAP/FHIR search), XSS (stored XSS in clinical notes rendered in other users' browsers, patient-app messages, filenames), CSRF, SSRF (webhook URLs, DICOM/HL7/FHIR fetch-by-URL, DHIS2 URL config), XXE (E2B XML, CDA, SOAP), insecure deserialization, path traversal on uploads/DICOM, unrestricted file upload (polyglot, huge, zip bombs), open redirects, rate limiting/DoS, verbose errors, security headers, CORS misconfig, GraphQL introspection/depth/batching.
4. **Secrets & supply chain:** gitleaks/trufflehog across full git history, hard-coded keys, `.env` committed, dependency CVEs (SCA), outdated base images, unpinned deps, typosquatting risk, SBOM generation, CI/CD secrets exposure.
5. **Data protection:** encryption in transit (TLS config, HSTS) and at rest (DB, backups, object storage, mobile local storage, logs); key management; PHI in logs, error trackers (Sentry), analytics, crash reports, URLs, push-notification payloads, SMS bodies, email; backups restore test; data deletion really deletes (including search index, caches, backups policy).
6. **Audit logging:** is every PHI read/write/export/print/AI-call/override logged with who/what/when/where? Tamper-resistance (append-only/hash-chained?), log retention, ability to produce an access report for one patient ("who viewed my record?"). FHIR `AuditEvent`/`Provenance` correctness.
7. **HIPAA reality check:** brochure lists HIPAA. Map technical safeguards (§164.312): access control, unique user ID, emergency access, auto logoff, encryption, audit controls, integrity, person/entity authentication, transmission security → implemented/not. Note this is a *technical* gap analysis only.
8. **Consent management:** granular consent for data sharing/research/telemedicine recording/AI processing; is consent enforced technically (not just recorded)? Withdrawal honoured downstream (research exports, FHIR sharing, app)?
9. **Multi-tenant isolation & data residency:** can data leave Zimbabwe/SADC unintentionally (LLM APIs, CDN, analytics, error tracking, backups)?
10. Run available tooling: semgrep/CodeQL rules, bandit/eslint-security, ZAP baseline/API scan against the local instance, `testssl.sh`, container scans. Include raw summaries in appendix.

### 3.10 DATA INTEGRITY, MIGRATION & INTEROP-WITH-LEGACY (`10_data_migration.md`)

1. **Import (C-040):** feed messy legacy data: CSV/Excel/SQL dumps/OpenMRS-style/DHIS2 tracker exports/HL7 v2 files/CDA. Include: duplicate patients, missing DOB, impossible dates (future births, death before birth), encoding issues (UTF-8, diacritics, Shona/Ndebele/Portuguese characters), free-text dosages ("1 bd x 5/7", "2/52"), units inconsistencies, non-standard drug names, merged charts, 100k patients. Verify: dedupe, error report quality (row-level, actionable), idempotent re-run, dry-run mode, rollback, provenance of imported data, no silent truncation, mapping of legacy codes → SNOMED/ICD-10 with unmapped bucket flagged.
2. **Parallel go-live (C-043):** is there a reconciliation tool to detect divergence between old and new systems? How are changes in the legacy system propagated during the parallel period? If the answer is "none", `MISLEADING` for the "straightforward switch" narrative — state what would be required.
3. **Referential & clinical integrity:** orphaned records, deletes cascading into clinical history, soft-delete vs hard-delete, record amendment vs overwrite (legal medical record requires versioned amendments), time-travel/"as-of" views, concurrency (optimistic locking), DB constraint coverage, migration scripts forward/backward safety.
4. **Patient identity:** MPI duplicate detection quality (fuzzy matching tests with Shona/Ndebele name variants, transliteration, DOB swaps, twins), merge/unmerge safety, wrong-patient charting protections.
5. **Time:** all timestamps timezone-explicit? DST-free Harare vs UTC servers vs other SADC zones; gestational age/age-in-days/months calculation; leap years; date-only vs datetime handling.

### 3.11 RELIABILITY, PERFORMANCE & OPERATIONS (`11_reliability.md`)

1. Load test (k6/Locust): 200 concurrent clinicians, 50 reads/sec on charts, spike to 1000 users, 10k-patient nightly job, DICOM upload bursts. Report p50/p95/p99, error rates, resource saturation, DB slow queries, N+1 queries, missing indexes.
2. Soak test (≥2h if feasible) → memory leaks, connection exhaustion.
3. Chaos: kill DB, queue, LLM provider, DHIS2, SMS gateway, payment gateway individually. Verify graceful degradation and that the **clinical core keeps working** when AI/integrations die. Check circuit breakers, timeouts, retries with jitter, dead-letter queues.
4. Backup/restore drill: take backup, destroy, restore, verify integrity and RPO/RTO claims. Disaster recovery docs reality.
5. Observability: logs/metrics/traces, alerting on critical failures (e.g., nightly job didn't run, sync stuck, SMS provider down), health endpoints honest or always-200?
6. Low-bandwidth/low-resource: throttled 2G/3G, old Android (API 24–26) / low RAM device profiles, payload sizes, time-to-interactive, image/DICOM handling.
7. Deployment: reproducible build, migrations in CI, config management, feature flags, zero-downtime claim for migration "no downtime" (C-041).

### 3.12 UX, ACCESSIBILITY & CLINICAL SAFETY HUMAN FACTORS (`12_ux_safety.md`)

1. Wrong-patient risk: similar names open simultaneously in tabs, patient banner always visible, 2-identifier confirmation on orders/med admin/results filing.
2. Alert fatigue: count alert types, severity tiers, override rates mechanisms, duplicate alerts for same cause.
3. Look-alike/sound-alike drugs (tall-man lettering), unit defaults, free-text fields in structured contexts, default-value traps, copy-forward hazards.
4. Critical results: lifecycle from lab → ordering clinician → acknowledged; what happens if the clinician is off shift? Escalation path tested.
5. Accessibility: WCAG 2.2 AA automated (axe/Lighthouse) + keyboard-only + screen-reader spot checks; mobile touch target sizes; low-literacy patient app (icon use, reading level), colour contrast in bright-light clinic environments.
6. Usability claims: "Most clinical staff are confident within two sessions" — what evidence/tooling exists (guided tours, role-based simplified views)? Count clicks for 10 core tasks (register patient, prescribe, order lab, record vitals, discharge, etc.) and report.

### 3.13 DOCUMENTATION, TESTS & CLAIM HYGIENE (`13_quality.md`)

1. Test suite quality: mutation testing sample (e.g., mutmut/Stryker on CDS & calculators) → are tests actually able to fail? Identify tests asserting nothing, mocking away the logic under test, or hitting only happy paths. Coverage of safety-critical modules specifically.
2. Is there any traceability matrix requirement → test? If not, propose one.
3. Regulatory posture: does anything in the repo/docs address medical-device software classification (e.g., IEC 62304, ISO 14971 risk management, ISO 13485/SaMD considerations) for the CDS/AI/diagnostic features? Note absence plainly.
4. Brochure hygiene: list every marketing claim that is unsupported, overstated, internally inconsistent (e.g., "R4/R5", "HIPAA" for an SADC product whose own data-protection law is CDPA, "zero manual re-entry", "no downtime", "privacy-safe", "exactly the right interval", "AI-first"), with recommended defensible rewording.

---

## 4. CROSS-CUTTING ADVERSARIAL SCENARIOS (end-to-end, `14_e2e_scenarios.md`)

Execute these as full journeys across UI/API/mobile, tracing data through every component, and record every discontinuity:

1. **Pregnant woman, HIV+, newly diagnosed TB, penicillin allergy, books via patient app.** Intake → check-in QR → ANC contact → ART selection (TB + pregnancy + DTG dosing) → interaction check → lab orders → critical result → telemedicine follow-up → home BP wearable alerts → DHIS2 (ANC + HIV + TB) indicators → de-identified research export. Check DAK-ANC/HIV/TB logic at each step and that nothing contradicts anywhere (e.g., care-gap engine vs CDS vs DAK).
2. **Child under 5 with severe malnutrition and fever** → paediatric dosing, IMCI-like danger signs, immunization catch-up, referral via FHIR to a district hospital, lab import back.
3. **Elderly diabetic + CKD + CVD on warfarin**, admitted, theatre booked, BCMA at bedside, offline ward tablet, conflicting edits, discharge summary generated by AI, patient-language instructions, 30-day mortality badge sanity.
4. **Adolescent HIV+ in a household-linked account**, privacy and disclosure leakage across app, SMS, household alerts, guardian access.
5. **Network outage + shift change + pharmacy stock-out:** sync, substitution, FEFO, cold chain breach, alerts.
6. **Malicious insider:** nurse browsing a VIP's chart, exporting data, abusing external-collaborator access; verify detection via audit.
7. **Prompt-injection chain:** a patient-app message / imported lab comment that tries to alter a discharge summary or exfiltrate another patient's data through the AI layer.
8. **Data subject request:** patient requests access + deletion of all data; trace every store (DB, search index, object storage, backups, logs, LLM provider logs, research datasets) and report where data persists.

---

## 5. DELIVERABLES (all under `./audit/`)

1. `00_recon.md`, `01…14_*.md` per-domain reports.
2. `CLAIMS_LEDGER.md` — every claim with verdict/severity/evidence.
3. `FINDINGS.jsonl` — one JSON object per finding: `{id, title, domain, claim_ids, severity, verdict, evidence:[{type, path|cmd|request, line|excerpt}], reproduction_steps, expected, actual, impact, recommendation, confidence}`.
4. `DAK_SCORECARD.md` — per-DAK conformance table + honest summary of the "up to date with WHO DAKs" claim and the update-process gap analysis.
5. `AI_REALITY_TABLE.md` — each AI feature: Real ML / Rules / LLM / Stub, validation evidence, safety guardrails, failure behaviour.
6. `TRACEABILITY_MATRIX.csv` — claim → code → test → result.
7. `TEST_ARTIFACTS/` — every script, seed generator, gold dataset, k6/Locust files, validator outputs, oracle implementations, so humans can re-run everything.
8. `EXECUTIVE_SUMMARY.md` (≤2 pages):
   - Overall **Claim Honesty Score**: % of ledger claims by verdict (VERIFIED / PARTIAL / STUB / BROKEN / ABSENT / UNVERIFIED / MISLEADING).
   - **Top 10 patient-safety/legal risks (S0)**, ranked.
   - **Top 10 brochure claims that must be changed or built before sales/pilot**.
   - **Go / No-Go readiness** for: (a) demo, (b) pilot with synthetic data, (c) pilot with real patients, (d) production at scale — each with explicit blockers.
   - A prioritised remediation roadmap (30/60/90 days) with effort estimates.
9. `COVERAGE_AND_LIMITS.md` — what you did NOT test and why, so no false assurance is taken from silence.

---

## 6. EXECUTION GUIDANCE

- Start with Phase 1 (recon), then build the ledger, then fan out domain sub-agents in parallel (suggested groups: [DAK+HIV+NCD], [AI/CDS], [FHIR+DHIS2+Migration], [Security+Privacy+Offline], [Patient app+Telemedicine+Payments+Wearables], [Research+Reliability+UX+Quality]), then run the E2E scenarios yourself using the consolidated knowledge.
- Prefer generating **independent oracles** (your own clean implementations of formulas, guidelines, KM, eGFR, indicators) rather than comparing the system to itself.
- When a test reveals a bug, **minimise** it to the smallest reproducible case and record exact steps.
- Do not stop at the first failure in a domain: map the breadth of defects.
- If a feature is behind a missing credential/licence (SNOMED, VigiBase, EcoCash, LLM keys, DICOM AI model), do not skip silently: test everything up to the boundary, inspect the code path for the remainder, and mark the specific unverified part.
- At the end, **self-audit your own audit**: list the 10 most likely places you could have been wrong or too lenient, and re-test at least 3 of them.
- Final message to the user: a concise summary pointing to `EXECUTIVE_SUMMARY.md`, the honesty score, the S0 count, and the three biggest gaps between the brochure and reality.

Begin now with Phase 1. Do not ask for permission for read-only or local test actions. Ask me only if you are blocked on credentials, environment access, or a decision that cannot be undone.
