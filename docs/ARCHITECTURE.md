# Umoya Architecture Reference

Last updated: 2026-06-29

This document contains the architecture rules, DB provisioning patterns, and agent constraints that apply to all work on this codebase. Read it before editing any file.

---

## System Layout

| Component | Path | Notes |
|---|---|---|
| Tenant service | `services/tenant-service/` | NestJS + TypeORM. Manages tenant lifecycle and billing. |
| EHR service | `services/ehr-service/` | NestJS. All clinical, operational, financial, and interoperability API. |
| CDSS service | `services/cdss-service/` | FastAPI (Python). Clinical decision support and AI. |
| Super-admin portal | `web-app/src/` | React + Tailwind. Pages in `web-app/src/pages/`. |
| EHR frontend | `ehr-frontend/src/` | React + Tailwind. Pages in `ehr-frontend/src/pages/`. |
| Patient portal | `patient-portal/src/` | React + Tailwind. Auth via `PatientAuthContext`. Routes under `/:tenantSlug/`. |
| Mobile | `mobile/src/` | Expo React Native. API via `mobile/src/services/api.ts`. |

---

## Tenant Entity Facts

- File: `services/tenant-service/src/entities/tenant.entity.ts`
- Already has: `country: string` (default `'Zimbabwe'`), `enabledModules: string[]` (JSONB), `featureFlags: Record<string, boolean>` (JSONB), `deploymentMode: string`, `subscriptionState`, `billingEndsAt`, `graceEndsAt`, `autoDeleteAt`, `demoExpiresAt`.
- Extend these fields — do not add parallel fields.
- Valid module key strings (defined in `tenant.service.ts`): `finance`, `nurse_general`, `claims`, `hiv`, `maternity`, `radiology`, `oncology`, `cardiology`, `diabetes`, `pharmacy`, `laboratory`, `telemedicine`, `patient_portal`, `operating_room`, `emergency`, `ophthalmology`, `blood_bank`, `infection_control`, `revenue_cycle`, `population_health`, `orthopaedics`, `ent`, `gastroenterology`, `rheumatology`, `haematology`, `urology`, `physiotherapy`, `endocrinology`, `cathlab`, `icu`, `nicu`, `well_baby_clinic`, `epi_immunisation`, `neonatal_screening`, `dialysis`, `aviation_medicine`, `hyperbaric`, `prosthetics`, `perinatal_mental_health`, `nicu_followup`, `patient_transport`, `aesthetics`, `paediatric_cardiology`, `occupational_medicine`.

---

## Adding Columns to the System `tenants` Table

Add an `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS …` inside `TenantService.ensureSubscriptionSchema()` in `services/tenant-service/src/services/tenant.service.ts`. This runs on every startup and is safe to re-run. Never write a raw migration file for system-table changes.

---

## Adding Tables to Per-Tenant Databases

Add a provisioning bundle to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`. Each bundle needs: `id` (unique camelCase), `label`, `version` (`YYYY.MM.DD.N`), `description`, `statements: () => string[]`. Always use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. After adding, run `POST /admin-maintenance/tenants/repair-all` to backfill existing tenants.

---

## DB Provisioning Bundles (all tenants)

| Bundle ID | What it creates |
|---|---|
| `nc_cdpa_compliance` | CDPA 2021 18-control register + consent records |
| `nc_session_management` | Active sessions, emergency access log, AES column encryption |
| `nc_oi_geriatric_fasttrack` | OI early-warning alerts, geriatric flags, stable fast-track flags |
| `nc_resistance_mmd` | Drug resistance assessments, regimen switches, MMD schedules, lab import audit |
| `nc_alhiv_disclosure_gbv` | Disclosure records, adolescent transition assessments, GBV screenings, counsellor sessions |
| `nc_empowerment_support_groups` | WEEP/MEEP programmes, support groups, group sessions, attendance |
| `nc_training_platform` | CPD courses, modules, MCQ questions, attempts, certificates, CPD ledger, alumni |
| `nc_research_platform` | Cohort queries, retention snapshots |
| `nc_publication_research_day` | Adverse event reports, research portal tokens |
| `nc_ussd_campaigns` | USSD sessions, SMS campaigns, dispatch log, opt-outs, nudge schedules |
| `nc_breach_detection` | Anomaly events, breach incidents, backup jobs |
| `nc_offline_hardening` | Offline sync queue, conflict log |
| `nc_dental_anc_paediatric` | Dental chart + treatment plans, ANC registrations, EID schedules, growth measurements |
| `nc_alumni_consent_webauthn` | WebAuthn credentials, teleconsult-EHR links |
| `patient_health_education` | 10 education tables: courses, modules, lessons, translations, quizzes, questions, options, enrollments, lesson progress, quiz attempts |
| `storeroom_core` | Central inventory: `inventory_locations`, `storeroom_catalog`, `location_stock`, `stock_movements`, `stock_transfers`, `transfer_items`, `stock_requests`, `request_items`, `consumption_records` |
| `storeroom_ai` | AI layer: `demand_forecasts`, `storeroom_anomaly_events`, `reorder_suggestions` |
| `storeroom_soft_lock` | `stock_reservations` — soft locks on prescription creation; auto-expire after 24 hours; partial indexes for active/prescription lookups |
| `storeroom_expiry_coldchain` | `requires_refrigeration` + `cold_chain_notes` on `storeroom_catalog`; `expiry_alert_sent_at` on `location_stock` |
| `storeroom_module_integration` | `location_subtype` on `inventory_locations`; `emergency_kit_items`; `is_arv`, `is_emergency_kit`, `is_chemo_component` flags on catalog; `chemo_regimen_components` |
| `storeroom_procurement` | `storeroom_suppliers`, `storeroom_purchase_orders`, `storeroom_po_items`; `preferred_supplier_id`, `reorder_level`, `reorder_quantity` on catalog |
| `storeroom_drug_substitution` | `atc_code`, `drug_class`, `category` on catalog; `drug_equivalents` mapping table |
| `clinical_conflict_safety` | `clinical_resolution_queue` (safety-critical sync conflict review queue); `sync_safety_fields` (per-field LWW vs queue strategy registry) |
| `qr_checkin` | `patient_checkin_tokens` (SHA-256 hashed one-time tokens); `actual_checkin_at`, `checkin_method` columns on `appointments` |
| `pre_visit_intake` | `pre_visit_intake_forms` (patient-completed demographics, symptoms, medications, allergies, consent, insurance before arrival) |
| `discharge_push` | `patient_discharge_documents` (PDF discharge papers in MinIO); `finalized_at`, `finalized_by`, `discharge_sent` columns on `encounters` |
| `wearable_sync` | `wearable_devices`, `wearable_readings` (append-only), `wearable_trend_alerts` (3-consecutive-abnormal AI detection) |
| `referral_tracking` | `referral_status_log` (audit trail), `referral_messages` (secure thread), `referral_webhook_keys` (SHA-256 receiving-facility API keys) |
| `pro_risk_loop` | `risk_outreach_tasks` (auto-created for high-risk patients); `latest_risk_score`, `latest_risk_level`, `risk_updated_at` cache columns on `patients` |
| `in_app_payment` | `patient_payment_transactions` (EcoCash/OneMoney/ZiG); `payment_status`, `paid_at`, `paid_via` columns on `invoices` |
| `queue_wait_time` | `clinic_queue` (daily queue with position and wait estimate); `queue_config` (configurable average consult duration) |
| `theatre_utilization` | `theatre_rooms`, `theatre_cases` (planned vs actual times, surgeon, cancellation reason), `theatre_config` |
| `csat_survey` | `csat_surveys` (SHA-256 token-gated CSAT/NPS/category ratings + free text, 48 h expiry) |
| `ward_round` | `ward_beds`, `inpatient_admissions`, `ward_round_notes` (structured SOAP), `ward_orders` (medication/lab/imaging/nursing) |
| `household_family_graph` | `household_groups`, `patient_family_links`; `household_id` on `patients`; `household_alerts` (infectious/genetic propagation) |
| `digital_consent` | `consent_form_templates` (procedure-specific risks/benefits), `consent_requests` (e-signature + PDF via pdfkit → MinIO) |
| `stock_transfer` | `stock_transfer_orders` (cross-facility transfer lifecycle); `min_stock_level`, `reorder_point` columns on `storeroom_items` |
| `ahfoz_claims` | `medical_aid_tariff_codes` (AHFoZ GP + dental schedule), `medical_aid_claim_lines` (tariff_code, qty, unit_amount, line_amount, tooth/quadrant, ICD-10 link); `dependant_code`, `plan_name` columns on `medical_aid_claims` |
| `medical_aid_remittance_lines` | `medical_aid_remittance_lines` (remittance import: ERA/CSV → matched claim + short-pay/rejection amounts) |
| `medical_aid_provider_config` | per-tenant insurer endpoint, auth type, and credentials for real eligibility + claim submission (CIMAS and others) |
| `mcaz_compliance` | `mcaz_facility_licences`, `mcaz_pharmacist_registrations`, `mcaz_controlled_dispenses`, `mcaz_controlled_returns`; prescriber MDPCZ registration numbers on staff |
| `notification_center` | `notification_trigger_configs` (per-tenant toggle per trigger + channel), `notification_log` (audit trail of every notification sent); triggers: Appointment Booked, 24h Reminder, Payment Received, Claim Status Updated, Staff Invitation |
| `subscription_plans` | `subscription_plans` master table (Solo/Clinic/Multi-Branch tiers with limits); usage counter columns on system `tenants` table (staff count, patient count, sms_sent_month, branch_count) |
| `offline_app_shell` | `offline_replay_queue` (pending requests with idempotency key, retry backoff, conflict flag); `offline_sync_sessions` (session-level sync state and version) |
| `sprint226_specialty_modules` | `orthopaedic_registers`, `fracture_records`, `joint_replacement_records`; `ent_visits`, `audiogram_records`; `gastro_registers`, `endoscopy_records`; `rheumatology_registers`, `joint_assessments`, `dmard_records`; `haematology_registers`; `urology_registers`; `physio_referrals`, `physio_sessions`; `endocrine_registers`; `ncd_comorbidity_profiles` (17 tables total) |
| `who_partograph` | `partograph_sessions` (labour start, admission cervix dilation, station); `partograph_observations` (time-series: cervical dilation, descent, FHR, contractions, moulding, liquor, oxytocin, drugs, BP, pulse, temperature, urine); alert line and action line computed per-session |
| `radiology_notifications` | `radiology_report_notifications` (report_id, ordered_by, notified_at, channel, critical_flag); `notification_sent_at`, `notification_channel` columns on `imaging_reports` |
| `sprint232_cathlab_core` | `cathlab_cases` (procedure, urgency, operator, anaesthetist, access site, contrast used, fluoro time, complications, outcome); `cathlab_vessels` (per-case lesion: vessel, stenosis%, TIMI pre/post, intervention, stent); `cathlab_stemi_activations` (door-to-balloon timer, ECG-to-device, outcome); `cathlab_scheduling` (slot assignment, room, priority) |
| `sprint233_cathlab_ai` | `cathlab_risk_assessments` (ACS risk %, contrast nephropathy risk, bleeding risk, generated risk tier); `cathlab_ai_recommendations` (real-time guidance payloads) |
| `sprint234_icu_core` | `icu_beds` (room, bed number, ventilator-capable flag); `icu_admissions` (APACHE II, SOFA, admission source, ventilated flag); `icu_fluid_balance` (intake/output time-series); `icu_vasopressors` (drug, dose, unit, start/stop); `icu_ventilator` (mode, settings, FiO₂, RSBI, compliance); `icu_daily_scores` (APACHE II, SOFA, GCS, NEWS2, sepsis_bundle_done, VAP_bundle_done, DVTPE_bundle_done, glycaemic_control) |
| `sprint235_icu_ai_quality` | `icu_ai_alerts` (type, severity, message, resolved flag) |
| `sprint236_nicu_core` | `nicu_admissions` (gestational age, birth weight, Apgar, incubator); `nicu_phototherapy` (bilirubin pre/post, lamp type, hours, outcome); `nicu_kmc` (duration minutes, weight pre/post, temperature); `nicu_feeds` (route, type, prescribed/actual ml, TPN flag); `nicu_drug_doses` (drug, weight-band-computed dose, route, frequency); `nicu_discharge_summaries` (structured neonatal discharge) |
| `sprint237_nicu_advanced` | `nicu_hie` (severity grade, cooling indication, cooling start/end, MRI result, outcome); `nicu_coagulation` (INR, PT, APTT, platelets, fibrinogen, product administered); `nicu_echo_targeted` (PDA size, shunt direction, TAPSE, RVSP, intervention); `nicu_cdss_poct` (test type, result, action triggered) |
| `sprint238_well_baby_clinic` | `well_baby_encounters` (age weeks/months, weight/length/HC, WAZ/HAZ/WHZ/BAZ z-scores, feeding mode); `well_baby_asq3` (domain scores: communication, gross motor, fine motor, problem solving, personal social; flags below cutoff); `well_baby_supplements` (supplement, dose, route, date) |
| `sprint239_epi_immunisation` | `vaccination_records` (antigen, batch, site, route, administered_by, date); `aefi_reports` (adverse event, severity, outcome, reported_to_authorities); `cold_chain_logs` (fridge_id, temperature, timestamp); `vaccination_cohort_coverage` (antigen, period, eligible, vaccinated, coverage_pct) |
| `sprint240_neonatal_screening` | `nbs_results` (test type, result value, unit, reference range, flag, action); `hearing_screening` (method OAE/AABR, ear, result, retest); `cchd_screening` (right hand SpO₂, foot SpO₂, pass flag); `rop_screening` (zone, stage, plus disease, action); `bilirubin_tracking` (TSB, hour of life, Bhutani zone, treatment threshold); `ddh_screening` (hip, Graf class, alpha angle, treatment) |
| `sprint241_dialysis` | `dialysis_sessions` (modality HD/PD/CRRT, machine, access type, duration, blood flow, dialysate, anticoagulant, Kt/V, ultrafiltration, complications, recorded_by); `dialysis_access` (type, side, date inserted, patent flag, interventions) |
| `sprint242_aviation_medicine` | `aviation_ame_registry` (examiner name, licence number, authority, valid until); `aviation_medical_exams` (class 1/2/LAPL, full structured exam data, decision, disqualifying conditions, valid from/until); `aviation_certificates` (generated certificate with audit trail) |
| `sprint243_hyperbaric` | `hbot_sessions` (indication, protocol, chamber pressure, session duration, O₂ percentage, complications, recorded_by); `hbot_wound_outcomes` (wound area series, granulation, infection status) |
| `sprint244_prosthetics` | `prosthetic_patients` (amputation level, side, K-level, aetiology); `prosthetic_devices` (type, manufacturer, serial, fit date, warranty expires); `prosthetic_outcomes` (assessment date, 6MWT, TUG, PLUS-M score) |
| `sprint245_perinatal_mental_health` | `epds_assessments` (10-item responses, total score, flag ≥10 and ≥13 thresholds, bonding subscore, safeguarding flag, clinician reviewed flag); `pmh_referrals` (referral type, urgency, outcome) |
| `sprint246_nicu_followup` | `nicu_followup_register` (corrected age tracking, prematurity degree, discharge diagnosis, assigned clinician); `nicu_followup_assessments` (Bayley cognitive/language/motor domain scores, visit date, milestone flags); `nicu_followup_schedule` (scheduled visits with auto-generated `is_overdue` generated column); `nicu_imaging_results` (cranial US and MRI series) |
| `sprint247_patient_transport` | `transport_fleet` (vehicle registration, type, capacity, maintenance due); `transport_requests` (origin/destination facility, patient id, level of care, reason, urgency, assigned vehicle, dispatch timestamps); `transport_handovers` (clinical summary PDF, receiving staff signature) |
| `sprint248_aesthetics` | `aesthetics_treatments` (procedure category, specific procedure, Fitzpatrick type, contraindications screened, pre/post photo MinIO keys, consent form id, session date, next session date, outcome); `aesthetics_schedules` (interval-based appointment series) |
| `sprint249_paediatric_cardiology` | `paed_cardiology_register` (CHD diagnosis, anatomy, shunt direction, genetic syndrome, antenatal detection, current status); `paed_echo_reports` (structured echo data: LV dimensions, EF, SF auto-computed, PASP, generated `has_pulmonary_hypertension`; defect measurements); `paed_cardiology_interventions` (procedure type, date, surgeon, outcome); `paed_cardiology_followup` (visit date, corrected age, auto-generated `is_overdue`); `sbe_prophylaxis_records` (indication, procedure, antibiotic prescribed) |
| `sprint230_occupational_medicine_core` | `oem_employers` (NSSA number, industry sector, contracted services); `oem_employee_links` (patient-to-employer, job title, department, hazard class); `oem_encounters` (pre-employment/periodic/exit/FFD visit, exam findings); `oem_certificates` (FFD category, restrictions, valid until, issued by) — includes status triggers for is_active |
| `sprint231_occ_surveillance_rtw` | `oem_hazard_profiles` (employer hazards with type, OEL, BEI, control measures); `oem_exposure_records` (measured value, unit, generated `exceeds_oel`); `oem_biological_monitoring` (analyte, specimen, result, generated `exceeds_bei`); `oem_surveillance_schedule` (due date, generated `is_overdue`, generated `days_overdue`); `oem_rtw_plans` (restriction codes, graded return, employer_signed_at, status) |
| `nc_datim_ext_indicators` | `tb_preventive_therapy`, `hts_self_tests`, `eid_results` — extends DATIM MER 3.0 with TB_TB, TB_STAT, TB_ART, TB_PREV, PMTCT_EID, PMTCT_FO, HTS_SELF indicators (S231) |
| `nc_outcome_linkage` | `encounter_outcomes` (diagnosis, outcome code, follow-up required flag); `outcome_follow_up_schedules` (expected visit, interval days, status); LTFU detection and readmission auto-classification triggers (S230) |
| `nc_nutrition_followup` | `nutrition_followup_visits` (weeks post-discharge, MUAC, weight, oedema, outcome); `nutrition_relapse_events` (relapse date, weeks post-cure, severity, probable cause) — post-SAM discharge follow-up (S233) |
| `nc_lab_quality_assurance` | `lab_eqa_results` (panel, scheme, score, status); `lab_internal_qc_failures` (analyte, failure type, corrective action); `lab_critical_notifications` (patient, result, notified_at, minutes_to_notify); `lab_tat_records` (order_to_result hours) (S233) |
| `nc_mdsr_workflow` | `mdsr_reviews` (maternal death, date, cause, ICD-10, three-delay classification, preventability); `mdsr_action_items` (responsible officer, due date, status, overdue flag); `mdsr_annual_summary` view (S234) |
| `nc_care_gap_tracking` | `care_gaps` (gap type, patient, priority, status, due date, dismissed_until); `care_gap_interventions` (action taken, outcome, resolved_at); composite AI-recommended action fields (S235) |
| `nc_ai_performance_registry` | `ai_predictions` (model, patient, predicted value, confidence, features); `ai_model_performance_snapshots` (period, AUC, calibration slope, Brier score, fairness metrics by subgroup) (S235/S242) |
| `nc_ai_governance_log` | `ai_model_governance_log` (model, action: review_requested / status_updated / calibration_run, performed_by, notes, timestamp) (S242) |
| `nc_equity_analytics` | `equity_disaggregation_snapshots` (indicator, period, stratum type: age_sex / district / insurance, stratum, value, national_avg, disparity_flag) (S236) |
| `nc_benchmarking` | `facility_benchmarks` (indicator, period, facility_value, district_avg, national_avg, percentile_rank, above_district flag) (S237) |
| `nc_dhis2_validation` | `dhis2_validation_snapshots` (data element, period, dhis2 value, local value, deviation_pct, outlier_flag, outlier_severity, resolved_at, resolved_by, resolution) (S241) |
| `nc_s243_research_portal` | `research_cohort_queries` (SQL-safe JSONB definition, field whitelist); `research_portal_tokens` (hashed token, uses remaining, expires_at); `research_access_log` (query, token, record count, export format, accessed_at) (S243) |
| `nc_oncology_outcomes` | `oncology_survival_cohorts` (diagnosis, stage, regimen, start date, survival status); `oncology_abandonment_events`; `oncology_near_miss_events` (S239) |
| `nc_oem_longitudinal` | `oem_longitudinal_health` (annual aggregates of audiometry, spirometry, bio-monitoring per employee) (S239) |
| `nc_pharmacy_intelligence` | `pharmacy_formulary_adherence` (period, on/off formulary counts, adherence_pct); `pharmacy_waste_events` (drug, quantity, value, reason); `ams_approvals` (antibiotic, indication, approver, DDD) (S240) |

### System-level column additions (via `ensureSubscriptionSchema()`)

- `staff.preferred_language` — staff UI language preference
- `staff.is_health_educator` — grants access to health education authoring

---

## Registered Controllers (`services/ehr-service/src/ehr.module.ts`)

Every controller must appear in `controllers: []`.

| Controller | Route prefix | Notes |
|---|---|---|
| `CdpaController` | `/cdpa` | CDPA compliance |
| `PsychosocialController` | `/psychosocial` | Adolescent HIV, GBV, disclosure |
| `EmpowermentController` | `/empowerment` | WEEP/MEEP, support groups |
| `TrainingController` | `/training` | CPD courses and certificates |
| `ResearchController` | `/research` | Cascade, retention, cohorts |
| `ResearchDayController` | `/research-day` | De-identified public portal |
| `UssdController` | `/ussd` | Africa's Talking USSD webhook |
| `SmsCampaignController` | `/sms` | Bulk SMS campaigns |
| `PreferencesController` | `/preferences` | Language and communication prefs |
| `BreachDetectionController` | `/security` | Anomaly detection, breach lifecycle |
| `SyncController` | `/sync` | Offline conflict resolution |
| `ClinicalSpecialtiesController` | `/clinical` | Dental, growth, ANC/EID |
| `WebAuthnController` | `/auth/webauthn` | FIDO2 hardware token MFA |
| `ConsentController` | `/consent` | CDPA per-patient consent records |
| `PatientPortalHivController` | `/patient-portal` | MMD, support groups, comms prefs, ANC/EID, growth, dental, flags |
| `HealthEducationController` | `/health-education` | Staff course authoring (requires `is_health_educator`) |
| `PatientPortalHealthEducationController` | `/patient-portal/education` | Patient course enrollment and progress |
| `StoreroomController` | `/storeroom` | Multi-location inventory, catalog, stock, transfers, requests, expiry/FEFO, emergency kits, ARV/chemo, procurement, AI intelligence (forecast, anomalies, reorder, expiry risk), drug substitution |
| `ConflictResolutionController` | `/conflict-queue` | Safety-critical sync conflict queue — list, resolve (keep server / keep client), patient-scoped view, badge count |
| `CheckinController` | `/checkin` | QR token generation, token redemption on nurse scan, today's waiting queue |
| `PreVisitIntakeController` | `/intake` | Token-gated pre-visit form fetch, patient submission, encounter sync, intake status badge |
| `DischargeController` | `/encounters/:id/discharge` | Finalise and push discharge documents to patient app |
| `PatientDischargeController` | `/patient/discharge-documents` | Patient portal discharge document list and presigned download URLs |
| `WearableController` | `/wearable` | Device registration, reading ingestion with auto-flagging, 7-day timeline, trend alert management |
| `ProRiskController` | `/risk` | High-risk patient list, per-patient score history, outreach task management |
| `InAppPaymentController` | `/payments/patient` | Patient-facing invoice list, EcoCash/OneMoney payment initiation, transaction status polling |
| `QueueController` | `/queue` | Enqueue patient, update status, real-time WebSocket broadcasts via QueueGateway |
| `TheatreController` | `/theatre` | Theatre room listing, case scheduling, day schedule (Gantt), utilisation metrics, case start/end/cancel |
| `CsatController` | `/csat` | Post-visit survey dispatch (SMS + push), token-gated survey fetch and submission, aggregate and per-clinician stats |
| `WardRoundController` | `/ward` | Inpatient census, admissions, bedside SOAP note save/load, order creation and retrieval |
| `HouseholdRiskController` | `/household` | Household creation and assignment, family linking, diagnosis propagation, alert management |
| `DigitalConsentController` | `/consent` | Consent request creation, token-gated form fetch, e-signature submission → PDF → MinIO, encounter consent status |
| `CrossFacilityStockController` | `/network/stock` | Cross-tenant stock level aggregation, AI rebalancing recommendations, transfer order lifecycle |
| `OrthopaedicsController` | `/orthopaedics` | Fracture/trauma register, joint replacement records (THA/TKA), Gustilo-Anderson urgency, Wells DVT, rehab plan |
| `EntController` | `/ent` | ENT visits, audiogram records with PTA auto-classification, Centor score, rhinosinusitis triage |
| `GastroenterologyController` | `/gastroenterology` | Gastro register, endoscopy records, Rockall score, Child-Pugh cirrhosis classification, dyspepsia algorithm |
| `RheumatologyController` | `/rheumatology` | Joint assessments with DAS28-ESR, DMARD records, treat-to-target algorithm, gout protocol, biologic pre-screen |
| `HaematologyController` | `/haematology` | Haematology register, anaemia MCV workup, transfusion threshold, Ann Arbor lymphoma staging |
| `UrologyController` | `/urology` | Urology register, IPSS BPH management, renal stone algorithm, PSA age-adjusted thresholds |
| `PhysiotherapyController` | `/physiotherapy` | Cross-specialty rehab referrals, session tracking, Barthel stroke rehab, LVEF-aware cardiac rehab |
| `EndocrinologyController` | `/endocrinology` | Endocrine register, thyroid algorithm (TSH/FT4), adrenal crisis protocol, levothyroxine dosing |
| `NcdComorbidityController` | `/ncd-comorbidity` | Unified NCD profile aggregating DM/CKD/CVD/retinopathy; Framingham CVD risk; cross-module sync alerts |
| `AhfozClaimsController` | `/claims/ahfoz` | AHFoZ tariff code search, itemised claim line management, claim total computation |
| `RemittanceController` | `/claims/remittance` | ERA/CSV remittance import, claim matching, aged claims report, claims CSV export |
| `MedicalAidEligibilityController` | `/medical-aid/eligibility` | Per-tenant provider config, real-time eligibility check via configured insurer endpoint |
| `McazController` | `/mcaz` | Facility licence, pharmacist registration, controlled substance dispensing log, returns register |
| `NotificationCenterController` | `/notifications/config` | Per-tenant trigger configuration, manual reminder composer, notification audit log |
| `SubscriptionPlansController` | `/subscription-plans` | Plan tier listing, tenant usage meter read, upgrade/downgrade, limit enforcement |
| `WhoPartographController` | `/maternity/partograph` | Partograph session creation, time-series observation recording, alert/action line computation |
| `RadiologyNotificationsController` | `/radiology/notifications` | Report finalisation notifications (push + SMS) to ordering clinician; critical finding alerts |
| `CathLabController` | `/cathlab` | Case scheduling, procedure records, per-vessel lesion register, STEMI activation log |
| `CathLabAiController` | `/cathlab/ai` | AI risk stratification (ACS, contrast nephropathy, bleeding), real-time CathLab AI recommendations |
| `IcuController` | `/icu` | Bed registry, admissions with APACHE II/SOFA, fluid balance, vasopressors, ventilator, daily quality scores |
| `IcuAiController` | `/icu/ai` | AI sepsis alerts, deterioration detection, bundle compliance monitoring |
| `NicuController` | `/nicu` | Admissions, phototherapy, KMC, feeds, neonatal drug dosing, discharge summaries |
| `NicuAdvancedController` | `/nicu/advanced` | HIE grading + cooling, coagulation management, targeted neonatal echo, neonatal POCT |
| `WellBabyController` | `/well-baby` | Well-child encounters with WHO z-scores, ASQ-3 developmental screening, supplements |
| `ImmunisationController` | `/immunisation` | Zimbabwe EPI schedule, catch-up computation, cold-chain log, AEFI recording, cohort coverage analytics |
| `NeonatalScreeningController` | `/neonatal-screening` | NBS heel-prick, OAE/AABR hearing, CCHD pulse-ox, ROP, bilirubin Bhutani, DDH ultrasound |
| `DialysisController` | `/dialysis` | HD/PD/CRRT session records, Kt/V, vascular access management |
| `AviationMedicineController` | `/aviation-medicine` | AME registry, Class 1/2/LAPL structured medical exams, fitness certificate generation |
| `HyperbaricController` | `/hyperbaric` | HBOT session scheduling, contraindication pre-screen, treatment records, wound outcome tracking |
| `ProstheticsController` | `/prosthetics` | Amputee register, prosthetic device prescription and fitting, K-level outcomes (6MWT/TUG/PLUS-M) |
| `PerinatalMentalHealthController` | `/perinatal-mental-health` | EPDS administration, bonding assessment, safeguarding flags, psychiatric referrals |
| `NicuFollowupController` | `/nicu/followup` | High-risk neonatal follow-up register, Bayley assessments, corrected-age scheduling |
| `PatientTransportController` | `/transport` | Fleet management, inter-facility transfer requests, dispatch workflow, handover records |
| `AestheticsController` | `/aesthetics` | Treatment register, safety screening, photo documentation, interval scheduling, CDSS alerts |
| `PaediatricCardiologyController` | `/paed-cardiology` | CHD register, structured echo reports, intervention log, follow-up scheduling, SBE prophylaxis |
| `OccupationalMedicineController` | `/oem` | Employer register, employee-patient links, FFD encounters, fitness certificates, dashboard |
| `OemSurveillanceController` | `/oem/surveillance` | Hazard profiles, exposure records (`exceeds_oel`), bio monitoring (`exceeds_bei`), overdue surveillance, RTW plans |
| `OutcomeLinkageController` | `/outcomes` | Outcome recording per encounter, follow-up schedule management, LTFU detection, readmission flag, care continuum KPIs (S230) |
| `CascadeAnalyticsController` | `/cascade` | HIV 95-95-95 funnel, PMTCT, TB-HIV, and NCD cascade computation with period + sex/age disaggregation, trend series, gap lists (S232) |
| `EquityAnalyticsController` | `/equity` | Disaggregated indicator snapshots by age/sex/district/insurance; disparity detection; heat-matrix data for VL suppression, ANC, HbA1c control (S236) |
| `BenchmarkingController` | `/benchmarking` | Facility scorecard vs district and national averages; percentile rank computation; DHIS2-sourced peer benchmarks (S237) |
| `MdsrController` | `/mdsr` | MDSR case creation and review; three-delay classification; preventability scoring; action item lifecycle; MOHCC letter generation (S234) |
| `ModuleReportsController` | `/module-reports` | Per-module uplift reports: oncology survival/abandonment, blood bank efficiency, radiology AI concordance, dialysis adequacy, dental outcomes, aviation exam cohort, OEM longitudinal (S239) |
| `Dhis2ValidationController` | `/dhis2-validation` | Nightly outlier sweep; outlier report by period; alert resolution (`PATCH /alerts/:id/resolve`); DQA score computation; element-level validation history (S241) |
| `AiPerformanceController` | `/ai-performance` | Prediction recording; outcome verification; monthly snapshot computation; model performance summary; calibration plots; fairness metrics; governance request/approval workflow (S242) |
| `CareGapController` | `/care-gaps` | Care gap list per patient/cohort; AI-recommended actions; dismiss (30-day) and resolve workflows; gap KPI summary (S235) |
| `PopulationHealthController` | `/population-health` | Population health dashboard; cohort gap closure metrics; disease burden analytics; multi-programme KPI aggregation (S235) |
| `ResearchPortalController` | `/research` | Cohort query builder; HIPAA Safe Harbor de-identification; time-limited access tokens; CSV/FHIR export; access audit log (S243) |
| `ReportExportController` | `/tenants/:id/exports` | `POST /pdf`, `POST /xlsx`, `POST /csv`, `POST /monthly-bundle` — branded UMOYA PDF reports, Excel XLSX, CSV, and zipped monthly bundle (S245) |

---

## EHR Service Rules

- All controllers must be registered in `services/ehr-service/src/ehr.module.ts` in `controllers: []`.
- Staff endpoints use `@UseGuards(JwtAuthGuard)`. `tenantId` from `X-Tenant-ID` header → `req.tenantId`. Tenant DB at `req.tenantDb`.
- Patient portal endpoints use `@UseGuards(PatientJwtAuthGuard)`. Patient identity at `req.patientId` — never `req.user.sub`.
- DB queries: `db.query(sql, params)` returns a plain array (not `{ rows }`). Use `rows[0] ?? null` for single-row semantics.
- No DatabaseService wrapper — inject `db: any` and call `db.query()` directly.
- No Bull queue inside `ehr-service`.

---

## CDSS Clinical Safety Governor

Deterministic patient-safety layer that overrides probabilistic AI output. Lives in
`services/cdss-service/clinical_safety.py` (pure, fully unit-tested in
`tests/test_clinical_safety.py`, gated in CI).

- `extract_vitals()` normalises raw vitals (parses `"195/115"` BP, glucose mg/dL→mmol/L when >45).
- Deterministic scorers: `compute_qsofa()`, `compute_sirs()`, `screen_dka_hhs()` (ADA-correct),
  `severe_pain()`, `critical_flags()` (SpO2<90, SBP>180, DBP>120, RR>24, HR>130, temp≥39.5).
- `evaluate()` returns acute state (`ACUTE_DETERIORATION`/`STABLE`), aggregate severity,
  `syndrome_alerts`, `mortality_risk` (NEWS2/RCP-2017 band), labelled `risk_domains`
  (acute-deterioration vs mortality — never conflated with readmission), and a deterministic
  `copilot_summary`.
- `apply_safety_governor(response_data, vitals)` — wired into `POST /risk/calculate`: when the
  patient is acutely deteriorating it forces `risk_level='critical'`, sets
  `risk_model_conflict=true`, suppresses the readmission/discharge assessment, and replaces
  recommendations with escalation guidance + a `governor_banner`. **This is the contract: AI
  risk output must never present "low/discharge" for a patient flagged acute.**
- `POST /clinical/safety-eval` exposes `evaluate()` directly; surfaced on web
  (`VitalsPanel.tsx`) and mobile (`NurseVitalsScreen.tsx`) via the shared `/cdss/safety-eval`
  proxy. Copilot "Accept" is interlocked (disabled until rationale entered) during acute states.

---

## Clinical LLM Backend

Pluggable LLM provider in `services/ehr-service/src/services/clinical-llm.service.ts`, selected
by `CLINICAL_LLM_BACKEND` = `ollama` | `aws_bedrock` | `anthropic` | `azure_openai` (env vars in
`.env.example`). Default local dev = **Ollama** (`llama3.1:latest` on the host). HIPAA-eligible
production = **AWS Bedrock** (Claude 3.5 Sonnet).

**Bedrock auth is credential-free where possible** — use an EC2 instance role, or a `~/.aws`
profile that assumes the scoped role; never hardcode `AWS_ACCESS_KEY_ID`/`SECRET` in code or
`.env`. The IAM policy is least-privilege (Bedrock `InvokeModel` on the one model ARN only).

Reference resources (account `505887203685`, `us-east-1`):

| Resource | ARN / name |
|---|---|
| IAM role | `arn:aws:iam::505887203685:role/hipaa-ehr-bedrock-role` |
| IAM policy | `hipaa-ehr-bedrock-policy` (Bedrock `InvokeModel` only) |
| Model | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| KMS CMK | `arn:aws:kms:us-east-1:505887203685:key/2fbea39a-67ad-4f11-a459-e7707e33b34f` |

**Production HIPAA controls still OPEN before go-live** (BAA, KMS-at-rest, TLS, least-privilege
IAM, and role-based auth are already in place):

- Disable root account access keys; enable MFA on root.
- Enable CloudTrail audit logging.
- Use VPC PrivateLink endpoints for Bedrock (set `BEDROCK_ENDPOINT_URL`).
- Implement PHI de-identification in the prompt layer before sending to any external model.
- Recreate the KMS CMK for production; rotate deploy credentials every 90 days.

---

## Patient Portal Rules

- All protected routes require `PatientJwtAuthGuard`.
- `PatientJwtAuthGuard` sets `request.patientId = tokenType === 'caregiver' ? user.patientId : user.sub`.
- Every patient DB query must filter by `patient_id`.
- API client in `patient-portal/src/services/api.ts` uses `patientPortalApi` pattern with `(token, tenantSlug)` params.
- Routes follow `/:tenantSlug/<resource>` pattern under `<ProtectedRoute requireLinked>`.
- i18n: 8 locale files under `patient-portal/public/locales/{en,sn,nd,pt,fr,sw,zu,af}/translation.json`.

---

## Mobile Rules

- Use the existing `api` client in `mobile/src/services/api.ts`. Do not create a new Axios instance.
- i18n: `mobile/src/i18n/index.ts`. Add new translation keys to all 8 locale files under `mobile/src/i18n/locales/`.
- Offline queue: `mobile/src/services/offlineQueue.ts`. Offline cache: `mobile/src/services/offlineCache.ts`.

---

## Rules For All Agents

- Never delete existing modules, routes, or navigation items.
- Never rename existing TypeORM entities, columns, or API routes.
- Never add a NestJS controller without registering it in the module's `controllers: []`.
- Never add a new `tenants` table column without a safe migration in `ensureSubscriptionSchema()`.
- Never create a per-tenant table without a provisioning bundle in `getProvisioningBundles()`.
- Never use bare `CREATE TABLE` or `CREATE INDEX` — always use `IF NOT EXISTS` variants.
- Never expose PHI in admin or rollout views.
- Every new field on `Tenant` entity must also appear in `CreateTenantDto` and `UpdateTenantDto` as `@IsOptional()`.

---

## Stop Conditions

Stop and ask before:

- Changing JWT auth or tenant isolation logic.
- Changing billing calculations or subscription state machine.
- Changing clinical safety logic (drug interactions, CDSS hard-stops).
- Changing database provisioning scripts in ways that could drop or truncate data.
- Rewriting navigation from scratch in any app.
