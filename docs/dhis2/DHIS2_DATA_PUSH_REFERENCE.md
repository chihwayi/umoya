# Medicore → DHIS2 Data Push Reference

Status: Draft v1.1 (D4 live validated)
Date: 2026-03-10
Scope: Tenant/clinic-based sync to DHIS2 `2.40.0` (local UI `http://localhost:8888`, container target `http://host.docker.internal:8888`)

## 1. Purpose

This document is the canonical reference for:
- what Medicore data is currently captured,
- which datasets/indicators we will push to DHIS2,
- how each tenant maps to DHIS2 org units and credentials,
- what is in-scope now vs later.

## 2. Tenant Mapping Model (Authoritative)

For every Medicore tenant (clinic):
- one tenant context (`X-Tenant-Id`)
- one DHIS2 org unit (`org_unit_id`)
- one DHIS2 auth binding (PAT first, basic fallback)
- one indicator/data-element mapping package

Binding record (master DB): `tenant_dhis2_config`
- `tenant_id`
- `base_url`
- `api_version`
- `auth_type` (`pat` | `basic`)
- `pat` or `username/password`
- `org_unit_id`
- `tracked_entity_type_id`
- `dataset_id` (optional default)
- `enabled`

## 3. Medicore Data Inventory (What We Can Push)

Data capture is provisioned via tenant database bundles in
`services/tenant-service/src/services/database-provisioning.service.ts`.

Core/high-readiness domains:
- Patient registry: `patients`
- Encounters: `appointments`, `medical_records`
- Vitals: `vitals`
- Lab: `lab_orders`, `lab_results`, `lab_test_catalog`, `lab_critical_alerts`
- Pharmacy: `pharmacy_inventory`, `pharmacy_dispensings`, `pharmacy_stock_movements`
- Maternal/Newborn: `maternity_enrollments`, `anc_visits`, `deliveries`, `birth_outcomes`, `postnatal_visits`
- HIV program: `hiv_care_enrollments`, `hiv_clinical_visits`, `hiv_eac_sessions`, `tb_screenings`
- Immunization: `immunizations`, `immunization_forecasts`, `immunization_registry_submissions`
- Inpatient/ADT: `admissions`, `discharges`, `patient_transfers`, `census_snapshots`
- Emergency: `ed_visits`, `ed_triage_assessments`, `ed_dispositions`, `ed_metrics`
- Population health: `chronic_disease_registry`, `preventive_care_reminders`, `recall_lists`

## 4. Global Indicator Reference Set (for DHIS2 Mapping)

Priority set chosen from WHO/UNAIDS core frameworks for national and facility reporting:
- WHO Global Reference List of 100 Core Health Indicators (plus health-related SDGs)
- WHO PHC measurement framework indicators
- UNAIDS indicator registry / GAM structure
- WHO TB indicator metadata and global monitoring definitions
- WHO malaria indicator metadata
- WHO immunization coverage definitions (including DTP3)

## 5. DHIS2 Push Package (v1)

## 5.1 Tracker Pushes

### A) `MC_PATIENT_TRACKER`
Entity: Patient TEI

TEI attributes (minimum):
- patient number
- first name
- last name
- sex
- date of birth
- national ID (if available)
- phone (optional)

Source:
- `patients.patient_number`, `first_name`, `last_name`, `gender`, `date_of_birth`, `id_number`, `phone`

### B) `MC_CLINICAL_EVENT_TRACKER` (phase 2)
Events linked to TEI:
- visit completion
- major diagnoses/procedures
- selected lab critical alerts
- selected HIV/maternity events

## 5.2 Aggregate Datasets

### Dataset 1: `MC_SERVICE_DELIVERY_MONTHLY`
Cadence: Monthly
Disaggregation: tenant/org unit, sex, age band (where feasible)

Indicators:
- OPD consultations total
- OPD completed consultations
- New patients registered
- Follow-up visits
- Admissions
- Discharges
- ED visits
- ED LWBS count/rate
- Average door-to-provider (ED)

Primary sources:
- `appointments`, `patients`, `admissions`, `discharges`, `ed_visits`

### Dataset 2: `MC_MATERNAL_NEWBORN_MONTHLY`
Cadence: Monthly

Indicators:
- ANC 1+ coverage
- ANC 4+ coverage
- ANC 8+ coverage
- Total deliveries
- Caesarean section rate
- Live births
- Stillbirths
- Low birth weight count/rate

Primary sources:
- `maternity_enrollments`, `anc_visits`, `deliveries`, `birth_outcomes`
- existing metric methods in `maternity.service.ts`

### Dataset 3: `MC_HIV_MONTHLY_RETURN`
Cadence: Monthly

Indicators (initial high-value subset):
- PLHIV active in care
- ART coverage among active enrollments
- Viral load suppression (<1000 copies/mL)
- Undetectable VL (<50)
- LTFU rate
- Treatment failure rate (>1000 VL)
- TB screening among PLHIV

Primary sources:
- `hiv_care_enrollments`, `hiv_clinical_visits`, `hiv_eac_sessions`, `tb_screenings`
- existing calculators in `hiv-quality-metrics.service.ts` and monthly return service

### Dataset 4: `MC_IMMUNIZATION_MONTHLY`
Cadence: Monthly

Indicators:
- DTP1 administered count
- DTP3 administered count
- Measles-containing vaccine dose 1 count
- Fully immunized child proxy count (site-defined)
- AEFI reports count

Primary sources:
- `immunizations`, `vaccine_adverse_events`, `immunization_registry_submissions`

### Dataset 5: `MC_PHARMACY_STOCK_MONTHLY` (phase 2)
Cadence: Monthly

Indicators:
- tracer medicines stock on hand
- stock-out days (tracer set)
- dispensed units by drug group

Primary sources:
- `pharmacy_inventory`, `pharmacy_stock_movements`, `pharmacy_dispensings`

## 6. Indicator Mapping Template (Use Per Data Element)

For each DHIS2 data element we maintain:
- `indicator_code`
- `indicator_name`
- `global_reference` (WHO/UNAIDS/TB/malaria/etc.)
- `numerator_sql`
- `denominator_sql` (if rate)
- `source_tables`
- `period_type`
- `disaggregations`
- `qa_rules`

## 7. Gaps (Known)

Before full national indicator parity, we still need:
- standardized age/sex/disability disaggregation dictionary across all modules,
- finalized TB case notification/outcome tables for full TB routine reporting,
- full denominator alignment for immunization coverage (catchment estimates),
- explicit metadata registry linking Medicore indicator code ↔ DHIS2 data element UID.

## 8. Delivery Rules

- Multi-tenant isolation is mandatory: no cross-tenant data writes.
- If tenant config missing or disabled, DHIS2 sync returns `not_configured` and does not push.
- Idempotency required for tracker entities and periodic aggregate submissions.
- DB changes must be done through provisioning/schema process, not ad-hoc manual SQL.
- Sync observability is stored in tenant DB `dhis2_sync_log` with `entity_type` values:
  - `patient` (TEI create/update),
  - `event` (program stage event push),
  - `aggregate` (aggregate DataValueSet push),
  - `data_value_set` (explicit data-values endpoint push).

## 9. External References

- WHO Global Reference List of 100 Core Health Indicators (2018):
  `https://iris.who.int/handle/10665/259951`
- WHO PHC Measurement Framework and Indicators (2022):
  `https://iris.who.int/handle/10665/352686`
- UNAIDS Indicator Registry:
  `https://indicatorregistry.unaids.org/`
- WHO TB indicator metadata (incidence/treatment success):
  `https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/tuberculosis`
- WHO malaria incidence indicator:
  `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/malaria-incidence-(per-1-000-population-at-risk)`
- WHO DTP3 indicator metadata:
  `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/diphtheria-tetanus-toxoid-and-pertussis-(dtp3)-immunization-coverage-among-1-year-olds-(-)`

## 10. Live Validated Package (Tenant `testghost2`)

Validated on 2026-03-10:
- patient sync: success (idempotent update path confirmed),
- tracker event sync: success (program enrollment auto-created when missing),
- aggregate sync: success with period fallback from rejected `202603` to DHIS2-allowed `202602`.

Bootstrap IDs currently used:
- org unit: `kuDwB5vB5lm`
- tracked entity type: `iWmMSizGfd2`
- dataset: `H4IexxHRXIi`
- program: `jAl3ZnTYssZ`
- program stage: `agwBZMJuU7O`

Tracker event data element IDs:
- `MC_DE_EVENT_VISIT_TYPE`: `UMihKZi73GO`
- `MC_DE_EVENT_PRIMARY_DIAGNOSIS`: `QeOHJlyaSG2`
- `MC_DE_EVENT_CLINICAL_NOTES`: `tDFQWdzY69z`

## 11. Multi-Tenant Isolation Validation

Validated on 2026-03-10 using two active tenants:
- `testghost` -> org unit `tRMlWBGMtE1`
- `testghost2` -> org unit `kuDwB5vB5lm`

Validation method:
- push `data-values` for same data element (`W3hr49L40r0`) and period (`202602`) from each tenant with different values,
- confirm DHIS2 stores tenant A value only in tenant A org unit and tenant B value only in tenant B org unit.

Observed values in DHIS2:
- org unit `tRMlWBGMtE1`: value `111`
- org unit `kuDwB5vB5lm`: value `222`

Conclusion:
- tenant/org-unit write isolation is confirmed for aggregate/data-value submission path.
