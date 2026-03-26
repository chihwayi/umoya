# MediCore — Mother of All Sprints
### AI-First Hardening, CDSS Completion, HIPAA Guardrails, and Tenant-Safe Delivery

**Authored:** 2026-03-24  
**Scope:** Entire platform  
**Program type:** Master execution sprint / umbrella sprint  
**Primary objective:** Convert MediCore from an AI-rich but uneven EHR into a coherent, AI-first, clinically governed, tenant-safe health operating system  
**Operating motto for this sprint:** AI-first, human-authorized  

---

## 0. Why This Document Exists

This is not a product vision note. It is an execution contract.

Use this document together with the execution tracker:

- [SPRINT_111_EXECUTION_TRACKER.md](/Users/devoop/Dev/personal/medicore/docs/SPRINT_111_EXECUTION_TRACKER.md)

**Execution snapshot (2026-03-25):** `MOAS-00`, `MOAS-02`, `MOAS-03`, `MOAS-10`, and `MOAS-11` are validated. `MOAS-04` is now `implemented_not_validated` with deterministic payment-state handling plus persisted denial-prediction and financial-clearance artifacts. Use the execution tracker for live status, evidence, and next actions.

This document exists to ensure an agent can:

1. Understand every major gap identified in the AI/CDSS review.
2. Implement the fixes in a safe order.
3. Never ship schema drift between TypeORM entities, provisioning, and existing tenant PostgreSQL databases.
4. Never add new AI that bypasses privacy, audit, or grounding controls.
5. Know when a task is actually done.

If an agent completes every workstream in this document and satisfies every definition of done, the platform should close the major gaps identified in the review:

- uneven AI across the patient journey
- weak registration/intake intelligence
- simulated payment and incomplete financial AI
- underpowered pharmacy intelligence
- incomplete radiology intelligence
- direct AI paths bypassing governed CDSS controls
- overstated self-learning maturity
- inconsistent HIPAA/privacy enforcement across AI surfaces
- risk of schema drift between entities, provisioning, and live tenant databases

---

## 0.1 Critical Weakness Baseline

These weaknesses are the reason this master sprint exists. They are not optional nice-to-fix items.

### Baseline scores from the system review

- Truly AI-first across the full patient journey: `4/10`
- Safe clinical self-learning maturity: `3/10`

### Critical weaknesses that must be treated as first-class program objectives

1. The platform is AI-rich but uneven.
   Registration, payments, pharmacy, radiology workflow intelligence, and patient AI governance are materially weaker than vitals, post-visit, and some copilot surfaces.

2. The self-learning story is overstated.
   [cdss-outcome-batch.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/cdss-outcome-batch.service.ts) sends feedback, but `/feedback/outcome` in [main.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/main.py) mainly logs or queues data. That is not a mature clinical learning system.

3. Guideline intelligence is too hardcoded.
   [clinical_guidelines.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/clinical_guidelines.py) is acceptable for prototyping, but weak for production-grade guideline currency, provenance, and change control.

4. Some AI paths bypass the stronger CDSS governance model.
   Any direct vendor AI path handling PHI or clinically relevant guidance is a design defect unless it is forced through the same privacy, audit, grounding, and abstention controls.

5. Learning and promotion governance is not strong enough for clinical claims.
   Metric uplift alone is not enough. Promotion must require calibration, subgroup review, shadow validation, rollback capability, and clinical governance approval.

### Program success target

This master sprint is only successful if it materially improves these two weak scores:

- Truly AI-first across the full patient journey: from `4/10` to at least `8/10`
- Safe clinical self-learning maturity: from `3/10` to at least `8/10`

If the implementation does not move those two scores, the program is incomplete even if many features were shipped.

---

## 1. Non-Negotiable Rules

### 1.1 Clinical autonomy rule

This program does **not** authorize fully autonomous diagnosis, prescribing, escalation, or irreversible treatment action.

Allowed AI-first behavior:

- summarize
- extract
- route
- recommend
- prioritize
- prefill
- draft
- reconcile
- predict
- monitor
- detect possible risk

Still requires human authorization:

- diagnosis finalization
- medication orders
- critical escalation signoff
- radiology final report signoff
- discharge signoff
- billing/legal attestations where required

### 1.2 Single governed AI path rule

No new patient-facing or clinician-facing AI may call an external model vendor directly from arbitrary service code.

All AI must go through a governed AI/CDSS path that provides:

- PHI minimization
- outbound egress controls
- request audit
- model identification
- prompt/version traceability
- grounding or rule provenance
- abstention support
- explanation envelope
- override logging

### 1.3 Tenant-safe schema rule

No schema change is complete until all of the following are true:

1. TypeORM entity definitions are updated.
2. Provisioning paths are updated.
3. Alignment bundles are regenerated if needed.
4. Existing tenant databases are repaired/backfilled.
5. Provisioning and live drift audits both pass.

If any one of those is missing, the work is incomplete.

### 1.4 Dumb-agent execution rule

Every workstream in this document must be executable by following:

- explicit files to inspect
- explicit outputs to create
- explicit tests to run
- explicit stop conditions
- explicit definition of done

No workstream may rely on vague phrases like:

- "improve AI"
- "make it smarter"
- "wire this somehow"
- "should probably work"

---

## 2. Master Definition Of Done

The master sprint is complete only when all of the following are true:

1. All workstreams in Sections 6 through 17 are completed.
2. Every new AI surface uses the governed AI/CDSS path.
3. Every schema change is provisioned and applied to current tenants.
4. `npm run audit:tenant-provisioning` passes.
5. `node scripts/audit-tenant-live-column-drift.mjs` passes for active tenants.
6. No critical workflow still depends on simulated payment behavior.
7. Registration, payment, vitals, encounter, pharmacy, radiology, discharge, and patient AI all have explicit AI/CDSS support.
8. Self-learning language in the product/docs matches actual implemented governance.
9. High-risk AI paths have offline evaluation and promotion gates.
10. HIPAA-relevant audit, minimum-necessary shaping, and vendor-path governance are consistent across all AI surfaces.

---

## 3. Mandatory Schema And Provisioning Playbook

This section is mandatory for every workstream that changes entities or tables.

### 3.1 Required steps for any schema modification

If a task adds or changes any entity/table/column/index/constraint:

1. Update the TypeORM entity.
2. Update tenant provisioning logic or generated alignment source.
3. If provisioning source changes are generated, regenerate:
   - `npm run generate:tenant-provisioning-alignment`
   - `npm run generate:tenant-structure-alignment`
4. Apply/update tenant repair path:
   - `npm run provision:all-tenants`
5. Verify provisioning coverage:
   - `npm run audit:tenant-provisioning`
6. Verify live tenant DB column drift:
   - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/medicore node scripts/audit-tenant-live-column-drift.mjs`

### 3.2 Files that govern schema safety

Primary files and commands:

- [package.json](/Users/devoop/Dev/personal/medicore/package.json)
- [audit-tenant-provisioning.mjs](/Users/devoop/Dev/personal/medicore/scripts/audit-tenant-provisioning.mjs)
- [audit-tenant-live-column-drift.mjs](/Users/devoop/Dev/personal/medicore/scripts/audit-tenant-live-column-drift.mjs)
- [generate-tenant-provisioning-alignment.mjs](/Users/devoop/Dev/personal/medicore/scripts/generate-tenant-provisioning-alignment.mjs)
- [generate-tenant-structure-alignment.mjs](/Users/devoop/Dev/personal/medicore/scripts/generate-tenant-structure-alignment.mjs)
- [database-provisioning.service.ts](/Users/devoop/Dev/personal/medicore/services/tenant-service/src/services/database-provisioning.service.ts)
- [repairTenants.ts](/Users/devoop/Dev/personal/medicore/services/tenant-service/src/scripts/repairTenants.ts)

### 3.3 Hard failure conditions

Stop immediately and do not mark done if:

- a TypeORM entity changed but provisioning did not
- provisioning changed but current tenants were not repaired
- live drift audit fails
- a migration was applied manually to one tenant only
- a new service assumes a table exists without the provisioning path creating it

---

## 4. Required Validation Pattern For Every Workstream

Every workstream must include these five validation layers where applicable:

1. Unit/service tests
2. API/controller tests
3. Workflow smoke coverage
4. Provisioning/live-drift validation for schema work
5. AI evaluation or safety checks for AI work

Every completed workstream must report:

- files changed
- commands run
- tests passed
- unresolved risks
- whether schema changed
- whether provisioning and live tenants were updated

---

## 5. Execution Order

Workstreams must be executed in this order unless there is a documented dependency exception:

1. MOAS-00 Platform guardrails and schema safety
2. MOAS-01 Governed AI gateway unification
3. MOAS-02 Knowledge, RAG, and guideline governance
4. MOAS-03 Registration and intake intelligence
5. MOAS-04 Financial clearance, payments, and claims intelligence
6. MOAS-05 Vitals, triage, and nursing copilot hardening
7. MOAS-06 Encounter, treatment, and specialty orchestration
8. MOAS-07 Pharmacy intelligence
9. MOAS-08 Radiology intelligence
10. MOAS-09 Post-visit and patient AI unification
11. MOAS-10 Learning loop, model governance, and promotion controls
12. MOAS-11 HIPAA and privacy hardening for AI
13. MOAS-12 Evaluation, observability, and release gates
14. MOAS-13 Tenant repair, release verification, and final signoff

---

## 6. MOAS-00 Platform Guardrails And Schema Safety

### Goal

Make it impossible to repeat entity/provisioning/live-tenant drift and impossible to ship AI outside the sanctioned architecture.

### Existing files to inspect first

- [database-provisioning.service.ts](/Users/devoop/Dev/personal/medicore/services/tenant-service/src/services/database-provisioning.service.ts)
- [repairTenants.ts](/Users/devoop/Dev/personal/medicore/services/tenant-service/src/scripts/repairTenants.ts)
- [audit-tenant-provisioning.mjs](/Users/devoop/Dev/personal/medicore/scripts/audit-tenant-provisioning.mjs)
- [audit-tenant-live-column-drift.mjs](/Users/devoop/Dev/personal/medicore/scripts/audit-tenant-live-column-drift.mjs)
- [package.json](/Users/devoop/Dev/personal/medicore/package.json)

### Deliverables

- Add a documented engineering contract for schema changes and AI gateway usage.
- Ensure tenant provisioning audits are part of the normal verification path.
- Add a release checklist artifact that explicitly includes:
  - entity/provisioning parity
  - current tenant repair
  - AI gateway compliance

### Mandatory outputs

- new doc section or new doc for engineering contract if needed
- updated scripts or package commands only if there is a genuine missing guardrail
- zero unresolved provisioning drift

### Definition of done

- schema playbook is documented and referenced
- drift audits are runnable and green
- no agent can reasonably claim ignorance about provisioning obligations

---

## 7. MOAS-01 Governed AI Gateway Unification

### Goal

Unify all AI through a single sanctioned gateway so privacy, audit, grounding, abstention, and model governance are consistent.

### Gaps being closed

- direct external AI calls in feature services
- inconsistent model/vendor routing
- uneven PHI protection
- weak auditability outside CDSS

### Existing files to inspect first

- [cdss.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/cdss.service.ts)
- [patient-ai.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient-ai.service.ts)
- [ambient.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/ambient.service.ts)
- [post-visit-grounded-llm.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/post-visit-grounded-llm.service.ts)
- [llm_provider.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/ai_models/llm_provider.py)
- [privacy_guard.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/privacy_guard.py)
- [ai_governance.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/ai_governance.py)

### Required work

1. Create or formalize one AI gateway contract for:
   - prompt routing
   - redaction
   - egress allowlist checks
   - audit metadata
   - model/version trace
   - citation/grounding payloads
   - abstention
   - confidence policy
2. Refactor any direct vendor calls in EHR service to use the gateway.
3. Ensure patient-facing AI and clinician-facing AI both use the same governance envelope.
4. Standardize the response envelope for all non-trivial AI outputs:
   - answer/recommendation
   - confidence
   - evidence/citations
   - model
   - audit metadata
   - abstained flag

### Minimum acceptance tests

- patient AI path no longer bypasses sanctioned controls
- every AI endpoint returns model/audit metadata where clinically material
- failure path produces safe fallback or abstention

### Definition of done

- no direct high-risk vendor calls remain in feature services
- one governed AI path exists and is used everywhere
- audit trail exists for all clinically relevant AI outputs

---

## 8. MOAS-02 Knowledge, RAG, And Guideline Governance

### Goal

Replace ad hoc and hardcoded guideline behavior with a governed clinical knowledge layer.

### Gaps being closed

- hardcoded guideline logic
- unclear freshness of knowledge
- inconsistent grounding sources
- weak clinical provenance for AI answers

### Existing files to inspect first

- [clinical_guidelines.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/clinical_guidelines.py)
- [rag_engine.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/ai_models/rag_engine.py)
- [diagnostic_assistant.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/diagnostic_assistant.py)
- [docs/SPRINT-ROADMAP-AI-FIRST.md](/Users/devoop/Dev/personal/medicore/docs/SPRINT-ROADMAP-AI-FIRST.md)

### Required work

1. Create a canonical clinical knowledge registry with:
   - source name
   - source version/date
   - specialty/module
   - recommendation blocks
   - contraindications
   - local adaptation flags
   - evidence metadata
2. Ensure RAG retrieves from first-party governed knowledge sources before free-form reasoning.
3. Add explicit freshness/version metadata to knowledge-based responses.
4. Add a process for updating guidelines without unsafe code scattering.
5. Reduce [clinical_guidelines.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/clinical_guidelines.py) from primary production knowledge source to bounded fallback or compatibility layer.

### Database impact

Likely new tables:

- `clinical_knowledge_sources`
- `clinical_knowledge_documents`
- `clinical_knowledge_recommendations`
- `clinical_knowledge_releases`

If these are added:

- update entities
- update provisioning
- repair current tenants
- rerun both audits

### Minimum acceptance tests

- a guideline-based recommendation can name its source/version
- stale or missing guidance causes abstention or lower-confidence behavior
- retrieval tests prove governed corpus is used

### Definition of done

- hardcoded guideline logic is reduced to bounded fallback rules
- governed knowledge registry exists
- grounded clinical recommendations have traceable provenance
- guideline freshness, provenance, and update workflow no longer depend on hardcoded Python dictionaries

---

## 9. MOAS-03 Registration And Intake Intelligence

### Goal

Make registration and intake genuinely intelligent instead of mostly CRUD plus manual cleanup.

### Gaps being closed

- no duplicate-patient intelligence
- no OCR intake copilot
- weak identity verification intelligence
- no insurance/coverage intake intelligence
- no intake summary generation
- no risk-based routing at first touch

### Existing files to inspect first

- [patient-auth.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient-auth.service.ts)
- [patient.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient.service.ts)
- [patient-portal.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient-portal.service.ts)
- [medical-nlp.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/medical-nlp.service.ts)
- patient registration and portal pages in `patient-portal/src/`

### Required modules to build or harden

- Patient identity resolution / duplicate candidate detection
- Registration document OCR and extraction
- Insurance/member-card extraction and eligibility pre-check
- Intake completeness scoring
- Intake risk routing
- Intake summary for front desk, nurse, and clinician

### Required work

1. Add duplicate-patient candidate logic using demographics, IDs, phone, DOB, and fuzzy name matching.
2. Add uploaded registration document extraction for:
   - ID/passport
   - insurance/medical aid card
   - referral letter
3. Add intake copilot output:
   - missing fields
   - suspected duplicates
   - coverage risks
   - clinician-relevant summary
4. Add structured consent capture readiness check.

### Database impact

Likely new tables:

- `patient_identity_matches`
- `registration_document_extracts`
- `intake_assessments`
- `insurance_eligibility_checks`

### Minimum acceptance tests

- create a patient with similar demographics to an existing patient and see duplicate suggestions
- upload a sample referral/card/ID and get structured extraction
- registration UI receives intake completeness result and summary

### Definition of done

- registration stage now has meaningful AI/CDSS support
- duplicate detection exists
- intake OCR/extraction exists
- financial/coverage risk starts before treatment, not after

---

## 10. MOAS-04 Financial Clearance, Payments, Claims, And Revenue Intelligence

### Goal

Replace simulated payment behavior and heuristic-only claims support with real financial intelligence.

### Gaps being closed

- simulated payment handling
- weak denial prediction
- missing prior-auth copilot
- no patient quote/out-of-pocket intelligence
- no anomaly/fraud detection

### Existing files to inspect first

- [payments.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/payments.service.ts)
- [claims.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/claims.service.ts)
- [payment-reconciliation.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/payment-reconciliation.service.ts)
- [revenue-cycle.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/revenue-cycle.service.ts)
- [claims.controller.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/controllers/claims.controller.ts)

### Required work

1. Replace simulated payment status and verification with real provider integration patterns.
2. Add denial-risk prediction using:
   - payer history
   - diagnosis/procedure mismatch
   - document completeness
   - authorization state
   - coding specificity
3. Add prior-authorization draft support.
4. Add patient financial clearance output:
   - estimated responsibility
   - eligibility status
   - authorization blockers
   - recommended next step
5. Add reconciliation anomaly detection and suspicious pattern reporting.

### Database impact

Likely new or extended tables:

- `payment_provider_events`
- `payment_verification_attempts`
- `claim_denial_predictions`
- `prior_authorization_drafts`
- `financial_clearance_assessments`
- `payment_anomaly_flags`

### Minimum acceptance tests

- no random/simulated payment result remains in production path
- claim readiness endpoint includes predictive denial risk, not just rule gaps
- reconciliation can flag suspicious or low-confidence matches

### Definition of done

- payment stage is no longer mocked
- financial AI exists before, during, and after billing
- claims and pre-auth become genuinely AI-assisted

---

## 11. MOAS-05 Vitals, Triage, Nursing, And Early Warning Hardening

### Goal

Take an already strong area and make it clinically operational, explainable, and closed-loop.

### Gaps being closed

- not enough longitudinal baseline-aware intelligence
- not enough nurse copilot explanation
- incomplete escalation follow-through

### Existing files to inspect first

- [vitals.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/vitals.service.ts)
- [early-warning.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/early-warning.service.ts)
- [predictive-risk.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/predictive-risk.service.ts)
- [triage.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/triage.service.ts)
- [patient-vitals-submission.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient-vitals-submission.service.ts)

### Required work

1. Add patient-specific baseline deviation logic.
2. Add nurse explanation payloads for alerts:
   - why this fired
   - what changed
   - what to do next
3. Add escalation task creation and acknowledgment workflow.
4. Improve patient-submitted vitals handling so home data feeds risk engines safely.
5. Add device/wearable-ready ingestion contracts.

### Database impact

Likely new tables:

- `patient_vital_baselines`
- `clinical_escalation_tasks`
- `remote_monitoring_events`
- `remote_monitoring_alerts`

### Minimum acceptance tests

- a deteriorating patient can be explained using trend deltas, not only threshold scores
- nurse alert results in actionable task state
- patient-submitted vitals are visible with source, confidence, and alert trace

### Definition of done

- vitals and triage remain strong and become more operationally complete
- alerting is explainable and actionable

---

## 12. MOAS-06 Encounter, Treatment, And Specialty Orchestration

### Goal

Create one encounter-level AI copilot that orchestrates treatment across specialty modules instead of leaving intelligence fragmented.

### Gaps being closed

- specialty AI is uneven
- treatment planning is fragmented
- no single care-orchestration layer
- order appropriateness and follow-up gaps

### Existing files to inspect first

- [ambient.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/ambient.service.ts)
- [smart-defaults.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/smart-defaults.service.ts)
- [diabetes-cds.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/diabetes-cds.service.ts)
- [clinical-trial-matching.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/clinical-trial-matching.service.ts)
- relevant specialty services under `services/ehr-service/src/services/`

### Required work

1. Build encounter copilot orchestration output:
   - active problems
   - missing context
   - suggested orders
   - likely care gaps
   - contraindication summary
   - next-step pathway recommendation
2. Add specialty pathway templates for highest-value areas:
   - diabetes
   - HIV
   - maternity
   - oncology
   - cardiology
   - emergency/sepsis
3. Add order appropriateness support before orders are finalized.
4. Add result follow-up tasks for labs/imaging and missed actions.

### Database impact

Likely new tables:

- `encounter_copilot_sessions`
- `treatment_pathway_instances`
- `order_appropriateness_reviews`
- `result_followup_tasks`

### Minimum acceptance tests

- an encounter can produce one unified AI copilot summary
- specialty modules can contribute pathway-specific recommendations
- missed follow-up actions create tasks

### Definition of done

- encounter AI exists as an orchestrator, not just isolated features
- treatment modules are materially more AI-first

### Execution note

- 2026-03-26 first MOAS-06 slices landed: `encounter_copilot_sessions`, `treatment_pathway_instances`, `order_appropriateness_reviews`, and `result_followup_tasks` now exist, and the new encounter copilot persists unified encounter output, ranked pathway recommendations, pre-finalization order-review artifacts, and post-result follow-up tasks from critical labs plus radiology findings using diabetes, HIV, maternity, oncology, ambient, smart-defaults, care-gap, lab-alert, and imaging context. Remaining required work in this section still includes deeper cardiology/emergency pathway contribution depth.

---

## 13. MOAS-07 Pharmacy Intelligence

### Goal

Turn pharmacy from a mostly operational workflow into an intelligent medication safety and fulfillment platform.

### Gaps being closed

- weak medication reconciliation intelligence
- limited substitution and counseling intelligence
- no operational stock forecasting AI
- no robust dispensing anomaly detection
- limited stewardship logic

### Existing files to inspect first

- [pharmacy.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/pharmacy.service.ts)
- [medication-safety.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/medication-safety.service.ts)
- [formulary-optimization.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/formulary-optimization.service.ts)
- [patient-ai.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient-ai.service.ts)

### Required work

1. Build medication reconciliation copilot across:
   - current prescriptions
   - history
   - reported meds
   - formulary substitutions
   - duplicate therapy
   - adherence concerns
2. Add pharmacist-facing substitution intelligence with evidence and cost impact.
3. Add patient-specific counseling generation through the governed AI path.
4. Add inventory forecasting and shortage risk scoring.
5. Add dispensing anomaly detection:
   - quantity outliers
   - refill frequency anomalies
   - controlled drug risk patterns
6. Add antimicrobial stewardship and high-risk medication review workflows.

### Database impact

Likely new tables:

- `medication_reconciliation_ai_reviews`
- `pharmacy_substitution_recommendations`
- `pharmacy_inventory_forecasts`
- `pharmacy_dispensing_anomalies`
- `antimicrobial_stewardship_reviews`

### Minimum acceptance tests

- prescription event can trigger substitution and counseling suggestions
- a medication history mismatch can produce reconciliation output
- stock forecasting can identify shortage risk for future periods

### Definition of done

- pharmacy becomes an AI-first module, not just inventory and dispensing CRUD

---

## 14. MOAS-08 Radiology Intelligence

### Goal

Make imaging intelligent at order time, worklist time, reporting time, and follow-up time.

### Gaps being closed

- weak order appropriateness support
- semantically incorrect AI routing
- limited radiologist feedback learning
- missing incidental follow-up intelligence

### Existing files to inspect first

- [imaging.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/imaging.service.ts)
- [radiology-ai.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/radiology-ai.service.ts)

### Required work

1. Remove semantically incorrect use of guideline endpoints for radiology analysis fallback.
2. Add imaging appropriateness support at order time.
3. Add protocol suggestion support based on indication/body part/context.
4. Add radiology report draft support with structured findings and explanation.
5. Add discrepancy review loop between AI and radiologist review.
6. Add incidental finding follow-up tasks and patient safety routing.

### Database impact

Likely new tables:

- `imaging_appropriateness_reviews`
- `radiology_protocol_recommendations`
- `radiology_discrepancy_reviews`
- `incidental_finding_followups`

### Minimum acceptance tests

- an imaging order can receive appropriateness feedback
- study AI output can be reviewed and discrepancy logged
- incidental critical findings generate follow-up tasks

### Definition of done

- radiology intelligence exists across the workflow, not only post-acquisition

---

## 15. MOAS-09 Post-Visit And Patient AI Unification

### Goal

Unify patient-facing AI with the stronger grounded post-visit AI architecture.

### Gaps being closed

- patient AI bypasses governed controls
- inconsistent patient guidance quality
- weak continuity between discharge and follow-up

### Existing files to inspect first

- [post-visit.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/post-visit.service.ts)
- [post-visit-grounded-llm.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/post-visit-grounded-llm.service.ts)
- [patient-ai.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient-ai.service.ts)
- [patient-portal.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/patient-portal.service.ts)

### Required work

1. Refactor patient symptom checker and adherence chat onto the governed AI path.
2. Ensure patient answers use:
   - approved scope
   - abstention
   - escalation rules
   - citation or provenance where appropriate
3. Add follow-up care orchestration:
   - reminders
   - unresolved questions
   - nonadherence flags
   - missed follow-up route-back
4. Add patient safety messaging policies for urgent symptoms and red flags.

### Database impact

Likely new tables:

- `patient_ai_sessions`
- `patient_ai_escalations`
- `patient_followup_orchestrations`

### Minimum acceptance tests

- patient AI no longer uses uncontrolled vendor path
- urgent patient symptom flows escalate safely
- follow-up state persists across sessions

### Definition of done

- patient AI matches the safety bar of the post-visit AI stack

---

## 16. MOAS-10 Learning Loop, Model Governance, And Promotion Controls

### Goal

Make "self-learning" true, governed, and honestly described.

### Gaps being closed

- feedback loop mostly logs/queues outcomes
- federated learning maturity is overstated
- promotion criteria are too simplistic
- weak shadow and rollback governance

### Existing files to inspect first

- [cdss-decision-log.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/cdss-decision-log.service.ts)
- [cdss-outcome-batch.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/cdss-outcome-batch.service.ts)
- [federated-learning.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/federated-learning.service.ts)
- [model-monitoring.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/model-monitoring.service.ts)
- [model-registry.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/model-registry.service.ts)
- [main.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/main.py)

### Required work

1. Turn outcome feedback into a real learning pipeline, not only a queue/log sink.
   Current weakness to remove:
   `/feedback/outcome` in [main.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/main.py) mainly logs and queues entries. That must be replaced or extended into a governed learning pipeline with durable processing, validation, and promotion review.
2. Distinguish clearly between:
   - rules
   - heuristics
   - local ML
   - federated learning
   - LLM outputs
3. Add promotion gates requiring:
   - AUC or task metric improvement
   - calibration thresholds
   - subgroup fairness thresholds
   - clinical shadow validation
   - rollback path
4. Add explicit model cards and deployment states:
   - development
   - shadow
   - canary
   - production
   - rolled_back
5. Ensure documentation stops overstating self-learning until the real loop exists.
6. Add explicit evidence that the learning loop changes model state only through governed review, never by silent production self-modification.

### Database impact

Likely new or extended tables:

- `model_cards`
- `model_shadow_evaluations`
- `model_promotion_reviews`
- `ai_incidents`
- `outcome_learning_jobs`

### Minimum acceptance tests

- feedback entries can flow into a real retraining/re-evaluation path
- promotion cannot happen on AUC alone
- rollback can be triggered and audited

### Definition of done

- self-learning is real and governed
- product and docs describe it accurately
- no honest reviewer could describe the learning loop as "just logging and queueing outcome feedback"

---

## 17. MOAS-11 HIPAA, Privacy, Security, And Vendor Path Hardening

### Goal

Apply one privacy/security standard to every AI path, especially any path handling PHI.

### Gaps being closed

- inconsistent HIPAA-grade handling across AI surfaces
- direct vendor path risk
- incomplete minimum-necessary enforcement for AI payloads
- regex-only PHI controls not sufficient as sole mechanism

### Existing files to inspect first

- [hipaa-audit.interceptor.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/interceptors/hipaa-audit.interceptor.ts)
- [upload-security.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/upload-security.service.ts)
- [privacy_guard.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/privacy_guard.py)
- [llm_provider.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/ai_models/llm_provider.py)
- [ai_governance.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/ai_governance.py)

### Required work

1. Add explicit AI data classification and minimum-necessary shaping rules by use case.
2. Add model/vendor allowlist and purpose registry.
3. Add AI-specific audit event types for:
   - prompt build
   - outbound model call
   - abstention
   - override
   - escalation
   - auto-generated draft accepted/rejected
4. Add stronger secret/config fail-fast checks for AI vendors.
5. Add business-associate and vendor-governance checklist support where external PHI processors are used.

### Database impact

Likely new tables:

- `ai_vendor_registry`
- `ai_usecase_policies`
- `ai_access_audit_events`
- `ai_prompt_templates`

### Minimum acceptance tests

- every AI use case maps to a policy
- outbound calls are blocked if policy or vendor registration is missing
- audit logs can show who invoked what AI path and what model was used

### Definition of done

- HIPAA/privacy/security handling is consistent across all AI surfaces

---

## 18. MOAS-12 Evaluation, Observability, And Release Gates

### Goal

Prevent unsafe or low-quality AI from silently degrading in production.

### Gaps being closed

- limited offline eval coverage
- incomplete AI release gates
- insufficient observability for operational trust

### Existing files to inspect first

- [offline_clinical_eval.py](/Users/devoop/Dev/personal/medicore/services/cdss-service/evaluation/offline_clinical_eval.py)
- [model-monitoring.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/model-monitoring.service.ts)
- [metrics.service.ts](/Users/devoop/Dev/personal/medicore/services/ehr-service/src/services/metrics.service.ts)

### Required work

1. Expand evaluation harnesses to cover:
   - diagnosis assist
   - patient AI
   - radiology AI
   - post-visit grounded answers
   - form defaults where clinically material
2. Add release gates for:
   - citation support rate
   - abstain correctness
   - unsafe overconfidence rate
   - calibration drift
   - subgroup disparities
3. Add live dashboards for:
   - override rates
   - abstention rates
   - escalation follow-through
   - patient safety alert rates
   - vendor/model usage

### Database impact

Likely new tables:

- `ai_eval_runs`
- `ai_eval_case_sets`
- `ai_release_gate_results`

### Minimum acceptance tests

- at least one repeatable evaluation exists for each major AI surface
- release cannot proceed if critical gates fail

### Definition of done

- AI release quality is measurable and gated

---

## 19. MOAS-13 Tenant Repair, Final Verification, And Release Signoff

### Goal

Finish with a release that is tenant-safe, verifiable, and truthful.

### Required work

1. Run tenant repair for all active tenants after schema-affecting work.
2. Rerun provisioning and live-drift audits.
3. Run workflow smoke coverage for:
   - registration
   - payments
   - vitals
   - encounter
   - pharmacy
   - radiology
   - post-visit
4. Produce a final release signoff note with:
   - completed workstreams
   - remaining known risks
   - any deferred work
   - whether the product claims about AI/self-learning are now accurate

### Mandatory commands before signoff

```bash
npm run audit:tenant-provisioning
npm run provision:all-tenants
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/medicore node scripts/audit-tenant-live-column-drift.mjs
```

Plus relevant service/unit/smoke tests for changed modules.

### Definition of done

- active tenants repaired
- audits green
- release note produced

---

## 20. Agent Execution Template

Every agent implementing a workstream must report using this template:

```md
## Workstream
MOAS-XX — <name>

## Files Changed
- <absolute path>

## Schema Changed
- yes|no

## Provisioning Updated
- yes|no

## Current Tenants Repaired
- yes|no

## Commands Run
- <command>

## Tests Run
- <test command>

## Acceptance Result
- passed|failed

## Remaining Risks
- <flat list>
```

---

## 21. Hard Prohibitions

Agents must not:

- add AI with no audit trail
- add AI that cannot abstain when grounding is weak
- ship schema changes without provisioning and tenant repair
- describe heuristic logic as self-learning
- call external AI vendors directly from feature code when governed CDSS path should be used
- silently swallow clinically material AI failures without safe fallback
- mark a workstream done while any acceptance criteria are still unverified

---

## 22. Coverage Matrix Against The Review Verdict

This section proves whether the document actually covers the gaps identified in the review.

### Verdict item: Uneven AI across the patient journey

Covered by:

- MOAS-03 Registration and intake intelligence
- MOAS-04 Financial clearance and payments
- MOAS-05 Vitals and triage hardening
- MOAS-06 Encounter and specialty orchestration
- MOAS-07 Pharmacy intelligence
- MOAS-08 Radiology intelligence
- MOAS-09 Post-visit and patient AI unification

Coverage result: **Yes**

### Verdict item: Registration/intake is not truly AI-first

Covered by:

- duplicate detection
- OCR intake extraction
- intake completeness scoring
- insurance/coverage pre-check
- intake summary generation
- risk-based routing

Coverage result: **Yes**

### Verdict item: Payment flow is weak and partly simulated

Covered by:

- real payment integration requirement
- denial prediction
- prior-auth drafting
- financial clearance assessment
- reconciliation anomaly detection

Coverage result: **Yes**

### Verdict item: Vitals/triage is strong but not closed-loop enough

Covered by:

- baseline-aware interpretation
- nurse explanation payloads
- escalation task workflow
- patient-submitted vitals hardening
- remote monitoring ingestion

Coverage result: **Yes**

### Verdict item: Encounter/treatment AI is fragmented across specialties

Covered by:

- encounter copilot orchestration
- pathway templates
- order appropriateness
- result follow-up tasks

Coverage result: **Yes**

### Verdict item: Pharmacy is not yet AI-first

Covered by:

- medication reconciliation copilot
- substitution intelligence
- counseling generation
- inventory forecasting
- anomaly detection
- stewardship workflows

Coverage result: **Yes**

### Verdict item: Radiology intelligence is present but architecturally weak

Covered by:

- removing incorrect routing
- order appropriateness
- protocol recommendations
- discrepancy review loop
- incidental finding follow-up

Coverage result: **Yes**

### Verdict item: Patient AI bypasses stronger CDSS governance

Covered by:

- governed AI gateway unification
- patient AI refactor onto sanctioned path
- patient safety messaging policy

Coverage result: **Yes**

### Verdict item: Self-learning maturity is overstated

Covered by:

- real learning-loop workstream
- model governance
- model card and promotion controls
- documentation honesty requirement

Coverage result: **Yes**

### Verdict item: HIPAA/privacy enforcement is inconsistent across AI surfaces

Covered by:

- single governed AI path
- AI policy registry
- vendor allowlist
- AI-specific audit events
- minimum-necessary shaping

Coverage result: **Yes**

### Verdict item: Risk of schema drift between entities, provisioning, and live tenants

Covered by:

- schema playbook
- audit commands
- generated alignment regeneration
- mandatory tenant repair
- hard failure conditions

Coverage result: **Yes**

---

## 23. Final Coverage Analysis

### Does this document cover all major issues from the verdict?

**Yes.**

The verdict had ten major problem statements. This document includes explicit workstreams for all ten.

### Does this document explicitly cover the weakest review scores and biggest architectural weaknesses?

**Yes.**

It explicitly includes:

- the low baseline score for full patient-journey AI-first maturity
- the low baseline score for safe clinical self-learning maturity
- the current weakness where outcome feedback is mostly logged/queued rather than truly learned from
- the current weakness where guideline intelligence is overly hardcoded
- the need to remove direct unguided AI paths and replace them with governed CDSS routing

### Does this document force provisioning and current-tenant repair for database modifications?

**Yes.**

This document makes that a master gate, not a suggestion.

### Could a weak agent still follow this document?

**Yes, if it follows instructions literally.**

The document provides:

- execution order
- file discovery points
- deliverables
- validation pattern
- definitions of done
- prohibitions
- reporting template

### What this document intentionally does not do

It does not pretend one sprint means one commit. This is a master sprint program. It should likely be executed in sub-sprints or workstreams, but all of them belong to this umbrella sprint until the platform is truly AI-first and tenant-safe.

### Final conclusion

This document is sufficient to drive the hardening program and is consistent with the review verdict.
