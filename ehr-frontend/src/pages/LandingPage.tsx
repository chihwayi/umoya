import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  Lock,
  MessageSquare,
  Network,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Zap,
} from 'lucide-react';
import { tenantApi } from '../services/api';

type ContactMethod = 'email' | 'phone' | 'whatsapp';

const interestOptions = [
  'PostVisit AI',
  'CDSS and AI decision support',
  'Maternity and newborn care',
  'Diabetes and chronic care',
  'Vaccination and preventive care',
  'Lab and radiology workflows',
  'FHIR interoperability',
  'SNOMED and structured coding',
  'DHIS2 reporting',
  'HIV program workflows',
  'Cancer and specialty modules',
  'Claims and revenue cycle',
  'Patient portal and mobile app',
  'Offline-first point-of-care mobile',
  'Sickle cell and haemoglobinopathy',
  'Traditional medicine herb-drug alerts',
  'NHIF/CBHI and capitation billing',
  'PACTR clinical trial matching',
  'Ubuntu SDOH and cultural health',
  'Subscription & SaaS billing enforcement',
  'Deployment mode gating (clinic / hospital / ministry)',
  'CRVS civil registration & birth/death reporting',
  'Multi-language mobile (8 African languages)',
  'Proactive risk scoring & nurse alerts',
  'AI mortality risk prediction',
  'AI-generated clinical documents',
  'Drug substitution AI engine',
  'AI follow-up scheduling & care continuity',
  'Predictive medication adherence engine',
  'AI clinical timeline & pattern detection',
  'Treatment gap & care opportunity engine',
  'Central storeroom & inventory management',
  'AI demand forecasting & auto-procurement',
  'FEFO expiry tracking & cold-chain management',
  'QR code patient check-in',
  'Pre-visit digital intake form',
  'Discharge documents to patient app',
  'Wearable and home device sync',
  'Referral tracking portal',
  'In-app bill payment (EcoCash / OneMoney)',
  'Real-time queue and wait time',
  'Theatre utilization dashboard',
  'Post-visit CSAT and NPS surveys',
  'Clinician mobile ward round',
  'Household and family risk graph',
  'Digital procedural consent with e-signature',
  'Cross-facility stock balancing',
  'Safe offline sync conflict resolution',
  'WHO Partograph (digital labour chart)',
  'Radiology report notifications',
  'Orthopaedics, ENT, Gastroenterology, Rheumatology modules',
  'Haematology, Urology, Physiotherapy, Endocrinology modules',
  'AHFoZ tariff-coded itemised claims',
  'X12 837P/835 EDI claims',
  'Real medical-aid eligibility (CIMAS / insurer)',
  'MCAZ pharmacy compliance',
  'Automated notification center',
  'Tiered SaaS subscription plans',
  'True offline-first app shell (load-shedding resilient)',
  'Cardiac Catheterisation Lab (CathLab + AI risk)',
  'ICU / Critical Care with AI quality dashboard',
  'NICU — neonatal ICU with HIE cooling and targeted echo',
  'Well-Baby clinic with WHO z-scores and ASQ-3 screening',
  'EPI / Immunisation programme with cold-chain and AEFI',
  'Neonatal screening (NBS, hearing, CCHD, ROP, bilirubin)',
  'Dialysis / Renal Replacement Therapy (HD, PD, CRRT)',
  'Aviation medicine — CAAZ Class 1/2/LAPL medicals',
  'Hyperbaric Oxygen Therapy (HBOT)',
  'Prosthetics and Orthotics with outcome measures',
  'Perinatal Mental Health (EPDS, bonding, safeguarding)',
  'Post-NICU developmental follow-up with Bayley Scales',
  'Patient Transport and inter-facility dispatch',
  'Aesthetics and Regenerative Medicine with CDSS contraindication alerts',
  'Paediatric Cardiology — CHD register, echo, interventions, SBE prophylaxis',
  'Occupational Medicine — FFD, exposure surveillance, RTW coordination',
  'HIV 95-95-95 cascade dashboards with disaggregation',
  'PMTCT, TB-HIV, and NCD cascade analytics',
  'Equity & disparity analytics by age, sex, district, insurance',
  'Multi-facility benchmarking with district/national peer comparison',
  'Maternal Mortality Audit (MDSR) workflow',
  'Population health & care gap closure engine',
  'DHIS2 validation feedback loop & DQA scoring',
  'Extended DATIM MER indicators (TB_TB, TB_STAT, PMTCT_EID, HTS_SELF)',
  'Pharmacy intelligence — formulary adherence, drug waste, AMS',
  'Lab quality assurance — EQA, QC failures, TAT, critical notifications',
  'AI model governance registry — drift detection, fairness, approvals',
  'De-identified research data portal (HIPAA Safe Harbor)',
  'Mobile clinical reports for M&E officers (offline + WhatsApp share)',
  'Universal report export engine (branded PDF, XLSX, CSV, monthly bundle)',
  'Outcome linkage & post-encounter follow-up scheduling',
];

const STANDARDS = [
  { label: 'FHIR R4', color: '#0AA98A' },
  { label: 'SNOMED CT', color: '#3B9EFF' },
  { label: 'ICD-10-CM', color: '#E8614D' },
  { label: 'ICD-10-PCS', color: '#0AA98A' },
  { label: 'RxNorm', color: '#3B9EFF' },
  { label: 'DHIS2', color: '#E8614D' },
  { label: 'HL7 v2/v3', color: '#0AA98A' },
  { label: 'HIPAA', color: '#3B9EFF' },
  { label: 'LOINC', color: '#E8614D' },
  { label: 'OpenEHR', color: '#0AA98A' },
  { label: 'CDA R2', color: '#3B9EFF' },
  { label: 'DICOM', color: '#E8614D' },
];

const stats = [
  { value: '125+', label: 'Clinical modules', sub: 'From maternity and CathLab to ICU, NICU, occupational medicine, reporting analytics and beyond' },
  { value: '40+', label: 'AI capabilities', sub: 'Risk, forecasting, substitution, adherence, voice, FFD, exposure, RTW' },
  { value: '8 langs', label: 'Mobile languages', sub: 'Auto-detected from device locale' },
  { value: 'DHIS2', label: 'Program reporting', sub: 'HIV, maternal, vaccine, ICU, neonatal cohorts' },
];

const audiences = [
  {
    icon: Stethoscope,
    tag: 'Clinicians & Doctors',
    color: '#0AA98A',
    headline: 'AI that works at the bedside, not in a slide deck.',
    points: [
      'CDSS dose checks and risk flags in every encounter',
      'PostVisit AI summaries with patient-safe publishing',
      'Specialty-specific workflows: HIV, oncology, maternity, cardiology, orthopaedics, ENT, rheumatology, gastroenterology, and 6 more',
      'Real-time doctor-nurse coordination and alert loops',
      'Composite mortality risk badge and proactive daily risk score on every patient card',
      'One-click AI documents — referral letters, discharge summaries, pre-auth, sick notes',
      'AI follow-up scheduler — optimal timing and modality after every encounter',
      'Full ward round from mobile — SOAP notes and bedside orders without leaving the patient',
      'PRO surveys feed the AI risk engine in real time — high-risk patients trigger outreach tasks automatically',
      'Wearable and home device readings surface as 7-day sparklines in every patient chart',
      'Family and household risk graph — linked members flagged when infectious or heritable condition is diagnosed',
      'Offline-first mobile — ward rounds work without Wi-Fi; vitals queue and sync automatically',
      'Safe conflict resolution — allergy and medication sync conflicts queued for your review, never silently overwritten',
    ],
  },
  {
    icon: Building2,
    tag: 'Private Clinics & Hospitals',
    color: '#3B9EFF',
    headline: 'One platform. Every revenue line. Zero gaps.',
    points: [
      'AHFoZ tariff-coded itemised claims, X12 837P/835 EDI, remittance import, aged claims, and real-time insurer eligibility',
      'Patients pay outstanding invoices with EcoCash, OneMoney, or ZiG directly from the app — no cashier queue',
      'QR self-check-in and digital pre-visit intake eliminate front-desk bottlenecks',
      'Theatre utilization dashboard — Gantt board, on-time start rate, cancellation tracking',
      'Tiered subscription plans (Solo / Clinic / Multi-Branch) with live usage meters, in-app upgrade page, and self-serve limit management',
      'MCAZ pharmacy compliance — controlled substance register, dispensing log, and MCAZ-compliant prescription layout',
      'Configurable notification center — per-trigger SMS/email toggles for appointments, payments, claims, and staff invitations',
      'SaaS billing enforcer — demo trials auto-expire, grace periods auto-suspend, payments extend access in one API call',
      'Deployment mode gating — clinic, hospital, or ministry tier hides irrelevant modules automatically',
      'Multi-tenant architecture — isolate each facility',
      'Cross-facility stock balancing — AI spots surplus and shortage across all sites and recommends transfers',
      'Lab, radiology, pharmacy, and nursing all connected',
      'Central storeroom with FEFO dispensing, expiry tracking, and AI demand forecasting across all locations',
      'Patient satisfaction surveys (CSAT/NPS) fire automatically after each visit — management dashboard with trend charts',
      'Patient portal and mobile app for post-visit engagement and retention',
    ],
  },
  {
    icon: Shield,
    tag: 'Compliance & HIPAA Teams',
    color: '#E8614D',
    headline: 'Audit trails. Structured data. Defensible records.',
    points: [
      'HIPAA-aware audit logging on every action',
      'SNOMED CT and ICD-10 coded clinical data',
      'Cross-tenant JWT validation — tokens are clinic-scoped and cannot replay across facilities',
      'Biometric app lock, session auto-lock, and offline PHI cache wipe on logout',
      'FHIR-exportable records for referrals and transfers',
      'MCAZ controlled-substance register — dispensing log, returns register, and MCAZ-compliant prescription layout',
      'Zimbabwe CDPA 2021 compliance — 18-control register, POTRAZ 72-hour breach notification, per-patient consent records',
    ],
  },
  {
    icon: BarChart3,
    tag: 'AI Researchers & Data Scientists',
    color: '#0AA98A',
    headline: 'Structured clinical data. Research-ready pipelines.',
    points: [
      'SNOMED CT terminology-aware charting from day one',
      'FHIR R4 export for cohort building and analytics',
      'DHIS2 integration for population-level program data',
      'LOINC-coded lab results and RxNorm medication events',
      'De-identified Research Data Portal — HIPAA Safe Harbor exports with time-shifting, rare-disease suppression and token-gated collaborator access',
      'AI Model Governance Registry — calibration plots, fairness metrics (demographic parity, equalized odds) and drift monitoring per model',
    ],
  },
  {
    icon: Globe,
    tag: 'NGOs & Public Health Programs',
    color: '#3B9EFF',
    headline: 'DHIS2-native reporting. Program visibility at scale.',
    points: [
      '18 DHIS2 aggregate profiles — TB, malaria, HIV, NCD, maternal, neonatal, lab, ICU, HAI, surgical, nutrition, mental health, pharmacy, cervical cancer & outpatient morbidity',
      'Bi-directional DHIS2 sync — push clinical data out AND pull district/national benchmarks back into the doctor dashboard',
      'Tracker TEI sync with real-time clinical event push (encounters, labs, vitals as DHIS2 program stage events)',
      'DATIM MER submission for PEPFAR-funded facilities — TX_CURR, TX_PVLS, HTS_TST, HTS_SELF, TB_PREV, PMTCT, VMMC and more',
      'HIV/PMTCT cascade analytics with 90-90-90 funnel, quarterly equity disparity alerts and mobile M&E reports for district officers',
      'MDSR (Maternal Death Surveillance & Response) — digital case reviews, preventability classification, action-item tracking',
      'DHIS2 Data Quality Alerts — automated outlier detection with 20%/50% deviation thresholds; in-app DQA score and one-tap alert resolution',
      'Universal Report Export Engine — branded PDF, XLSX workbook and CSV export; monthly 7-report ZIP bundles for district health offices',
      'SORMAS + IHR Annex 2 outbreak notification and PACTR trial registry integration',
      'CRVS integration — birth and death events auto-reported to national civil registries',
      'Mobile app in 8 languages (en, fr, pt, sw, sn, zu, nd, af) — locale auto-detected from device',
      'Offline point-of-care mobile — works on 2G/3G and without Wi-Fi in remote facilities',
    ],
  },
  {
    icon: Code2,
    tag: 'Health IT Teams & Integrators',
    color: '#E8614D',
    headline: 'Open standards. Clean APIs. Real interoperability.',
    points: [
      'FHIR R4 REST API with full resource coverage',
      'HL7 v2/v3 and CDA R2 for legacy system bridges',
      'CRVS transport — birth and death events posted to national civil registries via HTTP or webhook',
      'Referral transport — facility-to-facility referrals via webhook with nodemailer email fallback',
      'Webhook-based event streaming for external systems',
      'Multi-tenant provisioning with per-tenant DB isolation',
    ],
  },
];

const aiFeatures = [
  {
    icon: Brain,
    title: 'Clinical Decision Support (CDSS)',
    description: 'Real-time drug interaction checks, dosage alerts, sepsis risk scoring, and protocol-linked recommendations fire during the encounter — not after.',
    color: '#0AA98A',
  },
  {
    icon: FileText,
    title: 'PostVisit AI',
    description: 'AI-generated post-visit summaries with grounded follow-up instructions, patient-safe language publishing, and full signoff workflow before delivery.',
    color: '#3B9EFF',
  },
  {
    icon: AlertCircle,
    title: 'Real-time Clinical Alerts',
    description: 'Abnormal vitals, critical lab results, sepsis indicators, and nurse task overdue notifications reach the right person on the right screen in real time.',
    color: '#E8614D',
  },
  {
    icon: Sparkles,
    title: 'AI Documentation Support',
    description: 'Terminology-aware charting that suggests SNOMED CT concepts, ICD-10 codes, and structured coding as the clinician types — no manual lookup required.',
    color: '#0AA98A',
  },
  {
    icon: TrendingUp,
    title: 'Population Health & Risk Stratification',
    description: 'Cohort-level chronic disease dashboards, vaccination coverage tracking, and HIV/TB program retention analytics using the same operational data.',
    color: '#3B9EFF',
  },
  {
    icon: Zap,
    title: 'Telemedicine + Async AI Review',
    description: 'Video consultations, secure async messaging, and AI-assisted consultation notes in a single integrated telemedicine workflow.',
    color: '#E8614D',
  },
  {
    icon: Globe,
    title: 'SADC & Africa-Specific AI',
    description: 'Herb-drug interaction alerts for traditional medicine disclosures, sickle cell crisis triage, PACTR clinical trial matching, Ubuntu psychosocial SDOH scoring, and IHR Annex 2 outbreak notification — built for the African clinical context.',
    color: '#0AA98A',
  },
  {
    icon: TrendingUp,
    title: 'Proactive Risk Scoring Engine',
    description: 'Nightly composite risk scores across every active patient — NEWS2, vitals, labs, adherence, and missed appointments combined. High and critical patients trigger automatic nurse alerts before deterioration occurs.',
    color: '#E8614D',
  },
  {
    icon: HeartPulse,
    title: 'Mortality Risk Prediction',
    description: 'Composite 30-day mortality risk badge on every patient card — age, comorbidities, NEWS2, ICU status, and critical labs into a single defensible score with factor breakdown. Critical alerts deduplicated to once per 6 hours.',
    color: '#E8614D',
  },
  {
    icon: Sparkles,
    title: 'AI Clinical Summary & Timeline',
    description: '5-sentence AI summary auto-generated on every patient record open. Longitudinal pattern detection identifies recurring infections, drug failures, and chronic progression across the full care history.',
    color: '#0AA98A',
  },
  {
    icon: FileText,
    title: 'AI-Generated Clinical Documents',
    description: 'One-click referral letters, discharge summaries, pre-authorisation requests, and sick notes. AI drafts from structured clinical data; the clinician reviews, edits, and signs. Patient portal shows only signed documents.',
    color: '#3B9EFF',
  },
  {
    icon: Activity,
    title: 'Drug Substitution Engine',
    description: 'When a medication is out of stock, AI suggests ranked therapeutic equivalents with confidence scores, rationale, and caveats — sourced from CDSS, LLM grounding, and protocol rules. Selection logged for audit.',
    color: '#0AA98A',
  },
  {
    icon: Database,
    title: 'Inventory Demand Forecasting',
    description: 'AI consumption trend analysis with seasonality detection produces 30-day forward stock forecasts per item and location. Reorder suggestions fire automatically — stockouts are predicted and prevented before they affect patient care.',
    color: '#3B9EFF',
  },
  {
    icon: Workflow,
    title: 'AI Follow-up Scheduler',
    description: 'After every encounter, AI recommends optimal follow-up interval and modality — in-person, telemedicine, or phone — based on risk band, diagnoses, and open care gaps. Overdue follow-ups alert the care team nightly.',
    color: '#3B9EFF',
  },
  {
    icon: Activity,
    title: 'Wearable & Home Device Integration',
    description: 'Apple Health, Google Fit, and Bluetooth medical devices (BP cuffs, glucometers) sync directly into the patient record. Out-of-range readings are flagged instantly; three consecutive abnormal readings in 24 hours fire a clinical trend alert.',
    color: '#0AA98A',
  },
  {
    icon: TrendingUp,
    title: 'PRO → AI Risk Loop',
    description: 'Every patient-reported outcome survey triggers an immediate AI risk recalculation. High-risk patients (score ≥ 70) automatically generate a care outreach task for their assigned clinician — turning passive survey data into proactive intervention.',
    color: '#E8614D',
  },
  {
    icon: Users,
    title: 'Household & Family Risk Graph',
    description: 'Patients are linked into household and family units. When a TB, HIV, or heritable condition diagnosis is recorded, household exposure alerts fire automatically for linked members — turning individual care into population-level prevention.',
    color: '#3B9EFF',
  },
  {
    icon: ShieldCheck,
    title: 'Digital Procedural Consent',
    description: 'Paper consent forms are eliminated. Patients read procedure-specific risk and benefit information on their device or a clinic tablet, sign with finger or stylus, and a legally valid PDF is generated, stored in MinIO, and attached to the encounter — all before the procedure begins.',
    color: '#0AA98A',
  },
  {
    icon: Zap,
    title: 'Real-Time Queue Transparency',
    description: 'Patients see their live queue position, number of patients ahead, and estimated wait time — updated in real time via WebSocket from the moment they check in. A push alert fires the instant the nurse calls their name.',
    color: '#E8614D',
  },
];

const standardsGrid = [
  {
    standard: 'FHIR R4',
    org: 'HL7 International',
    icon: Network,
    color: '#0AA98A',
    description: 'Native FHIR R4 data model for patient records, clinical documents, lab results, medications, and encounters. Enables referrals, payer integration, and research export.',
  },
  {
    standard: 'SNOMED CT',
    org: 'SNOMED International',
    icon: Database,
    color: '#3B9EFF',
    description: 'Terminology-aware charting with SNOMED CT concept binding. Every diagnosis, finding, and procedure is codeable, searchable, and interoperable.',
  },
  {
    standard: 'ICD-10 CM/PCS',
    org: 'WHO / CMS',
    icon: FileText,
    color: '#E8614D',
    description: 'ICD-10-CM for diagnoses, ICD-10-PCS for procedures. Powers claims, medical aid billing, disease registry, and epidemiological reporting.',
  },
  {
    standard: 'DHIS2',
    org: 'University of Oslo',
    icon: Globe,
    color: '#0AA98A',
    description: '18 aggregate profiles (TB, malaria, HIV, NCD, maternal, neonatal, lab, ICU, HAI, surgical, nutrition, mental health, pharmacy, cervical cancer & more). Full bi-directional sync — push clinical data to DHIS2 and pull facility vs district vs national benchmarks back into the doctor dashboard with trend indicators. Tracker TEI sync with real-time event push for encounters, lab results, and vital signs. Pre-submission validation rules engine catches logical errors (e.g. ANC4 > ANC1) before data reaches DHIS2.',
  },
  {
    standard: 'LOINC',
    org: 'Regenstrief Institute',
    icon: FlaskConical,
    color: '#3B9EFF',
    description: 'LOINC-coded laboratory and clinical observations. Enables lab result comparison, clinical trial matching, and research cohort queries.',
  },
  {
    standard: 'RxNorm',
    org: 'US NLM',
    icon: Activity,
    color: '#E8614D',
    description: 'RxNorm-coded medication events for drug interaction checking, dose validation, pharmacy workflows, and medication reconciliation.',
  },
  {
    standard: 'HIPAA',
    org: 'US HHS',
    icon: Lock,
    color: '#0AA98A',
    description: 'HIPAA-aware audit logging, access controls, and data handling practices. Every user action is logged, every access is role-gated, every record is attributable.',
  },
  {
    standard: 'HL7 v2 / CDA R2',
    org: 'HL7 International',
    icon: Workflow,
    color: '#3B9EFF',
    description: 'HL7 v2 ADT, ORU, and ORM messaging for lab and radiology system integration. CDA R2 for clinical document exchange with legacy hospital systems.',
  },
];

const modules = [
  { label: 'CDSS + AI Guidance', icon: Brain, color: '#0AA98A' },
  { label: 'PostVisit AI', icon: Sparkles, color: '#3B9EFF' },
  { label: 'Maternity + Newborn', icon: HeartPulse, color: '#E8614D' },
  { label: 'Diabetes + Chronic Care', icon: Activity, color: '#0AA98A' },
  { label: 'Vaccination + Preventive', icon: ShieldCheck, color: '#3B9EFF' },
  { label: 'Lab + Radiology', icon: FlaskConical, color: '#E8614D' },
  { label: 'HIV Program Workflow', icon: Users, color: '#0AA98A' },
  { label: 'Cancer + Oncology', icon: TrendingUp, color: '#3B9EFF' },
  { label: 'Emergency Department', icon: AlertCircle, color: '#E8614D' },
  { label: 'Cardiology', icon: HeartPulse, color: '#0AA98A' },
  { label: 'Ophthalmology', icon: Zap, color: '#3B9EFF' },
  { label: 'Claims + Medical Aid', icon: Wallet, color: '#E8614D' },
  { label: 'Telemedicine + Video', icon: MessageSquare, color: '#0AA98A' },
  { label: 'Pharmacy + MAR', icon: Activity, color: '#3B9EFF' },
  { label: 'Blood Bank + Transfusion', icon: FlaskConical, color: '#E8614D' },
  { label: 'Infection Control', icon: Shield, color: '#0AA98A' },
  { label: 'Population Health', icon: BarChart3, color: '#3B9EFF' },
  { label: 'Patient App + Portal', icon: Smartphone, color: '#E8614D' },
  { label: 'Sickle Cell Disease', icon: Activity, color: '#E8614D' },
  { label: 'Epilepsy + NCD Register', icon: Zap, color: '#3B9EFF' },
  { label: 'Traditional Medicine CDSS', icon: Sparkles, color: '#0AA98A' },
  { label: 'Maternal Mortality Audit', icon: HeartPulse, color: '#E8614D' },
  { label: 'Ubuntu SDOH Wellbeing', icon: Users, color: '#0AA98A' },
  { label: 'NHIF / CBHI Insurance', icon: Wallet, color: '#3B9EFF' },
  { label: 'PACTR Clinical Trials', icon: FlaskConical, color: '#E8614D' },
  { label: 'Cross-border Continuity', icon: Globe, color: '#0AA98A' },
  { label: 'NCD Complications', icon: TrendingUp, color: '#3B9EFF' },
  { label: 'SaaS Billing Enforcer', icon: Wallet, color: '#0AA98A' },
  { label: 'Deployment Mode Gating', icon: Lock, color: '#3B9EFF' },
  { label: 'CRVS Civil Registration', icon: FileText, color: '#E8614D' },
  { label: 'Multilingual Mobile (8 langs)', icon: Globe, color: '#0AA98A' },
  { label: 'Proactive Risk Engine', icon: TrendingUp, color: '#E8614D' },
  { label: 'Mortality Risk Score', icon: HeartPulse, color: '#E8614D' },
  { label: 'AI Clinical Summary', icon: Sparkles, color: '#0AA98A' },
  { label: 'Care Gap Engine', icon: CheckCircle2, color: '#3B9EFF' },
  { label: 'AI Clinical Documents', icon: FileText, color: '#0AA98A' },
  { label: 'Drug Substitution AI', icon: Activity, color: '#3B9EFF' },
  { label: 'AI Follow-up Scheduler', icon: Workflow, color: '#E8614D' },
  { label: 'AI Lab Narratives', icon: FlaskConical, color: '#0AA98A' },
  { label: 'Appointment AI Brief', icon: Brain, color: '#3B9EFF' },
  { label: 'Ambient Voice AI', icon: MessageSquare, color: '#E8614D' },
  { label: 'Adherence Engine', icon: Activity, color: '#0AA98A' },
  { label: 'AI Timeline & Patterns', icon: TrendingUp, color: '#3B9EFF' },
  { label: 'CDSS Status Badges', icon: ShieldCheck, color: '#0AA98A' },
  { label: 'Telemedicine AI Bridge', icon: Zap, color: '#3B9EFF' },
  { label: 'Central Storeroom', icon: Database, color: '#0AA98A' },
  { label: 'Inventory Demand AI', icon: TrendingUp, color: '#3B9EFF' },
  { label: 'FEFO Expiry Tracking', icon: AlertCircle, color: '#E8614D' },
  { label: 'Procurement Automation', icon: Workflow, color: '#0AA98A' },
  { label: 'Stock Reservations', icon: CheckCircle2, color: '#3B9EFF' },
  { label: 'Expiry Risk Report', icon: BarChart3, color: '#E8614D' },
  { label: 'QR Patient Check-in', icon: Smartphone, color: '#0AA98A' },
  { label: 'Pre-Visit Digital Intake', icon: FileText, color: '#3B9EFF' },
  { label: 'Discharge to Patient App', icon: ArrowRight, color: '#E8614D' },
  { label: 'Wearable & Device Sync', icon: Activity, color: '#0AA98A' },
  { label: 'Referral Tracking Portal', icon: Network, color: '#3B9EFF' },
  { label: 'PRO → AI Risk Loop', icon: TrendingUp, color: '#E8614D' },
  { label: 'In-App Bill Payment', icon: Wallet, color: '#0AA98A' },
  { label: 'Real-Time Queue & Wait', icon: Zap, color: '#3B9EFF' },
  { label: 'Theatre Utilization', icon: BarChart3, color: '#E8614D' },
  { label: 'Post-Visit CSAT / NPS', icon: CheckCircle2, color: '#0AA98A' },
  { label: 'Mobile Ward Round', icon: Stethoscope, color: '#3B9EFF' },
  { label: 'Household Risk Graph', icon: Users, color: '#E8614D' },
  { label: 'Digital E-Consent + PDF', icon: ShieldCheck, color: '#0AA98A' },
  { label: 'Cross-Facility Stock', icon: Database, color: '#3B9EFF' },
  { label: 'Safe Sync Conflicts', icon: Shield, color: '#E8614D' },
  { label: 'WHO Partograph', icon: HeartPulse, color: '#0AA98A' },
  { label: 'Radiology Notifications', icon: AlertCircle, color: '#3B9EFF' },
  { label: 'Orthopaedics', icon: Activity, color: '#E8614D' },
  { label: 'ENT Module', icon: Stethoscope, color: '#0AA98A' },
  { label: 'Gastroenterology', icon: FlaskConical, color: '#3B9EFF' },
  { label: 'Rheumatology', icon: Activity, color: '#E8614D' },
  { label: 'Haematology', icon: FlaskConical, color: '#0AA98A' },
  { label: 'Urology', icon: Stethoscope, color: '#3B9EFF' },
  { label: 'Physiotherapy & Rehab', icon: TrendingUp, color: '#E8614D' },
  { label: 'Endocrinology', icon: Brain, color: '#0AA98A' },
  { label: 'NCD Comorbidity Bridge', icon: Network, color: '#3B9EFF' },
  { label: 'AHFoZ Tariff Claims', icon: Wallet, color: '#E8614D' },
  { label: 'X12 EDI 837P/835', icon: Code2, color: '#0AA98A' },
  { label: 'MCAZ Compliance', icon: Shield, color: '#3B9EFF' },
  { label: 'Notification Center', icon: MessageSquare, color: '#E8614D' },
  { label: 'Tiered Subscriptions', icon: BarChart3, color: '#0AA98A' },
  { label: 'Offline App Shell', icon: Zap, color: '#3B9EFF' },
  { label: 'Cardiac Catheterisation Lab', icon: HeartPulse, color: '#E8614D' },
  { label: 'CathLab AI Risk Panel', icon: Brain, color: '#0AA98A' },
  { label: 'ICU / Critical Care', icon: Activity, color: '#3B9EFF' },
  { label: 'ICU AI Quality Dashboard', icon: Sparkles, color: '#E8614D' },
  { label: 'NICU — Neonatal ICU', icon: HeartPulse, color: '#0AA98A' },
  { label: 'NICU Advanced (HIE, Echo)', icon: Brain, color: '#3B9EFF' },
  { label: 'Well-Baby Clinic', icon: Users, color: '#E8614D' },
  { label: 'EPI / Immunisation Programme', icon: ShieldCheck, color: '#0AA98A' },
  { label: 'Neonatal Screening (NBS)', icon: FlaskConical, color: '#3B9EFF' },
  { label: 'Dialysis / Renal Replacement', icon: Activity, color: '#E8614D' },
  { label: 'Aviation Medicine (CAAZ)', icon: Zap, color: '#0AA98A' },
  { label: 'Hyperbaric Oxygen (HBOT)', icon: TrendingUp, color: '#3B9EFF' },
  { label: 'Prosthetics & Orthotics', icon: Workflow, color: '#E8614D' },
  { label: 'Perinatal Mental Health (EPDS)', icon: HeartPulse, color: '#0AA98A' },
  { label: 'Post-NICU Developmental Follow-up', icon: CheckCircle2, color: '#3B9EFF' },
  { label: 'Patient Transport & Dispatch', icon: Network, color: '#E8614D' },
  { label: 'Aesthetics & Regenerative', icon: Sparkles, color: '#0AA98A' },
  { label: 'Paediatric Cardiology (CHD)', icon: HeartPulse, color: '#3B9EFF' },
  { label: 'Occupational Medicine (OEM)', icon: Shield, color: '#E8614D' },
  { label: 'OEM Surveillance & RTW', icon: TrendingUp, color: '#0AA98A' },
  { label: 'HIV Cascade Dashboards', icon: TrendingUp, color: '#E8614D' },
  { label: 'PMTCT / TB-HIV Cascades', icon: BarChart3, color: '#0AA98A' },
  { label: 'Equity & Disparity Analytics', icon: Users, color: '#3B9EFF' },
  { label: 'Multi-Facility Benchmarking', icon: BarChart3, color: '#E8614D' },
  { label: 'MDSR — Maternal Mortality Audit', icon: HeartPulse, color: '#0AA98A' },
  { label: 'Population Health & Care Gaps', icon: TrendingUp, color: '#3B9EFF' },
  { label: 'DHIS2 Validation & DQA Score', icon: CheckCircle2, color: '#E8614D' },
  { label: 'Extended DATIM MER Indicators', icon: Globe, color: '#0AA98A' },
  { label: 'Pharmacy Intelligence Reports', icon: Activity, color: '#3B9EFF' },
  { label: 'Lab Quality Assurance (EQA)', icon: FlaskConical, color: '#E8614D' },
  { label: 'AI Model Governance Registry', icon: Brain, color: '#0AA98A' },
  { label: 'Research Data Portal (HIPAA)', icon: ShieldCheck, color: '#3B9EFF' },
  { label: 'Mobile M&E Reports', icon: Smartphone, color: '#E8614D' },
  { label: 'Universal Report Export (PDF/XLSX)', icon: FileText, color: '#0AA98A' },
  { label: 'Monthly Report Bundle (ZIP)', icon: Database, color: '#3B9EFF' },
  { label: 'Outcome Linkage Engine', icon: Network, color: '#E8614D' },
];

const liveActivityItems = [
  { type: 'cdss', text: 'CDSS: Sepsis risk score elevated — initiating SIRS criteria review', color: '#E8614D' },
  { type: 'ai', text: 'PostVisit AI: Generating SNOMED-coded discharge summary...', color: '#0AA98A' },
  { type: 'herb', text: 'Herb-drug alert: Umhlonyane + Warfarin — MAJOR interaction flagged in ward round', color: '#E8614D' },
  { type: 'lang', text: 'Voice AI: Transcribed Setswana clinical notes → structured SOAP encounter', color: '#0AA98A' },
  { type: 'dhis2', text: 'DHIS2 sync: 14 ANC records pushed to national aggregate (Zambia MOH)', color: '#0AA98A' },
  { type: 'pactr', text: 'PACTR trial match: Patient eligible for Phase II SCD hydroxyurea dose optimisation trial', color: '#3B9EFF' },
  { type: 'fhir', text: 'FHIR R4: Patient bundle exported for cross-border SADC ART continuity transfer', color: '#3B9EFF' },
  { type: 'scd', text: 'SCD crisis: Vaso-occlusive crisis triage initiated — hydration + analgesia protocol loaded', color: '#E8614D' },
  { type: 'icd', text: 'ICD-10: Auto-suggested Z34.0 for ANC first trimester visit', color: '#0AA98A' },
  { type: 'billing', text: 'Billing enforcer: Demo tenant expired → suspended after 14-day trial period', color: '#E8614D' },
  { type: 'gating', text: 'Module gating: OR and Blood Bank routes hidden for clinic-mode tenant (Lusaka Primary)', color: '#3B9EFF' },
  { type: 'crvs', text: 'CRVS: Birth notification sent to Zimbabwe Civil Registry for patient ID NR-2026-00441', color: '#0AA98A' },
  { type: 'i18n', text: 'Mobile i18n: Device locale "sw-TZ" detected → app language switched to Swahili', color: '#3B9EFF' },
  { type: 'risk', text: 'Risk engine: Patient #4471 scored 87/100 (CRITICAL) — proactive alert dispatched to on-call nurse', color: '#E8614D' },
  { type: 'mortality', text: 'Mortality AI: 30-day risk 78% (HIGH) on post-op patient — ICU, age 71, NEWS2 score 8 — care team notified', color: '#E8614D' },
  { type: 'gap', text: 'Care gap engine: Diabetic patient overdue HbA1c by 94 days — lab order recommended', color: '#3B9EFF' },
  { type: 'doc', text: 'AI Documents: Nephrology referral letter drafted in 1.2s — awaiting clinician sign-off', color: '#0AA98A' },
  { type: 'drug', text: 'Drug substitution: Amoxicillin out of stock → Ampicillin 500mg suggested (CDSS confidence 80%)', color: '#0AA98A' },
  { type: 'followup', text: 'Follow-up AI: Post-discharge critical patient → 2-day in-person recall (urgent) recommended', color: '#E8614D' },
  { type: 'adherence', text: 'Adherence engine: Patient missed 4 of last 7 Metformin doses → personalised nudge sent via portal', color: '#3B9EFF' },
  { type: 'timeline', text: 'AI Timeline: Recurring respiratory infection pattern detected — 4 episodes in 14 months', color: '#0AA98A' },
  { type: 'storeroom', text: 'Storeroom AI: Paracetamol 500mg demand forecast — 340 units needed in 30 days (28% above seasonal baseline)', color: '#0AA98A' },
  { type: 'stock', text: 'Stock alert: Amoxicillin 250mg below reorder level at Ward 3 — purchase order auto-generated for supplier', color: '#E8614D' },
  { type: 'fefo', text: 'FEFO dispense: Batch EXP-2026-08 selected first for Metformin 500mg — 87 days to expiry', color: '#3B9EFF' },
  { type: 'subst',    text: 'Drug substitution: Ciprofloxacin 500mg out of stock → Norfloxacin 400mg suggested (ATC J01MA match, confidence 85%)', color: '#0AA98A' },
  { type: 'checkin',  text: 'QR check-in: Patient scanned at clinic door — record opened in 0.4s, visit timer started, queue position assigned', color: '#0AA98A' },
  { type: 'intake',   text: 'Pre-visit intake: Patient completed demographics, chief complaint, and CDPA consent 2 hours before arrival — encounter draft pre-filled', color: '#3B9EFF' },
  { type: 'discharge',text: 'Discharge push: Dr. Moyo tapped "Finalise & Send" — 3 documents (summary, Rx, follow-up) delivered to patient app in 1.8s', color: '#0AA98A' },
  { type: 'wearable', text: 'Wearable alert: Patient #3812 — 3 consecutive high SBP readings (152/162/158 mmHg) in last 24 h — trend alert raised', color: '#E8614D' },
  { type: 'queue',    text: 'Queue WS: Patient #4490 received "Your Turn!" notification — queue position 1, waited 18 minutes', color: '#3B9EFF' },
  { type: 'payment',  text: 'EcoCash payment confirmed: Invoice INV-2026-0441 (ZiG 85.00) — invoice marked paid, SMS receipt sent to patient', color: '#0AA98A' },
  { type: 'theatre',  text: 'Theatre AI: OR-2 utilization 74% today — 1 cancellation (patient unwell), on-time start rate 83%', color: '#E8614D' },
  { type: 'csat',     text: 'CSAT survey: 47 responses this week — avg 4.3★, NPS +62 — clinician Dr. Chikara top-rated (4.9★)', color: '#3B9EFF' },
  { type: 'ward',     text: 'Ward round mobile: Dr. Dube issued 3 SOAP notes and 2 medication orders from mobile — Ward B census complete at 07:52', color: '#0AA98A' },
  { type: 'household',text: 'Household alert: Patient diagnosed TB → household exposure alert raised for 3 linked members — screening recommended', color: '#E8614D' },
  { type: 'consent',  text: 'Digital consent: Laparoscopic cholecystectomy consent signed by patient on tablet — PDF archived to MinIO in 0.9s', color: '#3B9EFF' },
  { type: 'transfer', text: 'Stock transfer: AI recommends 200 units Amoxicillin 500mg from Facility B (surplus 340) → Facility A (shortage 60)', color: '#0AA98A' },
  { type: 'pro',      text: 'PRO risk loop: Patient pain score 8/10 submitted → risk recalculated 84/100 (HIGH) → outreach task created for Dr. Ndlovu', color: '#E8614D' },
  { type: 'referral', text: 'Referral update: Cardiology referral for patient #2204 → status "Appointment Scheduled: 2026-06-10" received via webhook', color: '#3B9EFF' },
  { type: 'partograph', text: 'WHO Partograph: Cervical dilation 7 cm at 14:00 — action line reached, oxytocin escalation protocol initiated for Mrs. Chikwanda', color: '#E8614D' },
  { type: 'radnotif',  text: 'Radiology notification: Chest X-ray report finalised — "Right lower lobe consolidation — pneumonia probable" sent to Dr. Moyo and Ward 2 nurse', color: '#3B9EFF' },
  { type: 'ent',       text: 'ENT CDSS: Centor score 4/4 — Strep throat highly likely → penicillin V 500 mg protocol loaded for patient at Beitbridge Clinic', color: '#0AA98A' },
  { type: 'ortho',     text: 'Orthopaedics: Gustilo Grade IIIB open tibial fracture — urgent orthopaedic consult and IV antibiotics ordered; Wells DVT score 3 (high probability)', color: '#E8614D' },
  { type: 'rheum',     text: 'Rheumatology CDSS: DAS28-ESR 5.2 (high activity) — treat-to-target step-up from MTX to MTX + HCQ combination recommended', color: '#0AA98A' },
  { type: 'edi',       text: 'X12 837P: Professional claim for Encounter #ENC-2026-8841 generated and submitted to CIMAS clearinghouse — claim ID CR-8841', color: '#3B9EFF' },
  { type: 'ahfoz',     text: 'AHFoZ claim: 3 tariff lines itemised (0113 GP consult + 1042 ECG + 0321 venepuncture) — total ZiG 185.50 auto-summed, claim ready for submission', color: '#0AA98A' },
  { type: 'mcaz',      text: 'MCAZ register: Morphine 10 mg/mL ampoule × 2 dispensed to patient #9021 — controlled-substance log entry captured with pharmacist signature', color: '#E8614D' },
  { type: 'notif',     text: 'Notification center: 24-hour appointment reminder batch — 47 SMS and 39 email reminders sent; 3 patients opted out of channel', color: '#3B9EFF' },
  { type: 'offline',   text: 'Offline replay: Power restored after 3-hour load-shedding — 14 queued vitals, 3 triage forms, and 1 ward round replayed idempotently; 0 conflicts', color: '#0AA98A' },
  { type: 'cathlab',  text: 'CathLab STEMI activation: Door-to-balloon timer started — 12-lead ECG uploaded, cath team paged, procedure room primed for primary PCI', color: '#E8614D' },
  { type: 'cathai',   text: 'CathLab AI: ACS risk 84% — contrast nephropathy risk HIGH (CKD stage 3, DM) → IV hydration protocol loaded before procedure', color: '#0AA98A' },
  { type: 'icu',      text: 'ICU AI alert: SOFA score increased from 6 → 9 over 24 h — sepsis bundle compliance 2/5 elements missing → automatic escalation to intensivist', color: '#E8614D' },
  { type: 'icuvent',  text: 'ICU ventilator: Patient on SIMV-VC, RSBI computed as 48 — spontaneous breathing trial initiated; VAP prevention bundle marked complete by nurse', color: '#3B9EFF' },
  { type: 'nicu',     text: 'NICU phototherapy: Bilirubin 285 μmol/L at 48 h of life (Bhutani high-intermediate zone) — double phototherapy commenced, recheck in 6 hours', color: '#E8614D' },
  { type: 'nicuhie',  text: 'NICU HIE: Grade II hypoxic-ischaemic encephalopathy confirmed — therapeutic hypothermia cooling initiated (33.5 °C target), neuroprotection protocol started', color: '#E8614D' },
  { type: 'wellbaby', text: 'Well-baby clinic: 6-week visit — WAZ −0.8, HAZ −0.5 (normal range); ASQ-3 score: all domains above cutoff; breastfeeding exclusively — next visit at 10 weeks', color: '#0AA98A' },
  { type: 'epi',      text: 'EPI programme: 14-week immunisation — DTP-HepB-Hib + PCV13 + Rota administered; cold-chain temperature 2.4 °C confirmed; AEFI none reported', color: '#3B9EFF' },
  { type: 'nbs',      text: 'Neonatal screening: Heel-prick result — TSH 68 mIU/L (flagged) → congenital hypothyroidism suspected → levothyroxine protocol initiated; paediatric endocrine referral raised', color: '#E8614D' },
  { type: 'dialysis', text: 'Dialysis session: 4-hour HD completed — Kt/V 1.42, ultrafiltration 2.1 L; AV fistula patent; no intra-dialytic hypotension; next session scheduled in 2 days', color: '#0AA98A' },
  { type: 'aviation', text: 'Aviation medicine: Class 1 medical renewal completed — BP 128/82, spirometry FEV1 98%, no disqualifying conditions found; CAAZ certificate issued, valid 12 months', color: '#3B9EFF' },
  { type: 'hbot',     text: 'HBOT session: Diabetic foot ulcer — 20th session completed at 2.4 ATA × 90 min; wound area reduced 38% vs baseline; granulation tissue positive', color: '#0AA98A' },
  { type: 'prosth',   text: 'Prosthetics: BKA patient — K3 level confirmed; transtibial prosthesis fitted; 6-minute walk test 310 m; physiotherapy referral issued for gait training', color: '#3B9EFF' },
  { type: 'epds',     text: 'Perinatal mental health: EPDS score 14 at 6-week postnatal visit (threshold exceeded) — maternal depression likely; urgent psychiatry referral raised; safeguarding flag set', color: '#E8614D' },
  { type: 'nicufu',   text: 'NICU follow-up: Corrected age 12 months — Bayley cognitive 95 (average), language 88 (slightly below); neurology referral raised; next visit at corrected 18 months', color: '#3B9EFF' },
  { type: 'transport',text: 'Patient transport: Inter-facility transfer — NICU patient to central hospital; vehicle dispatched (BAS-441Z), paramedic on board; handover document pre-populated', color: '#0AA98A' },
  { type: 'aesthetics',text: 'Aesthetics CDSS: Fitzpatrick type IV — fractional CO₂ contraindication flagged (high PIH risk); clinician switched to MNRF microneedling; consent recorded', color: '#3B9EFF' },
  { type: 'paedcard', text: 'Paediatric cardiology: VSD (large perimembranous) — PASP 52 mmHg — has_pulmonary_hypertension flagged → urgent paediatric cardiac surgery referral; SBE prophylaxis record created', color: '#E8614D' },
  { type: 'oem',      text: 'OEM: Pre-employment FFD — BP 172/106, hypertension stage 2 → CDSS triggered "temporarily unfit" category; specialist review flag raised; certificate withheld pending cardiology clearance', color: '#E8614D' },
  { type: 'oemsurveil',text: 'OEM surveillance: Silica dust exposure at quarry site — measured value 0.34 mg/m³ (OEL 0.05 mg/m³, exceeds_oel = true) → CDSS alert fired; respiratory protective equipment audit scheduled', color: '#3B9EFF' },
  { type: 'oemrtw',   text: 'OEM RTW: Graded return-to-work plan signed off by employer — patient back to light duties week 1, half duties week 2, full duties week 3; CDSS job-demand match: 0 conflicts', color: '#0AA98A' },
  { type: 'cascade',  text: 'HIV Cascade: 3rd 90 VL suppression 85.9% (Q2 2026) — 677 patients unsuppressed; mobile funnel chart exported to WhatsApp for district review meeting', color: '#0AA98A' },
  { type: 'equity',   text: 'Equity alert: Male 15–24 VL suppression 61.3% — 22.8 pp below average; auto-disparity flag raised; M&E officer notified via mobile app', color: '#E8614D' },
  { type: 'mdsr',     text: 'MDSR review: Maternal death #MDR-2026-014 — Delay 3 (facility) classified as preventable; 3 action items created and assigned to nursing management', color: '#E8614D' },
  { type: 'dqa',      text: 'DHIS2 DQA: TX_CURR outlier detected — local count 1,204 vs DHIS2 estimate 1,100 (9.5% deviation, WARNING); investigation alert raised for data officer', color: '#3B9EFF' },
  { type: 'pharmrpt', text: 'Pharmacy report: Formulary adherence 88.4% (target >95%); drug waste $14,280 in Jun 2026; AMS pending reviews 6 — report exported to PDF and emailed to pharmacy manager', color: '#0AA98A' },
  { type: 'labqa',    text: 'Lab QA: 14 internal QC failures this month (↑3 vs May); creatinine top failure (5); critical value notification within 1 hour 94.2% — P95 TAT 14.8 h (target <12 h)', color: '#3B9EFF' },
  { type: 'aidrft',   text: 'AI governance: Deterioration risk model drift detected — AUC 0.689 (↓0.052 vs baseline); model flagged for mandatory review; governance board notified', color: '#E8614D' },
  { type: 'research', text: 'Research portal: External collaborator token issued (24-hour, 3-use); de-identified cohort of 842 HIV patients exported as CSV — 18 PHI identifiers suppressed per HIPAA Safe Harbor', color: '#0AA98A' },
  { type: 'mobileRpt',text: 'Mobile M&E: District health officer pulled MDSR summary and equity heat grid on mobile during ward round; shared cascade funnel screenshot to district WhatsApp group', color: '#3B9EFF' },
  { type: 'pdfexport',text: 'Report export: "HIV 95-95-95 Programme Report — Q2 2026" generated in 1.4 s (A4 PDF, UMOYA branded, teal header, facility watermark) — downloaded by M&E coordinator', color: '#0AA98A' },
  { type: 'bundle',   text: 'Monthly bundle: 7 programme PDFs (HIV, PMTCT, TB-HIV, NCD, maternal, pharmacy, lab QA) zipped and emailed to district health officer — umoya-monthly-bundle-202606.zip (1.2 MB)', color: '#3B9EFF' },
  { type: 'benchmark',text: 'Benchmarking: Facility percentile rank 68th on VL suppression; above district on 7/10 indicators; below national on TB treatment success rate — peer comparison chart updated', color: '#E8614D' },
  { type: 'datim',    text: 'DATIM MER: TB_PREV indicator submitted — 342 patients on TPT during Q2; HTS_SELF indicator 87 self-test kits distributed; PEPFAR reporting period closed', color: '#0AA98A' },
  { type: 'outcome',  text: 'Outcome linkage: 14 patients LTFU (>90 days past expected visit) auto-detected; follow-up schedule triggered; 3 patients with matching re-admission linked via encounter join', color: '#3B9EFF' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const logoSrc = `${process.env.PUBLIC_URL || ''}/umoya-dark.png`;
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    fullName: '',
    clinicName: '',
    workEmail: '',
    phone: '',
    roleTitle: '',
    specialization: '',
    currentSystem: '',
    interestSummary: '',
    preferredContactMethod: 'email' as ContactMethod,
  });
  const [interestAreas, setInterestAreas] = useState<string[]>([
    'PostVisit AI',
    'CDSS and AI decision support',
    'Maternity and newborn care',
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeActivity, setActiveActivity] = useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveActivity((prev) => (prev + 1) % liveActivityItems.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const selectedInterests = useMemo(() => new Set(interestAreas), [interestAreas]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleInterest = (option: string) => {
    setInterestAreas((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    );
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (interestAreas.length === 0) {
      setError('Select at least one area of interest.');
      return;
    }

    setSubmitting(true);
    try {
      await tenantApi.submitDemoAccessRequest({ ...form, interestAreas });
      setSuccess('Request received. We will review it and prepare guided test access for your clinic.');
      setForm({
        fullName: '',
        clinicName: '',
        workEmail: '',
        phone: '',
        roleTitle: '',
        specialization: '',
        currentSystem: '',
        interestSummary: '',
        preferredContactMethod: 'email',
      });
      setInterestAreas(['PostVisit AI', 'CDSS and AI decision support', 'Maternity and newborn care']);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to submit your request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070C17] text-[#E2EDF8]">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 1; }
          70% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes float-up {
          0% { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.97); }
        }
        .marquee-track { animation: marquee 32s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
        .marquee-track-slow { animation: marquee 48s linear infinite; }
        .marquee-track-slow:hover { animation-play-state: paused; }
        .marquee-track-rev { animation: marquee 44s linear infinite reverse; }
        .marquee-track-rev:hover { animation-play-state: paused; }
        .activity-item { animation: float-up 0.5s ease forwards; }
        .orb-1 { animation: orb-drift 18s ease-in-out infinite; }
        .orb-2 { animation: orb-drift 24s ease-in-out infinite reverse; }
        .orb-3 { animation: orb-drift 20s ease-in-out infinite 6s; }
        .pulse-ring::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid currentColor;
          animation: pulse-ring 2.5s ease-out infinite;
        }
        .glow-teal { box-shadow: 0 0 40px rgba(10, 169, 138, 0.25), 0 0 80px rgba(10, 169, 138, 0.1); }
        .glow-blue { box-shadow: 0 0 40px rgba(59, 158, 255, 0.25), 0 0 80px rgba(59, 158, 255, 0.1); }
        .glow-orange { box-shadow: 0 0 40px rgba(232, 97, 77, 0.25), 0 0 80px rgba(232, 97, 77, 0.1); }
        .card-hover { transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-4px); }
        .gradient-text-teal {
          background: linear-gradient(135deg, #0AA98A 0%, #1B6B3A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gradient-text-coral {
          background: linear-gradient(135deg, #E8614D 0%, #F0954A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gradient-text-brand {
          background: linear-gradient(135deg, #0AA98A 0%, #3B9EFF 60%, #1B6B3A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb-1 absolute top-[-12rem] left-1/2 -translate-x-1/2 h-[50rem] w-[50rem] rounded-full bg-[#0AA98A]/[0.08] blur-3xl" />
        <div className="orb-2 absolute right-[-12rem] top-[25rem] h-[36rem] w-[36rem] rounded-full bg-[#1B6B3A]/[0.10] blur-3xl" />
        <div className="orb-3 absolute bottom-[-15rem] left-[-8rem] h-[40rem] w-[40rem] rounded-full bg-[#E8614D]/[0.05] blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ── HEADER ── */}
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070C17]/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
            <button
              className="flex items-center gap-3"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <img src={logoSrc} alt="Umoya" className="h-9 w-auto md:h-10" style={{ mixBlendMode: 'screen' }} />
              <div className="text-left leading-none">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#5A78A0]">Umoya</div>
                <div
                  style={{ fontFamily: '"Fraunces", serif' }}
                  className="text-[18px] font-bold text-white"
                >
                  Clinical Intelligence
                </div>
              </div>
            </button>

            <nav className="hidden items-center gap-7 text-sm text-[#8FA8CC] lg:flex">
              <a href="#why" className="transition-colors hover:text-white">Why Umoya</a>
              <a href="#ai" className="transition-colors hover:text-white">AI & CDSS</a>
              <a href="#dhis2" className="transition-colors hover:text-white">DHIS2</a>
              <a href="#standards" className="transition-colors hover:text-white">Standards</a>
              <a href="#modules" className="transition-colors hover:text-white">Modules</a>
              <a href="#request-access" className="transition-colors hover:text-white">Get Access</a>
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/tenants')}
                className="hidden rounded-full border border-[#1E3050] bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#C5D5EE] transition hover:border-[#3B9EFF]/50 hover:bg-white/[0.08] lg:block"
              >
                Tenant Login
              </button>
              <button
                onClick={() => document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-full bg-gradient-to-r from-[#0AA98A] to-[#0D9479] px-4 py-2 text-xs font-bold text-[#040A10] transition hover:from-[#12BFAB] hover:to-[#0AA98A] sm:px-5 sm:text-sm"
              >
                Request Access
              </button>
            </div>
          </div>
        </header>

        <main>
          {/* ── HERO ── */}
          <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-5 lg:px-8 lg:pt-24">
            <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:items-start">
              {/* Left */}
              <div>
                <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#0AA98A]/30 bg-[#0AA98A]/[0.10] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#5DDBB8]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0AA98A] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0AA98A]" />
                  </span>
                  Breath · Intelligence · Continuity of Care
                </div>

                <h1
                  style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', letterSpacing: '-0.025em' }}
                  className="text-[2.6rem] font-extrabold leading-[1.02] text-white sm:text-[3.4rem] md:text-[4.2rem] xl:text-[5rem]"
                >
                  <span className="gradient-text-teal">Every breath.</span>
                  <br />
                  <span className="text-[#E2EDF8]">Every patient.</span>
                  <br />
                  <span className="text-[#E2EDF8]/55">Every facility.</span>
                </h1>

                <p className="mt-7 max-w-2xl text-[1.05rem] leading-[1.9] text-[#7A9CBC]">
                  Umoya is the clinical operating system built for Africa and the world. AI-first, offline-capable, and deeply human — 125+ clinical modules, 40+ AI capabilities, FHIR R4, DHIS2, SNOMED CT, and a multilingual mobile app in 8 languages. Designed for clinicians in Harare, Johannesburg, Nairobi, Lusaka, Maputo — and everywhere care cannot wait for a signal.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={() => document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' })}
                    className="glow-teal inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0AA98A] to-[#0D9479] px-6 py-3 text-sm font-bold text-[#040A10] transition hover:from-[#12BFAB] hover:to-[#0AA98A] sm:px-7 sm:py-3.5"
                  >
                    Request Guided Test Access
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigate('/tenants')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1E3A5F] bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:border-[#3B9EFF]/60 hover:bg-white/[0.08] sm:px-7 sm:py-3.5"
                  >
                    Clinic Login Directory
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Compliance badges */}
                <div className="mt-8 flex flex-wrap gap-2">
                  {['SADC-first', 'FHIR R4', 'SNOMED CT', 'ICD-10', 'RxNorm', 'DHIS2 18-profile', 'LOINC', 'HIPAA-aware', 'HL7', 'X12 EDI', '125+ modules', '40+ AI capabilities', '8 languages', 'SaaS billing', 'CRVS', 'MCAZ', 'AHFoZ tariffs', 'Inventory AI', 'WHO Partograph', 'CathLab AI', 'ICU + NICU', 'EPI / NBS', 'Occ. Medicine', 'Tracker sync', 'Benchmark pull-back'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8FA8CC]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Key proof points */}
                <div className="mt-6 grid gap-3 grid-cols-1 sm:grid-cols-3">
                  {[
                    { icon: Brain, color: '#0AA98A', title: 'AI-First CDSS', sub: 'Real-time, protocol-linked, bedside' },
                    { icon: ShieldCheck, color: '#3B9EFF', title: 'HIPAA & FHIR', sub: 'Audit logs, structured, exportable' },
                    { icon: Globe, color: '#E8614D', title: 'SADC + Africa', sub: '16 SADC countries, 40+ languages' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="card-hover flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: item.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{item.title}</p>
                          <p className="text-xs text-[#6A88AA]">{item.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right — live AI activity panel */}
              <div className="rounded-[28px] border border-[#1A2E4A] bg-[#0A1525] shadow-[0_40px_120px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0D1C30] px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                      <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                      <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4A6A90]">Umoya AI Live Feed</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#0AA98A]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0AA98A] animate-pulse" />
                    Active
                  </span>
                </div>

                <div className="p-5 space-y-2 h-[500px] overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                  {liveActivityItems.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                        i === activeActivity
                          ? 'border-white/[0.12] bg-white/[0.06] opacity-100'
                          : 'border-transparent bg-transparent opacity-30'
                      }`}
                    >
                      <span
                        className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full"
                        style={{ background: item.color, boxShadow: i === activeActivity ? `0 0 8px ${item.color}` : 'none' }}
                      />
                      <p className="text-xs leading-5 text-[#B8CCEC]">{item.text}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/[0.06] bg-[#0D1C30] px-5 py-3 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#4A6A90] shrink-0 mr-1">Standards:</span>
                  {['FHIR R4', 'SNOMED CT', 'ICD-10', 'DHIS2', 'LOINC', 'RxNorm', 'HIPAA'].map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-[#1E3A5F] bg-[#0A1525] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6A9AC8]"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="border-t border-white/[0.06] px-5 py-3 space-y-2">
                  {[
                    { label: 'Sepsis Risk Score', val: '78%', color: '#E8614D', w: '78%' },
                    { label: 'ANC Cohort Coverage', val: '94%', color: '#0AA98A', w: '94%' },
                    { label: 'CDSS Alert Precision', val: '91%', color: '#3B9EFF', w: '91%' },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="text-[#7A9CC0]">{bar.label}</span>
                        <span className="font-bold" style={{ color: bar.color }}>{bar.val}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.07]">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: bar.w, background: bar.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── STANDARDS MARQUEE ── */}
          <section className="border-y border-white/[0.06] bg-[#060C16]/80 py-4 overflow-hidden">
            <div className="flex whitespace-nowrap">
              <div className="marquee-track flex gap-10 pr-10">
                {[...STANDARDS, ...STANDARDS].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 shrink-0">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                    />
                    <span
                      className="text-xs font-bold uppercase tracking-[0.28em]"
                      style={{ color: s.color }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── STATS ── */}
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-5 lg:px-8">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="card-hover rounded-[24px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent p-6 text-center backdrop-blur-sm"
                >
                  <div
                    style={{ fontFamily: '"Fraunces", serif' }}
                    className="gradient-text-teal text-3xl font-black md:text-4xl"
                  >
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">{stat.label}</div>
                  <div className="mt-1 text-xs text-[#6A88AA]">{stat.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── WHY UMOYA / AUDIENCE SEGMENTS ── */}
          <section id="why" className="mx-auto max-w-7xl px-4 py-10 sm:px-5 lg:px-8">
            <div className="mb-10 text-center">
              <div className="mb-3 inline-block text-xs font-bold uppercase tracking-[0.3em] text-[#5A78A0]">Built for every stakeholder</div>
              <h2
                style={{ fontFamily: '"Fraunces", serif' }}
                className="mx-auto max-w-3xl text-4xl font-black text-white md:text-5xl"
              >
                One platform.{' '}
                <span className="gradient-text-teal">Six compelling reasons</span>{' '}
                to switch.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[#7A9CC0]">
                Whether you are a clinician, a data scientist, or running an NGO program — Umoya has exactly what you need.
              </p>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {audiences.map((audience) => {
                const Icon = audience.icon;
                return (
                  <article
                    key={audience.tag}
                    className="card-hover group rounded-[24px] border border-white/[0.07] bg-[#0A1525]/80 p-6 backdrop-blur-sm hover:border-opacity-50"
                    style={{ '--hover-color': audience.color } as React.CSSProperties}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{
                          background: `${audience.color}15`,
                          border: `1px solid ${audience.color}35`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: audience.color }} />
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                        style={{ background: `${audience.color}12`, color: audience.color }}
                      >
                        {audience.tag}
                      </span>
                    </div>

                    <h3 className="text-[1.05rem] font-bold leading-snug text-white">
                      {audience.headline}
                    </h3>

                    <ul className="mt-4 space-y-2.5">
                      {audience.points.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 text-sm text-[#7A9CBC]">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: audience.color }}
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── AI / CDSS SHOWCASE ── */}
          <section id="ai" className="relative py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#070C17] via-[#060E1F] to-[#070C17]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(10,169,138,0.06),transparent)]" />

            <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
              <div className="mb-10 text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0AA98A]/20 bg-[#0AA98A]/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-[#5DDBB8]">
                  <Brain className="h-3.5 w-3.5" />
                  AI & Clinical Decision Support
                </div>
                <h2
                  style={{ fontFamily: '"Fraunces", serif' }}
                  className="mx-auto max-w-3xl text-4xl font-black text-white md:text-5xl"
                >
                  Intelligence wired into{' '}
                  <span className="gradient-text-teal">every clinical moment.</span>
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-[#7A9CC0]">
                  Not an AI chatbot bolted on the side. Umoya's CDSS fires at the point of care, PostVisit AI closes the loop, and every alert reaches the right person in real time.
                </p>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {aiFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="card-hover rounded-[24px] border border-white/[0.08] bg-gradient-to-b from-[#0D1829] to-[#070C17] p-6"
                    >
                      <div
                        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[18px] border"
                        style={{
                          background: `${feature.color}12`,
                          borderColor: `${feature.color}30`,
                          color: feature.color,
                        }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-bold text-white">{feature.title}</h3>
                      <p className="mt-2.5 text-sm leading-6 text-[#7A9AB8]">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── HEALTH STANDARDS DEEP DIVE ── */}
          <section id="standards" className="mx-auto max-w-7xl px-4 py-12 sm:px-5 lg:px-8">
            <div className="mb-10">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#5A78A0]">
                Global health informatics standards
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <h2
                  style={{ fontFamily: '"Fraunces", serif' }}
                  className="max-w-2xl text-4xl font-black text-white md:text-5xl"
                >
                  Built on the standards{' '}
                  <span className="gradient-text-orange">regulators require.</span>
                </h2>
                <p className="max-w-sm text-sm leading-6 text-[#7A9CC0] lg:text-right">
                  SNOMED CT, ICD-10, FHIR R4, LOINC, RxNorm, DHIS2, HL7, HIPAA, DICOM — every one baked into the core data model, not an afterthought.
                </p>
              </div>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {standardsGrid.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.standard}
                    className="card-hover rounded-[22px] border border-white/[0.07] bg-[#0A1525]/70 p-5 backdrop-blur-sm"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: item.color }} />
                      </div>
                      <span className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#4A6A8A] border border-white/[0.06] bg-white/[0.03]">
                        {item.org}
                      </span>
                    </div>
                    <h3
                      className="text-base font-black"
                      style={{ color: item.color }}
                    >
                      {item.standard}
                    </h3>
                    <p className="mt-1.5 text-xs leading-5 text-[#6A88AA]">{item.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Bottom trust banner */}
            <div className="mt-8 rounded-[24px] border border-[#1E3A5F]/80 bg-gradient-to-r from-[#0A1A30] via-[#0D1F35] to-[#0A1A30] p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#4A6A8A]">Why this matters</p>
                  <p className="mt-1 text-lg font-bold text-white">Structured data means better research, better reporting, and better patient outcomes.</p>
                  <p className="mt-1 text-sm text-[#7A9CC0]">
                    Every diagnosis you code in SNOMED CT, every lab result in LOINC, every drug in RxNorm is reusable, exportable, and interoperable. That is the difference between data and intelligence.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                  {['Research-ready', 'Referral-ready', 'Regulatory-ready', 'Interoperable'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#3B9EFF]/30 bg-[#3B9EFF]/10 px-4 py-1.5 text-xs font-bold text-[#90C4FF]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── DHIS2 DEEP-DIVE ── */}
          <section id="dhis2" className="relative py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#070C17] via-[#060E1F] to-[#070C17]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(232,97,77,0.06),transparent)]" />
            <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
              <div className="mb-10 text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E8614D]/20 bg-[#E8614D]/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-[#F4896A]">
                  <Globe className="h-3.5 w-3.5" />
                  DHIS2 — Deepest Integration in Any Open EHR
                </div>
                <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mx-auto max-w-3xl text-4xl font-black text-white md:text-5xl">
                  Every clinical domain.{' '}
                  <span style={{ color: '#E8614D' }}>Both directions.</span>
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-[#7A9CC0]">
                  18 aggregate profiles sourced from live EHR data — push to DHIS2, pull benchmarks back. Patient-level tracker events for encounters, labs, and vitals. No manual data entry. No export files.
                </p>
              </div>

              {/* Aggregate profiles grid */}
              <div className="mb-10">
                <div className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-[#5A78A0]">18 Aggregate Profiles — Period-Filtered from Live Clinical Data</div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: 'Service Delivery', sub: 'OPD · Admissions · ED' },
                    { label: 'Maternal & Newborn', sub: 'ANC 1/4/8+ · Deliveries' },
                    { label: 'HIV Monthly', sub: 'VL Suppression · ART' },
                    { label: 'Immunization', sub: 'DTP1/3 · MCV1 · AEFI' },
                    { label: 'Pharmacy Stock', sub: 'On-hand · Dispensed' },
                    { label: 'Tuberculosis', sub: 'Notifications · Outcomes' },
                    { label: 'Malaria', sub: 'RDT+ · Species · Severity' },
                    { label: 'NCD', sub: 'HTN · DM · CKD · Stroke' },
                    { label: 'Outpatient Morbidity', sub: 'Top-10 ICD-10 by burden' },
                    { label: 'Laboratory', sub: 'Volume · TAT · Critical values' },
                    { label: 'Mental Health', sub: 'PHQ-9 · Suicide risk' },
                    { label: 'Nutrition (SAM/MAM)', sub: 'MUAC · Cure rates · RUTF' },
                    { label: 'ICU', sub: 'APACHE · LOS · Ventilator' },
                    { label: 'Infection Control', sub: 'SSI · CAUTI · MRSA · ESBL' },
                    { label: 'Surgical', sub: 'Volume · Complications · TAT' },
                    { label: 'Cervical Cancer', sub: 'VIA+ · Cryotherapy · LEEP' },
                    { label: 'Neonatal', sub: 'LBW · Apgar · SCBU · Deaths' },
                    { label: 'PMTCT', sub: 'HIV+ booking · Infant testing' },
                  ].map((p) => (
                    <div key={p.label} className="rounded-xl border border-[#1A2E4A] bg-[#0A1525] px-3 py-2.5">
                      <p className="text-xs font-bold text-white">{p.label}</p>
                      <p className="text-[10px] text-[#4A6A90]">{p.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Three pillars */}
              <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
                {[
                  {
                    color: '#E8614D',
                    title: 'Push — Zero Manual Entry',
                    points: [
                      'All 18 profiles queried from live EHR tables — no export, no CSV, no copy-paste',
                      'Metrics period-filtered (YYYYMM) so each monthly report reflects that month only',
                      'Data element IDs resolved dynamically from DHIS2 metadata by code',
                      'Auto period fallback when DHIS2 rejects a future period',
                      'Full retry queue with audit log; scheduler runs hourly per tenant',
                    ],
                  },
                  {
                    color: '#3B9EFF',
                    title: 'Tracker — Patient-Level Events',
                    points: [
                      'Patients pushed as TEIs with demographics; org unit and attribute IDs resolved from DHIS2',
                      'Encounters pushed as program stage events with ICD-10 diagnoses and ward',
                      'Lab results pushed as events with LOINC codes, values, units, and critical flags',
                      'Vital signs pushed as events with NEWS2 score when computed',
                      'Auto-enrollment in programs requiring registration before first event',
                    ],
                  },
                  {
                    color: '#0AA98A',
                    title: 'Pull-Back — Benchmarks in the EHR',
                    points: [
                      'Doctor dashboard pulls 10 key indicators from DHIS2 analytics — no login to DHIS2 required',
                      'TB cure rate, HIV VL suppression, malaria positivity, ANC4, BP control, ICU mortality, HAI cases, lab TAT, cervical screening, neonatal deaths',
                      'Facility vs district average vs national average — trend icon (▲ above / ▼ below / ≈ at par) on every KPI. Org unit hierarchy resolved automatically from DHIS2.',
                      'Graceful degradation to null when DHIS2 unavailable; mock mode for development',
                    ],
                  },
                ].map((pillar) => (
                  <div key={pillar.title} className="rounded-[20px] border border-white/[0.08] bg-gradient-to-b from-[#0D1829] to-[#070C17] p-5">
                    <div className="mb-3 h-1 w-10 rounded-full" style={{ background: pillar.color }} />
                    <h3 className="mb-3 text-sm font-bold text-white">{pillar.title}</h3>
                    <ul className="space-y-2">
                      {pillar.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2 text-xs leading-5 text-[#7A9AB8]">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: pillar.color }} />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Planned roadmap strip */}
              <div className="mt-8 rounded-2xl border border-[#1E3A5F]/60 bg-[#0A1525]/60 px-5 py-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#4A6A90]">On the roadmap</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'LLM-generated report narrative before DHIS2 submission',
                    'Programme indicator subscription → EHR alerts',
                    'DATIM MER v3 indicators',
                  ].map((item) => (
                    <span key={item} className="rounded-lg border border-[#1E3A5F] bg-[#070C17] px-2.5 py-1 text-[10px] text-[#4A6A90]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── CLINICAL MODULES ── */}
          <section id="modules" className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8 mb-8 text-center">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#5A78A0]">Clinical coverage</div>
              <h2
                style={{ fontFamily: '"Fraunces", serif' }}
                className="text-4xl font-black text-white md:text-5xl"
              >
                65+ modules.{' '}
                <span className="gradient-text-teal">Zero gaps in care.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#7A9CC0]">
                From emergency triage to central storeroom AI, from sickle cell disease to PACTR clinical trial matching — every clinical service line in Southern and Eastern Africa is covered, with 25+ AI capabilities wired into every surface.
              </p>
            </div>

            {/* First 3 rows — full cards */}
            <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                {modules.slice(0, 18).map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <div
                      key={mod.label}
                      className="card-hover flex flex-col items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#0A1525]/60 p-4 text-center"
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}30` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: mod.color }} />
                      </div>
                      <p className="text-[11px] font-semibold leading-4 text-[#B0C8E8]">{mod.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Remaining modules — two infinite ticker rows */}
            <div className="mt-4 space-y-2 overflow-hidden">
              {[modules.slice(18, 42), modules.slice(42)].map((row, rowIdx) => {
                const trackClass = rowIdx === 0 ? 'marquee-track-slow' : 'marquee-track-rev';
                const doubled = [...row, ...row];
                return (
                  <div key={rowIdx} className="flex whitespace-nowrap">
                    <div className={`${trackClass} flex gap-2 pr-2`}>
                      {doubled.map((mod, i) => {
                        const Icon = mod.icon;
                        return (
                          <div
                            key={`${mod.label}-${i}`}
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0A1525]/60 px-3 py-2"
                          >
                            <div
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}30` }}
                            >
                              <Icon className="h-3 w-3" style={{ color: mod.color }} />
                            </div>
                            <span className="text-[11px] font-semibold text-[#B0C8E8]">{mod.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── REQUEST ACCESS FORM ── */}
          <section id="request-access" className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-5 lg:px-8">
            {/* Section header */}
            <div className="mb-10 text-center">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#5A78A0]">Get started today</div>
              <h2
                style={{ fontFamily: '"Fraunces", serif' }}
                className="text-4xl font-black text-white md:text-5xl"
              >
                Request a guided{' '}
                <span className="gradient-text-teal">test environment.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#7A9CC0]">
                Not a throwaway sandbox. Tell us your specialty and what you want to validate — we provision the right tenant for your use case.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              {/* Left info panel */}
              <div className="rounded-[28px] border border-[#1A2E4A] bg-[#0A1525] p-7">
                <div className="space-y-5">
                  {[
                    {
                      icon: Users,
                      color: '#0AA98A',
                      title: 'Doctor-first review',
                      body: 'Every request is reviewed by someone who understands clinical workflows — not a sales bot.',
                    },
                    {
                      icon: Zap,
                      color: '#3B9EFF',
                      title: 'Provisioned tenant after approval',
                      body: 'A real test environment with your clinic\'s configuration. Not a generic demo.',
                    },
                    {
                      icon: Database,
                      color: '#E8614D',
                      title: 'Test any module end-to-end',
                      body: 'CDSS, PostVisit AI, proactive risk scoring, mortality prediction, AI documents, drug substitution, inventory demand forecasting, central storeroom management, follow-up scheduler, adherence engine, maternity, sickle cell, epilepsy, traditional medicine herb-drug, PACTR trials, Ubuntu SDOH, NHIF/CBHI, lab, radiology, HIV, oncology, DHIS2, claims, and more.',
                    },
                    {
                      icon: ShieldCheck,
                      color: '#0AA98A',
                      title: 'Standards compliance included',
                      body: 'Your test environment uses the same SNOMED CT, ICD-10, FHIR R4, and DHIS2 data model as production.',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex gap-4">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: item.color }} />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-5 text-[#6A88AA]">{item.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 rounded-[20px] border border-[#0AA98A]/20 bg-[#0AA98A]/[0.07] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DDBB0]">Who uses Umoya?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      'Private clinics',
                      'Specialist practices',
                      'NGO health programs',
                      'Research institutions',
                      'Public health teams',
                      'AI/data teams',
                      'Health IT integrators',
                    ].map((who) => (
                      <span
                        key={who}
                        className="rounded-full border border-[#0AA98A]/25 bg-[#0AA98A]/[0.08] px-3 py-1 text-[11px] font-semibold text-[#5DDBB8]"
                      >
                        {who}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right form */}
              <form
                onSubmit={submitRequest}
                className="rounded-[28px] border border-[#1A2E4A] bg-[#0A1525] p-6"
              >
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  {[
                    { field: 'fullName' as const, label: 'Full name', placeholder: 'Dr. Amara Nkosi', required: true, type: 'text' },
                    { field: 'clinicName' as const, label: 'Clinic or hospital', placeholder: 'Nairobi Regional Health Centre', required: true, type: 'text' },
                    { field: 'workEmail' as const, label: 'Work email', placeholder: 'doctor@clinic.umoya.health', required: true, type: 'email' },
                    { field: 'phone' as const, label: 'Phone', placeholder: '+27 / +254 / +260 ...', required: true, type: 'text' },
                    { field: 'roleTitle' as const, label: 'Role', placeholder: 'Consultant physician', required: false, type: 'text' },
                    { field: 'specialization' as const, label: 'Specialty', placeholder: 'Internal medicine, maternity, radiology', required: false, type: 'text' },
                  ].map((f) => (
                    <label key={f.field} className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A78A0]">{f.label}</span>
                      <input
                        required={f.required}
                        type={f.type}
                        value={form[f.field]}
                        onChange={(e) => updateField(f.field, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full rounded-2xl border border-[#1E3A5F] bg-[#070C17] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#3A5070] focus:border-[#0AA98A]/60 focus:ring-1 focus:ring-[#0AA98A]/20"
                      />
                    </label>
                  ))}
                </div>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A78A0]">Current system</span>
                  <input
                    value={form.currentSystem}
                    onChange={(e) => updateField('currentSystem', e.target.value)}
                    placeholder="Current EHR or clinical workflow pain point"
                    className="w-full rounded-2xl border border-[#1E3A5F] bg-[#070C17] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#3A5070] focus:border-[#0AA98A]/60 focus:ring-1 focus:ring-[#0AA98A]/20"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A78A0]">
                    Short request summary
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={form.interestSummary}
                    onChange={(e) => updateField('interestSummary', e.target.value)}
                    placeholder="Tell us what you want to test: CDSS, PostVisit AI, maternity, DHIS2 reporting, lab workflows, claims, or specialty modules."
                    className="w-full rounded-[20px] border border-[#1E3A5F] bg-[#070C17] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#3A5070] focus:border-[#0AA98A]/60 focus:ring-1 focus:ring-[#0AA98A]/20"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A78A0]">Preferred contact</span>
                  <select
                    value={form.preferredContactMethod}
                    onChange={(e) => updateField('preferredContactMethod', e.target.value as ContactMethod)}
                    className="w-full rounded-2xl border border-[#1E3A5F] bg-[#070C17] px-4 py-3 text-sm text-white outline-none transition focus:border-[#0AA98A]/60"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone call</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>

                {error && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#0AA98A]/25 bg-[#0AA98A]/[0.08] px-4 py-3 text-sm text-[#7AEEC8]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {success}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="glow-teal inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0AA98A] to-[#0D9479] px-7 py-3.5 text-sm font-bold text-[#040A10] transition hover:from-[#12BFAB] hover:to-[#0AA98A] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Request test access'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/tenants')}
                    className="inline-flex items-center gap-2 rounded-full border border-[#1E3A5F] bg-[#070C17] px-6 py-3.5 text-sm font-bold text-[#C5D5EE] transition hover:border-[#3B9EFF]/50"
                  >
                    Existing tenant login
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer className="border-t border-white/[0.06] bg-[#040A12]">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5 lg:px-8">
            <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-3">
                  <img src={logoSrc} alt="Umoya" className="h-8 w-auto" style={{ mixBlendMode: 'screen' }} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#4A6A8A]">Umoya</p>
                    <p className="text-sm font-bold text-white">Clinical Intelligence Platform</p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-6 text-[#5A7A9A]">
                  The clinical operating system built for Africa and the world. 125+ clinical modules · 40+ AI capabilities. Breath intelligence, offline-first, FHIR R4 · DHIS2 · SNOMED CT · 8 languages. Serving clinicians, hospitals, NGOs, and ministries of health across Southern, Eastern, and Western Africa.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {['FHIR R4', 'SNOMED CT', 'ICD-10', 'DHIS2', 'LOINC', 'SADC'].map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#3A5A7A]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Platform */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#4A6A8A]">Platform</p>
                <div className="mt-3 space-y-2 text-xs text-[#6A8AAA]">
                  {['CDSS + AI guidance', 'PostVisit AI', 'Proactive risk scoring', 'Mortality risk prediction', 'AI clinical summary panel', 'AI-generated documents', 'Drug substitution engine', 'Inventory demand forecasting', 'Storeroom anomaly detection', 'Expiry risk AI', 'AI follow-up scheduler', 'AI lab interpretation', 'Predictive adherence engine', 'AI clinical timeline', 'Treatment gap engine', 'Appointment AI brief', 'Ambient voice AI', 'AI communication hub', 'Central storeroom management', 'FEFO expiry tracking', 'Procurement automation', 'SaaS billing enforcer', 'Deployment mode gating', 'CRVS civil registration', 'Multilingual mobile (8 langs)', 'FHIR R4 data model', 'DHIS2 integration', 'SNOMED CT charting', 'Real-time alert delivery', 'Telemedicine AI bridge', 'Patient portal'].map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              {/* Clinical focus */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#4A6A8A]">Clinical Focus</p>
                <div className="mt-3 space-y-2 text-xs text-[#6A8AAA]">
                  {['Maternity + newborn', 'Diabetes + chronic care', 'Lab + radiology', 'HIV program workflow', 'Cancer + oncology', 'Emergency department', 'Sickle cell + haemoglobinopathy', 'Epilepsy + NCD register', 'Traditional medicine CDSS', 'Maternal mortality audit', 'Ubuntu SDOH wellbeing', 'NHIF / CBHI insurance', 'Claims + billing', 'Care gap detection', 'Radiology AI findings', 'Drug substitution AI', 'Central storeroom', 'FEFO expiry management', 'Emergency kit tracking', 'ARV stock vs patient load', 'Procurement automation'].map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              {/* Explore */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#4A6A8A]">Explore</p>
                <div className="mt-3 flex flex-col gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => navigate('/tenants')}
                    className="text-left text-[#6A8AAA] transition hover:text-white"
                  >
                    Existing tenant login
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-left text-[#6A8AAA] transition hover:text-white"
                  >
                    Request test access
                  </button>
                  <a href="#ai" className="text-left text-[#6A8AAA] transition hover:text-white">
                    AI & CDSS features
                  </a>
                  <a href="#standards" className="text-left text-[#6A8AAA] transition hover:text-white">
                    Health standards
                  </a>
                  <a href="#modules" className="text-left text-[#6A8AAA] transition hover:text-white">
                    Clinical modules
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.05] px-5 py-4 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-[#3A5A7A]">
                © {currentYear} Umoya Health. Breath · Intelligence · Continuity of Care. 125+ modules · 40+ AI capabilities · 8 languages · FHIR R4 · DHIS2.
              </p>
              <p className="text-[11px] text-[#2A4060]">
                FHIR R4 · SNOMED CT · ICD-10 · DHIS2 · LOINC · RxNorm · HIPAA-aware · HL7 · PACTR · 40+ languages
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
