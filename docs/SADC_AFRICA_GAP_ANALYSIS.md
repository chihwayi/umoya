# MediCore — SADC & Africa Health Systems Gap Analysis

**Date:** 2026-04-09
**Scope:** 16 SADC member states + broader African continent
**Purpose:** Identify missing features, integrations, and workflows required for full SADC/Africa coverage

---

## Table of Contents

1. [MediCore Current Inventory](#1-medicore-current-inventory)
2. [SADC Country Health System Profiles](#2-sadc-country-health-system-profiles)
3. [Africa Health System Context](#3-africa-health-system-context)
4. [Gap Analysis — What Is Missing](#4-gap-analysis--what-is-missing)
   - [Critical Gaps](#-critical-gaps-must-have-for-sadcafrica)
   - [Important Gaps](#-important-gaps-high-value-for-sadc)
   - [Enhancement Opportunities](#-enhancement-opportunities-differentiators)
5. [Inventory vs. Gap Corrections](#5-inventory-vs-gap-corrections)
6. [Priority Sprint Roadmap](#6-priority-sprint-roadmap)
7. [Coverage Scorecard](#7-coverage-scorecard)

---

## 1. MediCore Current Inventory

### Architecture Overview

| Layer | Technology |
|---|---|
| EHR Service | NestJS (TypeScript), Port 3013 |
| CDSS Service | FastAPI (Python 3.11), Port 8000 |
| Tenant Service | NestJS (TypeScript), Port 3001 |
| EHR Frontend | React 18/19 + TypeScript + Tailwind CSS |
| Patient Portal | React 19, Port 3015 |
| Mobile App | React Native + Expo (iOS/Android) |
| Databases | PostgreSQL 15 (per-tenant isolation) + pgvector + Redis 7 |
| Storage | MinIO (S3-compatible) |
| Monitoring | Prometheus + Grafana |

### Scale

- 163 EHR Service controllers
- 294 EHR Service business logic classes
- 159 CDSS endpoints
- 58 EHR frontend pages/dashboards
- 37 Patient Portal pages
- 50+ TypeORM database entities
- 25+ disease program modules
- 100+ health standard integrations

### Confirmed Capabilities

**Disease Programs:** HIV/ART (PMTCT, viral load, PEPFAR MER), TB (DOT, regimen, contact risk), Malaria (basic protocols), Diabetes, Hypertension, Cardiology, Oncology, Ophthalmology, Sepsis, Maternity/Obstetrics, Pediatrics, Pulmonology, Palliative, Dermatology, Mental Health (PHQ-9, GAD-7), Geriatrics, ICU, ED/Trauma, Infection Control, Nephrology, Neurology

**Health Standards:** FHIR R4, HL7 v2, SNOMED CT, ICD-10, ICD-11 (prepared), LOINC, RxNorm, CPT/HCPCS, CCDA, CDS Hooks, DHIS2 (aggregate sync), WHO SMART Guidelines (25 domains)

**AI/ML Stack:** ClinicalBERT diagnostics, MedBERT predictor, Fusion engine, RAG (pgvector + BM25 hybrid), Whisper voice scribe (40+ languages), Medical Vision (DICOM AI), LLM provider (Ollama/Anthropic/OpenAI), Denial prediction (XGBoost), Risk stratification (6-dimension composite), NEWS2 early warning, Federated learning

**Operations:** Lab, Radiology AI (DICOM + attention heatmaps), Pharmacy (BCMA, formulary AI), Blood Bank, OR, PACU, ED, Bed Management, Supply Chain AI, Anesthesia

**Admin/Finance:** Billing, Claims AI, Revenue Cycle, Prior Authorization, Multi-currency Medical Aid, Tax Management, Payment Reconciliation, Practice Management

**Patient Engagement:** Patient Portal, PostVisit AI Companion, Telemedicine (video), PRO (Patient Reported Outcomes), SDOH screening, Symptom Checker, Secure Messaging

**Security:** Per-tenant DB isolation, AES-256-GCM encryption, JWT + 2FA, RBAC, HIPAA audit log, Consent Guard middleware, PHI redaction, AI governance/bias audits

**Offline:** `/sync/batch` endpoint, AsyncStorage queue (mobile), conflict resolution, checkpoint API — **web PWA offline cache not yet implemented**

**Language:** 40+ languages via Whisper voice scribe; 12-language SADC clinical NLP engine (EN, AF, SW, PT, FR, SN, ND, ZU, XH, MG, NY, LN + Setswana, Chichewa, Lingala, Siswati, Xitsonga, Tshivenda symptom dicts); frontend i18n architecture ready

---

## 2. SADC Country Health System Profiles

| Country | Key National Health IT | Primary Disease Burden | Critical Integration Needs |
|---|---|---|---|
| **South Africa** | NHLS, TIER.net (ART), ETR.net (TB), NHI rollout, HealthConnect | HIV (7.5M PLHIV), TB, NCDs, mental health | NHLS HL7v2 lab bridge, TIER.net export, ETR.net export, NHI API |
| **Zimbabwe** | DHIS2, eSHR | HIV, TB, Cholera outbreaks, maternal | Cholera/outbreak surveillance, eSHR patient import |
| **Zambia** | SmartCare, ZHIS | HIV, TB, Malaria, NTDs | SmartCare national patient ID lookup, NTD workflows |
| **Malawi** | OpenMRS (iHIS), DHIS2 | HIV, TB, Malaria, Schistosomiasis, maternal | OpenMRS patient sync, NTD (Schistosomiasis) workflows |
| **Tanzania** | GoT-DHIS2, NHIF | Malaria (#1), HIV, TB, maternal | NHIF claims integration, Swahili clinical forms |
| **Mozambique** | OpenMRS, DISA (viral load) | HIV (highest prevalence), TB | DISA VL integration, Portuguese clinical form templates |
| **Botswana** | IPMS (Integrated Patient Mgmt System) | HIV (2nd highest globally), NCDs | IPMS patient ID interop, BHP (Botswana Health Portal) |
| **Namibia** | iHHES, DHIS2 | HIV, TB, NCDs | iHHES interop, rural/San community health workflows |
| **DRC** | DHIS2, SORMAS | Ebola, Mpox, Cholera, Malaria, HIV | SORMAS bridge, outbreak/IHR notification, Lingala/French forms |
| **Angola** | DHIS2 (early stage) | Malaria (#1 burden), Yellow Fever, HIV | Malaria case management depth, Portuguese UI depth |
| **Madagascar** | DHIS2, HMIS | Plague, Malaria, severe malnutrition | Plague protocols, SAM/CMAM workflows |
| **Eswatini** | DHIS2 | HIV (highest prevalence globally ~27%), TB | Dual HIV/TB co-infection workflows, Siswati clinical forms |
| **Lesotho** | DHIS2, iHHES | HIV, TB, maternal mortality | Mountain/remote facility routing, CHW mobile reporting |
| **Comoros** | Very limited digital health | Malaria, Cholera | Offline-first, USSD/SMS fallback, low-resource mode |
| **Seychelles** | More developed | NCDs, lifestyle diseases | NCD registry, island facility network routing |
| **Mauritius** | More developed | NCDs, diabetes, cancer | NCD registry, cancer registry, CRVS integration |

---

## 3. Africa Health System Context

### Key Digital Health Platforms in Active Use

| Platform | Usage | Countries |
|---|---|---|
| **DHIS2** | National aggregate health reporting | 73+ countries; all 16 SADC states |
| **OpenMRS** | Patient-level EMR | Malawi, Mozambique, Uganda, Kenya, Ethiopia |
| **OpenLMIS** | Last-mile supply chain | Malawi, Mozambique, Zambia, Tanzania, Senegal |
| **SORMAS** | Disease outbreak surveillance | Nigeria, DRC, Côte d'Ivoire |
| **TIER.net** | ART cohort register | South Africa (national mandate) |
| **ETR.net** | TB case register | South Africa (national mandate) |
| **SmartCare** | National patient-level EMR | Zambia |
| **IPMS** | Patient management | Botswana |
| **DISA** | Viral load / CD4 lab results | Mozambique |
| **iHHES** | Health info system | Namibia, Lesotho |
| **KenyaEMR** | HIV EMR | Kenya |
| **KHIS** | Kenya Health Information System | Kenya |

### Key Health Programs Driving Data Requirements

| Program | Indicators Required | Reporting Destination |
|---|---|---|
| **PEPFAR** | TX_NEW, TX_CURR, TX_PVLS, HTS_TST, PMTCT_STAT, TB_PREV, etc. (MER 2.x) | DATIM API |
| **The Global Fund (HIV/TB/Malaria)** | Aggregate program indicators | Country DHIS2 + GF portal |
| **GAVI (Immunization)** | Coverage rates, doses administered, cold chain status | DHIS2 EPI |
| **WHO AFRO** | Disease burden, mortality, morbidity | WHO Data Portal |
| **Africa CDC** | Outbreak events, IHR notifications | Africa CDC DHIS2 |
| **CHAI / USAID GHSP** | Health system strengthening KPIs | Country-specific |
| **MSF / Médecins Sans Frontières** | Emergency protocols, nutrition programs | Internal + DHIS2 |

### Health Financing Models in Africa

| Model | Countries | Requirement |
|---|---|---|
| **Mobile money (cash-dominant)** | All SADC (M-Pesa, MTN MoMo, EcoCash, Airtel Money) | Mobile payment gateway APIs |
| **NHIF (National Health Insurance Fund)** | Kenya, Tanzania | Capitation billing, NHIF claims format |
| **CBHI / Mutuelles de Santé** | Rwanda, expanding to others | Community enrollment, capitation, co-pay calculation |
| **Zambia National Health Insurance** | Zambia | NHIMA claims integration |
| **South Africa NHI** | SA (rollout) | NHI provider portal, benefit schedule API |
| **Medical aid (private)** | SA, Zimbabwe, Botswana, Namibia | Already supported by MediCore |
| **Out-of-pocket / cash** | All SADC (dominant in rural) | POS, receipt, payment plans |

### Connectivity Reality

| Context | Connectivity | Requirement |
|---|---|---|
| Urban private facilities | 4G/LTE, stable | Full online mode |
| Urban public hospitals | Variable 3G/LTE | Redis caching, graceful degradation |
| District hospitals | 2G/3G, intermittent | Offline-first, sync on reconnect |
| Rural health posts | GPRS or none | Full offline, USSD/SMS fallback |
| CHW home visits | Feature phone / no smartphone | USSD, SMS, KoBoToolbox/ODK |

---

## 4. Gap Analysis — What Is Missing

### 🔴 Critical Gaps (Must-Have for SADC/Africa)

---

#### Gap 1: Community Health Worker (CHW) Module

Africa's primary care backbone. CHW programs employ millions across SADC — iCHAS (SA), CHWIS (Kenya), VHT (Uganda), Agentes Comunitários (Mozambique).

**Current state:** Mobile app has geolocation and offline queue; referral workflow exists.
**Missing:**
- Household register (family/household unit, not just individual patients)
- MUAC (mid-upper arm circumference) nutrition screening form
- CHW task assignment and supervision dashboard
- CHW-specific mobile UI (simplified, field-optimized)
- Community case log (daily tally of visits, services, referrals)
- Integration with ODK / KoBoToolbox / CommCare for existing CHW programs
- CHW performance reporting to DHIS2

---

#### Gap 2: Offline-First Web (PWA) + USSD/SMS Fallback

**Current state:** Mobile app has AsyncStorage queue + `/sync/batch`. Web has no Service Worker.
**Missing:**
- Service Worker + IndexedDB offline cache for EHR web frontend
- Progressive Web App (PWA) manifest for installability on Android
- USSD gateway integration (Africa's Talking USSD API) for feature-phone clinical lookups
- SMS appointment reminders + ARV refill reminders via Africa's Talking / Twilio
- Bulk SMS campaigns for health education (treatment adherence, immunization reminders)

---

#### Gap 3: Outbreak Surveillance / Notifiable Disease Alerts

Active contexts: Ebola/Mpox/Cholera (DRC), Cholera (Zimbabwe 2023+), Yellow Fever (Angola).

**Missing:**
- Per-country notifiable disease list (configurable per tenant/country)
- Automated MOH alert when case threshold exceeded
- IHR (International Health Regulations) event notification to Africa CDC / WHO AFRO
- SORMAS (Surveillance Outbreak Response Management and Analysis System) integration bridge
- Contact tracing module for communicable disease outbreaks
- Epidemic curve generation and linelist export

---

#### Gap 4: EPI / Immunization Registry

All 16 SADC states report immunization coverage to DHIS2. GAVI performance metrics are based on EPI data.

**Missing:**
- National EPI schedule engine (BCG, OPV, DPT-HepB-Hib, PCV, Rotavirus, MCV, HPV — by age in weeks/months)
- Vaccination record per child (doses given, dates, lot numbers)
- Cold chain temperature logging per vaccine lot
- Defaulter tracing (children who missed scheduled dose)
- AEFI (Adverse Event Following Immunization) recording
- DHIS2 Tracker EPI program write (individual TEI enrollment + vaccination events)
- Coverage rate reporting per facility/catchment area

---

#### Gap 5: Severe Acute Malnutrition (SAM) / CMAM

Top killer in Malawi, DRC, Madagascar, Mozambique, Angola. Community-Based Management of Acute Malnutrition (CMAM) is a core MOH program.

**Missing:**
- MUAC (mid-upper arm circumference) screening and classification (SAM < 115mm, MAM 115–125mm)
- RUTF (Ready-to-Use Therapeutic Food) dispensing and stock management
- Weight-for-height Z-score (WHZ) calculation
- IMAM (Integrated Management of Acute Malnutrition) protocols
- Inpatient therapeutic feeding (F75/F100 milk) tracking
- CMAM program reporting to DHIS2 (OTP, SC, TSFP registers)
- Nutrition program integration with EPI and maternal health

---

#### Gap 6: Mobile Money Payment Gateway

80%+ of African health payments are cash or mobile money. Private medical aid is minority (urban, formal sector).

**Missing:**
- M-Pesa Daraja API (Kenya, Tanzania, Mozambique, DRC)
- MTN Mobile Money API (Uganda, Ghana, Zambia, Côte d'Ivoire, Cameroon)
- EcoCash API (Zimbabwe)
- Airtel Money API (Malawi, Zambia, DRC, Kenya)
- Flutterwave / Paystack aggregator (multi-country Africa)
- Mobile money payment receipt generation
- Reconciliation of mobile money payments against invoices
- Partial payment / payment plan support for low-income patients

---

#### Gap 7: NHIF / CBHI Capitation Billing Model

National health insurance schemes have fundamentally different billing mechanics from private medical aid.

**Missing:**
- Capitation payment model (per-member-per-month fixed fee, not fee-for-service)
- NHIF claims format (Kenya NHIF, Tanzania NHIF claim schema)
- Community health insurance enrollment (membership, contribution tracking)
- Zambia NHIMA claims integration
- Rwanda Mutuelles de Santé membership + co-pay calculation
- Scheme-defined tariff schedules (not provider-defined)
- Pre-authorization at district/scheme level

---

### 🟡 Important Gaps (High Value for SADC)

---

#### Gap 8: SORMAS / Disease Surveillance Integration

**Missing:** SORMAS REST API client for case notification export; linelist format compatible with country SORMAS instances.

---

#### Gap 9: Neglected Tropical Diseases (NTDs)

SADC-endemic NTDs: Schistosomiasis (Malawi, Zambia, Tanzania), Lymphatic Filariasis, Onchocerciasis, Trachoma, Human African Trypanosomiasis/Sleeping Sickness (DRC, Tanzania), Leprosy.

**Missing:**
- NTD-specific clinical assessment forms
- Mass Drug Administration (MDA) tracking (albendazole, ivermectin, praziquantel, azithromycin campaigns)
- NTD program reporting to DHIS2
- Leprosy grade/disability assessment
- Sleeping sickness staging (haemo-lymphatic vs. meningo-encephalitic)

---

#### Gap 10: Malaria Clinical Depth

Malaria is the #1 disease burden in Angola, DRC, Mozambique, Tanzania, Malawi. Basic protocols exist but structured clinical workflows are missing.

**Missing:**
- Malaria severity scoring (WHO severe malaria criteria: cerebral malaria, severe anaemia, etc.)
- RDT (Rapid Diagnostic Test) result capture as structured data
- G6PD testing requirement flag before primaquine prescribing
- IPTp (Intermittent Preventive Treatment in Pregnancy) tracking — SP doses by gestational age
- ACT dosing by weight (artemether-lumefantrine, artesunate-amodiaquine)
- Malaria in pregnancy risk stratification
- Falciparum vs. vivax vs. mixed species treatment differentiation

---

#### Gap 11: OpenMRS Patient Import / Sync

Malawi, Mozambique, Uganda, Kenya, Ethiopia run OpenMRS-based national EMRs.

**Missing:**
- OpenMRS REST API patient importer
- OpenMRS concept → SNOMED CT / ICD-10 mapping
- Patient deduplication across OpenMRS and MediCore using national patient ID
- Encounter history migration (visit notes, lab results, diagnoses)

---

#### Gap 12: National Patient ID Registry / Client Registry

Zambia (SmartCare ID), Botswana (IPMS ID), SA (ECID), Tanzania (UPI) all have national patient identifiers.

**Missing:**
- OpenCR (Open Client Registry) integration for national patient ID resolution
- National patient ID as first-class identifier in patient registration
- Cross-system patient deduplication using national ID

---

#### Gap 13: NHLS HL7 v2 Lab Bridge (South Africa)

The National Health Laboratory Service processes 65M+ tests/year for SA public sector. Results returned via HL7 v2 ADT/ORU messages.

**Missing:**
- HL7 v2 ORU (lab result) inbound message parser → structured lab result
- NHLS test code → LOINC mapping
- Critical value alert routing from NHLS results

---

#### Gap 14: TIER.net / ETR.net Export (South Africa)

SA Department of Health mandates ART patient reporting to TIER.net and TB case notification to ETR.net.

**Missing:**
- TIER.net XML patient export (ART cohort, regimen history, viral load)
- ETR.net TB case notification export
- Scheduled export job with MOH submission confirmation

---

#### Gap 15: PEPFAR DATIM / MER 2.x Indicator Completeness

DHIS2 sync exists but DATIM is a separate instance with strict MER disaggregate requirements.

**Missing (to verify/confirm):**
- TX_NEW / TX_CURR / TX_PVLS disaggregated by age (fine-grained bands) + sex + KP population
- PMTCT_STAT, PMTCT_EID, PMTCT_HEI_POS
- HTS_TST, HTS_TST_POS, HTS_LINKAGE
- TB_PREV, TB_ART
- DATIM API push (not generic DHIS2 API) — requires DATIM-specific org unit UIDs
- DATIM user authentication + data set approval workflow

---

#### Gap 16: DHIS2 Tracker (Individual-level TEI)

MediCore currently pushes aggregate data to DHIS2. DHIS2 Tracker supports individual patient tracking — required for HIV, TB, Malaria, EPI programs in DHIS2-native countries.

**Missing:**
- DHIS2 Tracked Entity Instance (TEI) enrollment API
- Program stage event write per patient visit
- Bidirectional TEI sync (pull existing DHIS2 Tracker records into MediCore)
- Program rules evaluation (DHIS2 program rules for data validation)

---

#### Gap 17: Civil Registration & Vital Statistics (CRVS)

Health facilities are the primary point of birth and death registration across SADC.

**Missing:**
- Birth notification form → national CRVS API (Zimbabwe ZIMSTAT, SA Department of Home Affairs)
- Stillbirth recording (distinct from live birth)
- Death certificate generation (ICD-10 cause-of-death coding)
- Maternal death notification (MDSR — Maternal Death Surveillance and Response)
- Perinatal Death Review (PDR) workflow

---

#### Gap 18: Mental Health — mhGAP Task-Shifting

Mental health gap is severe: 1 psychiatrist per 1 million population in many SADC countries. WHO mhGAP enables nurse/CHW-delivered mental health care.

**Current state:** PHQ-9, GAD-7, risk assessment exist.
**Missing:**
- mhGAP Intervention Guide (mhGAP-IG 2.0) clinical decision support for nurses/CHWs
- Screening tools translated into all 12 SADC languages
- Substance use disorder (alcohol, khat, cannabis) structured assessment
- Suicide/self-harm safety plan documentation
- Community mental health care plan (community follow-up, not just facility)
- Mental health referral pathway (CHW → clinic → district → specialist)

---

#### Gap 19: Traditional Medicine Documentation

70–80% of SADC patients use traditional healers before or alongside formal care.

**Missing:**
- Traditional medicine / herbal remedy use field in patient history
- Herb-drug interaction flags (known interactions: St. John's Wort + ARVs, Moringa + anticoagulants, etc.)
- Traditional healer referral workflow (bidirectional)
- ZINATHA (Zimbabwe) / THPCA (SA) practitioner registry integration concept

---

#### Gap 20: Africa's Talking SMS / USSD Gateway

**Missing:**
- Africa's Talking SMS API integration for appointment reminders, ARV refill reminders, lab result notifications
- Bulk SMS campaigns (immunization drives, health education)
- USSD menu for patient-facing services (appointment lookup, lab result, medication reminders) on feature phones
- Two-way SMS for TB DOT confirmation ("Reply YES if you took your medication today")

---

### 🟢 Enhancement Opportunities (Differentiators)

---

#### Gap 21: OpenLMIS Supply Chain Integration

OpenLMIS is the dominant last-mile supply chain platform across Malawi, Mozambique, Zambia, Tanzania, Senegal.

**Missing:** OpenLMIS REST API integration for requisition orders, stock status pull, stockout alerts, cold chain status sync.

---

#### Gap 22: GS1 Barcodes in Pharmacy

SA and increasingly other SADC countries mandate GS1 GTIN barcodes on medicines and medical supplies.

**Missing:** GS1 GTIN product lookup, barcode scanner integration at pharmacy dispensing point, expiry date extraction from GS1 barcode.

---

#### Gap 23: Multi-language Clinical Form Templates

Voice scribe supports 40+ languages. Frontend i18n architecture is ready. But clinical documentation templates are English-only.

**Missing:**
- ANC (antenatal care) visit form in Portuguese (Mozambique, Angola), French (DRC, Madagascar), Swahili (Tanzania)
- Referral letter templates in local languages
- Consent forms in local languages
- Patient discharge summary in patient's preferred language

---

#### Gap 24: PACTR / AfricaTrials Registry

Clinical trial matching currently uses ClinicalTrials.gov (US-centric). The Pan African Clinical Trials Registry (PACTR) is the authoritative source for Africa-based trials.

**Missing:** PACTR API integration for trial search and eligibility matching.

---

#### Gap 25: Refugee / Stateless Patient Workflows

Large refugee populations across SADC: DRC, Mozambique, Zimbabwe into SA; Burundian/Rwandan refugees in Tanzania; Somali refugees in Kenya.

**Missing:**
- UNHCR ProGres ID as valid patient identifier in registration
- Stateless patient pathway (no national ID, no fixed address)
- Cross-border health record access for refugee patients
- UNHCR/MSF clinic interoperability (OpenMRS data exchange)

---

#### Gap 26: One Health / Zoonotic Disease

Pastoral communities across SADC (Botswana, Namibia, Tanzania, Zambia) have high zoonotic disease exposure.

**Missing:**
- Animal exposure history in patient registration / history
- Zoonotic disease clinical pathways (Brucellosis, Anthrax, Rabies, Rift Valley Fever, Sleeping Sickness)
- One Health case report export to veterinary / agriculture authorities
- Rabies post-exposure prophylaxis (PEP) workflow with dose scheduling

---

#### Gap 27: DISA Viral Load Integration (Mozambique)

DISA is Mozambique's national viral load and CD4 result system. PEPFAR/MISAU mandate results flow through it.

**Missing:** DISA REST API client for inbound VL/CD4 results and outbound patient enrolment.

---

#### Gap 28: ODK / KoBoToolbox / CommCare Form Import

CHW programs across SADC collect data in ODK, KoBoToolbox, or CommCare. Facilities need to ingest this data into patient records.

**Missing:** ODK Central / KoBoToolbox API integration for pulling submitted form data into MediCore patient encounters.

---

#### Gap 29: WASH / Environmental Health Linkage

Cholera outbreaks require WASH (Water, Sanitation, Hygiene) intervention linkage.

**Missing:**
- Household WASH status flag (safe water source, latrine access)
- Environmental health referral for WASH intervention
- Cholera cluster detection (geographic clustering of cases → trigger WASH alert)

---

#### Gap 30: Africa-Adapted Palliative Care

Africa Palliative Care Association (APCA) tools are distinct from Western palliative frameworks.

**Missing:**
- APCA African POS (Palliative Outcome Score)
- Oral morphine availability tracking (key APCA quality metric)
- Home-based palliative care visit scheduling and documentation
- Opioid prescription compliance with country-specific controlled substance laws

---

## 5. Inventory vs. Gap Corrections

After cross-referencing the full codebase inventory against the initial gap analysis, the following corrections apply:

| Area | Initial Assessment | Corrected Assessment |
|---|---|---|
| **Offline-First** | Fully missing | Partially built: mobile AsyncStorage queue + `/sync/batch` endpoint exist. Web PWA cache and USSD/SMS fallback are the actual gaps. |
| **CHW Module** | Fully missing | Infrastructure ready: geolocation, offline queue, referral workflow in mobile app. Missing: household register, MUAC form, CHW supervision UI, CHW task assignment. |
| **Mental Health** | Largely missing | PHQ-9, GAD-7, suicide risk assessment already exist. Missing: mhGAP CDS for nurses/CHWs, screening tools in SADC languages. |
| **Language Support** | 8 languages | Voice scribe: 40+ languages. SADC NLP: 12 languages. Frontend i18n architecture ready. Missing: clinical templates/forms in local languages. |
| **Supply Chain** | Not mentioned | Supply chain AI for stockout prediction exists. Missing: OpenLMIS integration, GS1 barcodes. |
| **Radiology AI** | Not mentioned | DICOM viewer + AI attention heatmaps confirmed. |
| **PEPFAR MER** | Partially built | Controller exists but DATIM-specific disaggregates and DATIM API push (vs. generic DHIS2) need verification. |
| **Malaria** | Basic | Basic protocols confirmed. G6PD, IPTp, severity scoring, RDT capture, ACT weight-based dosing missing. |

---

## 6. Priority Sprint Roadmap

Ordered by: SADC deployment blocker severity × number of countries unlocked × implementation effort.

| Priority | Sprint | Feature | Countries Unlocked | Blocker Type |
|---|---|---|---|---|
| 🔴 1 | **S129** | EPI / Immunization Registry | All 16 SADC | DHIS2/GAVI mandate |
| 🔴 2 | **S130** | Outbreak Surveillance + Notifiable Diseases | DRC, Zimbabwe, Angola, Madagascar | IHR/Africa CDC |
| 🔴 3 | **S131** | Mobile Money (M-Pesa, MTN MoMo, EcoCash, Airtel Money) | All 16 SADC | Revenue / payment |
| 🔴 4 | **S132** | CHW Module (household register, MUAC, supervision) | All 16 SADC | Primary care backbone |
| 🔴 5 | **S133** | SAM/CMAM Nutrition Programs | Malawi, DRC, Madagascar, Mozambique, Angola | Child mortality |
| 🟡 6 | **S134** | NHIF/CBHI Capitation Billing | Tanzania, Kenya, Rwanda, Zambia | Insurance compliance |
| 🟡 7 | **S135** | TIER.net + ETR.net + NHLS HL7v2 (SA) | South Africa | SA DOH mandate |
| 🟡 8 | **S136** | DHIS2 Tracker (individual TEI) + DATIM MER 2.x | All PEPFAR-funded sites | PEPFAR compliance |
| 🟡 9 | **S137** | Africa's Talking SMS/USSD Gateway | All 16 SADC | Low-connectivity access |
| 🟡 10 | **S138** | OpenMRS Patient Import + National ID Registry | Malawi, Mozambique, Uganda | Migration / continuity |
| 🟡 11 | **S139** | CRVS Birth/Death Notification | All 16 SADC | Facility obligation |
| 🟡 12 | **S140** | NTD Programs + Malaria Clinical Depth | Malawi, Zambia, Tanzania, DRC, Angola | Disease burden |
| 🟢 13 | **S141** | mhGAP CDS + SADC-language Mental Health Tools | All 16 SADC | Task-shifting to nurses/CHWs |
| 🟢 14 | **S142** | Multi-language Clinical Form Templates | Mozambique, DRC, Tanzania, Angola | Clinician adoption |
| 🟢 15 | **S143** | Traditional Medicine + Herb-Drug Interactions | All 16 SADC | Safety / adoption |
| 🟢 16 | **S144** | Refugee/Stateless Patient Workflows (UNHCR ProGres ID) | SA, Botswana, Tanzania, Kenya | Equity / UNHCR sites |
| 🟢 17 | **S145** | OpenLMIS + GS1 Barcodes | Malawi, Mozambique, Zambia, Tanzania | Supply chain |
| 🟢 18 | **S146** | PACTR/AfricaTrials + One Health/Zoonotic | Research sites, pastoral communities | Research / zoonotic |

### Sprint Descriptions

#### S129 — EPI / Immunization Registry
Build a national EPI schedule engine (WHO schedules by country), child vaccination card, vaccine lot management, cold chain logging, defaulter tracing, AEFI recording, and DHIS2 Tracker EPI program write. No new microservice — extend CDSS + EHR service.

#### S130 — Outbreak Surveillance
Configurable notifiable disease list per country/tenant. Threshold-based MOH alert generation. SORMAS REST client for case notification export. IHR event notification. Contact tracing module (index case → contacts → exposure events).

#### S131 — Mobile Money Payments
Integrate M-Pesa Daraja API, MTN MoMo API, EcoCash API, Airtel Money API, Flutterwave aggregator. Add mobile money as payment method in billing. Generate mobile money receipts. Reconcile mobile payments against invoices.

#### S132 — CHW Module
CHW-specific mobile app screens (simplified UI). Household register (family unit). Daily service tally. MUAC screening form. CHW task assignment from facility. Supervision dashboard. CHW performance reporting to DHIS2.

#### S133 — SAM/CMAM Nutrition
MUAC measurement capture. SAM/MAM/Normal classification. RUTF dispensing workflow. IMAM protocol CDS. Inpatient therapeutic feeding (F75/F100). CMAM program reporting (OTP register, SC register, TSFP register) to DHIS2.

#### S134 — NHIF/CBHI Billing
Capitation payment model (monthly fixed fee). NHIF claim schema (Kenya NHIF, Tanzania NHIF). Community health insurance member enrollment. Co-pay calculation. Zambia NHIMA integration. Rwanda Mutuelles configuration.

#### S135 — SA National System Interop
TIER.net XML export for ART patients (monthly/quarterly). ETR.net TB case notification. NHLS HL7 v2 ORU inbound lab result parser. NHLS test code → LOINC mapping. SA ECID national patient ID resolution.

#### S136 — DHIS2 Tracker + DATIM MER
DHIS2 Tracker TEI enrollment API. Program stage event write per clinical visit. DATIM API authentication + org unit UID mapping. Full MER 2.x indicator set (TX_CURR, TX_NEW, TX_PVLS, HTS_TST, PMTCT_*, TB_PREV, etc.) with correct age/sex/KP disaggregates. DATIM data set approval workflow.

#### S137 — Africa's Talking SMS/USSD
Africa's Talking SMS API: appointment reminders, ARV refill reminders, lab result alerts, immunization reminders. Bulk SMS campaigns. USSD menu for patients (feature phone): appointment lookup, medication reminder confirmation. Two-way SMS for TB DOT adherence.

#### S138 — OpenMRS Import + Client Registry
OpenMRS REST patient importer with concept mapping. OpenCR client registry lookup (national patient ID resolution). Cross-system deduplication by national ID (SmartCare, IPMS, OpenMRS). Patient encounter history migration.

#### S139 — CRVS Birth/Death
Birth notification form → ZIMSTAT / SA DHA / country CRVS API. Stillbirth recording (distinct workflow). ICD-10-coded death certificate generation. Maternal Death Surveillance and Response (MDSR) notification. Perinatal Death Review workflow.

#### S140 — NTD Programs + Malaria Depth
NTD assessment forms (Schistosomiasis, Leprosy, HAT, Filariasis). MDA campaign tracking. Malaria severity scoring (WHO severe criteria). RDT structured result capture. G6PD flag before primaquine. IPTp tracking. ACT weight-based dosing tables. Species-differentiated treatment.

---

## 7. Coverage Scorecard

| Clinical Domain | MediCore Now | SADC Need | Gap Priority |
|---|---|---|---|
| HIV/ART (ARV, VL, CD4, PMTCT) | ★★★★☆ | Critical | TIER.net, DATIM MER completeness |
| TB (regimen, DOT, contact tracing) | ★★★★☆ | Critical | ETR.net export, contact tracing depth |
| Malaria (case management) | ★★☆☆☆ | Critical | Severity scoring, G6PD, IPTp, RDT capture |
| Maternal / Obstetrics / PMTCT | ★★★★☆ | Critical | CRVS birth notification, MDSR |
| Immunization / EPI | ★☆☆☆☆ | Critical | Full module needed — S129 |
| Nutrition / SAM / CMAM | ★☆☆☆☆ | Critical | Full CMAM module needed — S133 |
| CHW / Community Health | ★★☆☆☆ | Critical | Full CHW UI needed — S132 |
| Outbreak / Surveillance | ★☆☆☆☆ | Critical | SORMAS, notifiable disease alerts — S130 |
| NTDs (Schistosomiasis, HAT, etc.) | ★☆☆☆☆ | High | Full module needed — S140 |
| Mental Health (mhGAP) | ★★★☆☆ | High | mhGAP CDS, SADC language tools — S141 |
| Lab (NHLS/DISA inbound) | ★★★☆☆ | High | NHLS HL7v2, DISA VL — S135 |
| Supply Chain (OpenLMIS) | ★★★☆☆ | High | OpenLMIS integration — S145 |
| Mobile Money Payments | ★☆☆☆☆ | Critical | M-Pesa, MTN MoMo, EcoCash — S131 |
| NHIF / CBHI Insurance | ★☆☆☆☆ | High | Capitation model — S134 |
| Offline-First (web PWA) | ★★☆☆☆ | Critical | Service Worker + IndexedDB — S129+ |
| USSD / SMS / Feature Phone | ★☆☆☆☆ | High | Africa's Talking — S137 |
| DHIS2 Tracker (individual) | ★★☆☆☆ | High | TEI enrollment needed — S136 |
| PEPFAR DATIM / MER 2.x | ★★★☆☆ | Critical | DATIM API, disaggregate completeness — S136 |
| CRVS Birth/Death | ★☆☆☆☆ | High | Birth/death notification — S139 |
| OpenMRS Patient Import | ★☆☆☆☆ | High | Malawi, Mozambique, Uganda — S138 |
| National Patient ID Registry | ★☆☆☆☆ | High | OpenCR / SmartCare / IPMS — S138 |
| Multi-language Clinical Forms | ★★☆☆☆ | High | Templates in PT, FR, SW, SN — S142 |
| Traditional Medicine | ★☆☆☆☆ | Medium | Herb-drug interactions — S143 |
| Refugee / Stateless Workflows | ★☆☆☆☆ | Medium | UNHCR ProGres ID — S144 |
| One Health / Zoonotic | ★☆☆☆☆ | Medium | Animal exposure, zoonotic CDS — S146 |
| GS1 Barcodes (Pharmacy) | ★☆☆☆☆ | Medium | SA mandate, expanding SADC — S145 |
| PACTR / AfricaTrials | ★☆☆☆☆ | Low | Africa-specific trial registry — S146 |

### Summary Assessment

MediCore is **best-in-class** for:
- Clinical AI (CDSS, differential diagnosis, drug safety, risk stratification)
- Health standards compliance (FHIR R4, SNOMED CT, ICD-10, LOINC, HL7, WHO SMART Guidelines)
- Hospital operations (lab, pharmacy, BCMA, OR, blood bank, bed management)
- HIV/TB clinical workflows and DHIS2 aggregate reporting
- Revenue cycle, claims AI, multi-currency billing (private medical aid)
- AI governance, explainability, federated learning, multi-tenancy

**The three highest-leverage missing features for SADC market entry are:**

1. **CHW Module + Offline-First PWA** — Africa's primary care operates through CHWs; no CHW app = no community health market
2. **EPI/Immunization Registry** — Mandatory DHIS2 reporting in all 16 SADC states; GAVI performance metrics depend on it
3. **Mobile Money Payment Integration** — Cash/mobile money is 80%+ of African health payments; without it the billing module is unusable for most African facilities

---

*Generated: 2026-04-09 | Based on full MediCore codebase inventory + SADC/Africa health systems research*
