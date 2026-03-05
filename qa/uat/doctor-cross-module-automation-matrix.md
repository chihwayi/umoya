# Doctor Cross-Module UAT Automation Matrix

| Flow | Module | Queue Item Type | Expected Action IDs | Automation Artifact | Owner | Status |
|---|---|---|---|---|---|---|
| Nurse → Doctor HIV follow-through | `hiv` | `hiv_vl_followup` / `hiv_regimen_change` | `start-eac`, `repeat-vl-plan`, `pmtct-linkage` | `qa/tests/doctor-cross-module-sync-smoke.ts` + feed evidence | Nurse QA + HIV QA | In progress |
| Nurse → Doctor oncology protocol | `oncology` | `oncology_infusion_followup` / `oncology_toxicity_followup` | `prepare-infusion-checklist`, `confirm-prechemo-lab-gate`, `escalate-oncology-doctor-review` | `qa/tests/doctor-cross-module-sync-smoke.ts` + UI screenshots | Oncology QA | In progress |
| Nurse → Doctor cardiology protocol | `cardiology` | `cardiology_protocol_followup` | `prepare-cardiology-order-set`, `complete-cardiology-visit-prep`, `escalate-cardiology-doctor-sync` | `qa/tests/doctor-cross-module-sync-smoke.ts` | Cardiology QA | In progress |
| Nurse → Doctor ED protocol | `ed` | `ed_protocol_followup` | `prepare-ed-order-set`, `complete-ed-disposition-prep`, `escalate-ed-doctor-sync` | `qa/tests/doctor-cross-module-sync-smoke.ts` | Emergency QA | In progress |
| Nurse → Doctor sepsis protocol | `sepsis` | `sepsis_bundle_followup` | `queue-sepsis-three-hour-bundle`, `confirm-repeat-lactate-plan`, `escalate-sepsis-doctor-sync` | `qa/tests/doctor-cross-module-sync-smoke.ts` | Sepsis QA | In progress |
| Nurse → Doctor blood-bank protocol | `blood_bank` | `blood_bank_transfusion_followup` | `confirm-crossmatch-consent`, `start-transfusion-monitoring`, `complete-transfusion-checklist`, `document-transfusion-reaction-escalation` | `qa/tests/doctor-cross-module-sync-smoke.ts` | Blood bank QA | In progress |
| Doctor → Accounts closed loop | `accounts/billing/claims` | workflow sync items | workflow status + accounts sync updates | doctor outcomes endpoint evidence | Accounts QA | In progress |

## Evidence Requirements
- Each row requires:
  - latest smoke evidence JSON
  - at least one UI screenshot before/after execution
  - explicit pass/fail statement in run report
