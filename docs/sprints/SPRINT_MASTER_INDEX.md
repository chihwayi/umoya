# Umoya Sprint Master Index — Occupational Medicine · TraumaZim · Baby Clinic Gap Closure

**Sprint series:** S230–S249 (20 sprints)  
**Created:** 2026-06-23  
**Source doc:** `docs/GAP_ANALYSIS_OCC_TRAUMA_BABY.md`  
**Last confirmed sprint before this series:** S229 (Radiology Feedback Trigger, bundle `sprint229_radiology_feedback_trigger`)

---

## Cornerstone Rules (apply to EVERY sprint in this series)

1. **Provisioning** — every bundle uses `gen_random_uuid()`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE TRIGGER`, version `YYYY.MM.DD.N`. Run `npm run test:smoke` before merge. CI image must be `pgvector/pgvector:pg15`.
2. **UI/UX Colors** — web uses `#0AA98A` (teal), `#1B6B3A` (forest), `#080E1A` (deep), `#E8614D` (coral), `#F0954A` (amber). Cards: `bg #111E35`, border `1px solid #162440`, `border-radius: 14px`. Font: `Plus Jakarta Sans`.
3. **Mobile** — every sprint with a clinical workflow MUST include a screen in `mobile/src/screens/`. Use `C`, `FONT`, `RADIUS`, `SHADOW` from `mobile/src/design/tokens`. API via `import { api } from '../services/api'`. Register route in `mobile/src/navigation/RootNavigator.tsx`.
4. **CDSS/AI** — new Python scoring functions live in `services/cdss-service/`. Expose via new endpoint on `main.py` router. Front-end surfaces CDSS via existing `/cdss/*` proxy in `ehr-frontend`.

---

## Sprint List

| Sprint | File | Module Key Added | Mobile Screen | Priority |
|---|---|---|---|---|
| S230 | [S230_OCCUPATIONAL_MEDICINE_CORE.md](./S230_OCCUPATIONAL_MEDICINE_CORE.md) | `occupational_medicine` | `OccupationalMedicineScreen.tsx` | P1 |
| S231 | [S231_OCC_SURVEILLANCE_RTW.md](./S231_OCC_SURVEILLANCE_RTW.md) | — (extends S230) | `OccSurveillanceScreen.tsx` | P1 |
| S232 | [S232_CATHLAB_CORE.md](./S232_CATHLAB_CORE.md) | `cathlab` | `CathLabScreen.tsx` | P1 |
| S233 | [S233_CATHLAB_AI.md](./S233_CATHLAB_AI.md) | — (extends S232) | `StemiAlertScreen.tsx` | P1 |
| S234 | [S234_ICU_CORE.md](./S234_ICU_CORE.md) | `intensive_care` | `IcuBedScreen.tsx` | P1 |
| S235 | [S235_ICU_AI_QUALITY.md](./S235_ICU_AI_QUALITY.md) | — (extends S234) | `IcuHandoverScreen.tsx` | P1 |
| S236 | [S236_NICU_CORE.md](./S236_NICU_CORE.md) | `nicu` | `NicuAdmissionScreen.tsx` | P1 |
| S237 | [S237_NICU_ADVANCED.md](./S237_NICU_ADVANCED.md) | — (extends S236) | `NicuFeedsScreen.tsx` | P1 |
| S238 | [S238_WELL_BABY_CLINIC.md](./S238_WELL_BABY_CLINIC.md) | `well_baby_clinic` | `WellBabyScreen.tsx` | P1 |
| S239 | [S239_EPI_IMMUNISATION.md](./S239_EPI_IMMUNISATION.md) | `immunisation` | `VaccinationCardScreen.tsx` | P1 |
| S240 | [S240_NEONATAL_SCREENING.md](./S240_NEONATAL_SCREENING.md) | — (extends `nicu` + `well_baby_clinic`) | `NewbornScreenScreen.tsx` | P1 |
| S241 | [S241_DIALYSIS.md](./S241_DIALYSIS.md) | `dialysis` | `DialysisSessionScreen.tsx` | P2 |
| S242 | [S242_AVIATION_MEDICINE.md](./S242_AVIATION_MEDICINE.md) | `aviation_medicine` | `AviationMedScreen.tsx` | P2 |
| S243 | [S243_HYPERBARIC.md](./S243_HYPERBARIC.md) | `hyperbaric` | `HyperbaricScreen.tsx` | P2 |
| S244 | [S244_PROSTHETICS.md](./S244_PROSTHETICS.md) | `prosthetics_orthotics` | `ProstheticsScreen.tsx` | P2 |
| S245 | [S245_PERINATAL_MENTAL_HEALTH.md](./S245_PERINATAL_MENTAL_HEALTH.md) | — (extends `maternity`) | `EpdsScreen.tsx` | P2 |
| S246 | [S246_NICU_FOLLOWUP.md](./S246_NICU_FOLLOWUP.md) | `nicu_followup` | `NicuFollowUpScreen.tsx` | P2 |
| S247 | [S247_PATIENT_TRANSPORT.md](./S247_PATIENT_TRANSPORT.md) | `patient_transport` | `AmbulanceDispatchScreen.tsx` | P2 |
| S248 | [S248_AESTHETICS.md](./S248_AESTHETICS.md) | `aesthetics_regenerative` | `AestheticsScreen.tsx` | P3 |
| S249 | [S249_PAEDIATRIC_CARDIOLOGY.md](./S249_PAEDIATRIC_CARDIOLOGY.md) | `paediatric_cardiology` | `PaedCardioScreen.tsx` | P3 |

---

## Dependency Chain

```
S230 → S231 (RTW depends on employer & exposure tables from S230)
S232 → S233 (CathLab AI depends on procedure tables from S232)
S234 → S235 (ICU AI depends on ventilator/fluid tables from S234)
S236 → S237 (NICU feeds/drugs depend on admission tables from S236)
S236 → S240 (neonatal screening needs nicu_admissions table)
S238 → S240 (well-baby needs patient + growth tables from S238)
S238 → S245 (EPDS extends well-baby encounter form)
S236 → S246 (NICU follow-up needs nicu_admissions history)
S232 → S234 (ICU needs theatre/OR table — already exists from sprint226)
```
