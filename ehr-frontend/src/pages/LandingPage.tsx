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
];

const STANDARDS = [
  { label: 'FHIR R4', color: '#00C896' },
  { label: 'SNOMED CT', color: '#2B7FFF' },
  { label: 'ICD-10-CM', color: '#FF7A40' },
  { label: 'ICD-10-PCS', color: '#00C896' },
  { label: 'RxNorm', color: '#2B7FFF' },
  { label: 'DHIS2', color: '#FF7A40' },
  { label: 'HL7 v2/v3', color: '#00C896' },
  { label: 'HIPAA', color: '#2B7FFF' },
  { label: 'LOINC', color: '#FF7A40' },
  { label: 'OpenEHR', color: '#00C896' },
  { label: 'CDA R2', color: '#2B7FFF' },
  { label: 'DICOM', color: '#FF7A40' },
];

const stats = [
  { value: '50+', label: 'Clinical modules', sub: 'From maternity to traditional medicine' },
  { value: 'FHIR R4', label: 'Native data model', sub: 'Structured, exportable, referrable' },
  { value: 'Real-time', label: 'CDSS alerts', sub: 'Dose checks, risk flags, protocols' },
  { value: 'DHIS2', label: 'Program reporting', sub: 'HIV, maternal, vaccine cohorts' },
];

const audiences = [
  {
    icon: Stethoscope,
    tag: 'Clinicians & Doctors',
    color: '#00C896',
    headline: 'AI that works at the bedside, not in a slide deck.',
    points: [
      'CDSS dose checks and risk flags in every encounter',
      'PostVisit AI summaries with patient-safe publishing',
      'Specialty-specific workflows: HIV, oncology, maternity, cardiology',
      'Real-time doctor-nurse coordination and alert loops',
      'Offline-first mobile — ward rounds work without Wi-Fi; vitals queue and sync automatically',
    ],
  },
  {
    icon: Building2,
    tag: 'Private Clinics & Hospitals',
    color: '#2B7FFF',
    headline: 'One platform. Every revenue line. Zero gaps.',
    points: [
      'Claims, medical-aid, and billing in the same system',
      'Multi-tenant architecture — isolate each facility',
      'Lab, radiology, pharmacy, and nursing all connected',
      'Patient portal for post-visit engagement and retention',
    ],
  },
  {
    icon: Shield,
    tag: 'Compliance & HIPAA Teams',
    color: '#FF7A40',
    headline: 'Audit trails. Structured data. Defensible records.',
    points: [
      'HIPAA-aware audit logging on every action',
      'SNOMED CT and ICD-10 coded clinical data',
      'Cross-tenant JWT validation — tokens are clinic-scoped and cannot replay across facilities',
      'Biometric app lock, session auto-lock, and offline PHI cache wipe on logout',
      'FHIR-exportable records for referrals and transfers',
    ],
  },
  {
    icon: BarChart3,
    tag: 'AI Researchers & Data Scientists',
    color: '#00C896',
    headline: 'Structured clinical data. Research-ready pipelines.',
    points: [
      'SNOMED CT terminology-aware charting from day one',
      'FHIR R4 export for cohort building and analytics',
      'DHIS2 integration for population-level program data',
      'LOINC-coded lab results and RxNorm medication events',
    ],
  },
  {
    icon: Globe,
    tag: 'NGOs & Public Health Programs',
    color: '#2B7FFF',
    headline: 'DHIS2-native reporting. Program visibility at scale.',
    points: [
      'HIV program workflows with cohort and retention tracking',
      'Vaccination registers and immunization schedules',
      'DHIS2 aggregate and tracker data push',
      'Maternal health, TB, NCD, sickle cell, and epilepsy program dashboards',
      'SORMAS + IHR Annex 2 outbreak notification and PACTR trial registry integration',
      'Offline point-of-care mobile — works on 2G/3G and without Wi-Fi in remote facilities',
    ],
  },
  {
    icon: Code2,
    tag: 'Health IT Teams & Integrators',
    color: '#FF7A40',
    headline: 'Open standards. Clean APIs. Real interoperability.',
    points: [
      'FHIR R4 REST API with full resource coverage',
      'HL7 v2/v3 and CDA R2 for legacy system bridges',
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
    color: '#00C896',
  },
  {
    icon: FileText,
    title: 'PostVisit AI',
    description: 'AI-generated post-visit summaries with grounded follow-up instructions, patient-safe language publishing, and full signoff workflow before delivery.',
    color: '#2B7FFF',
  },
  {
    icon: AlertCircle,
    title: 'Real-time Clinical Alerts',
    description: 'Abnormal vitals, critical lab results, sepsis indicators, and nurse task overdue notifications reach the right person on the right screen in real time.',
    color: '#FF7A40',
  },
  {
    icon: Sparkles,
    title: 'AI Documentation Support',
    description: 'Terminology-aware charting that suggests SNOMED CT concepts, ICD-10 codes, and structured coding as the clinician types — no manual lookup required.',
    color: '#00C896',
  },
  {
    icon: TrendingUp,
    title: 'Population Health & Risk Stratification',
    description: 'Cohort-level chronic disease dashboards, vaccination coverage tracking, and HIV/TB program retention analytics using the same operational data.',
    color: '#2B7FFF',
  },
  {
    icon: Zap,
    title: 'Telemedicine + Async AI Review',
    description: 'Video consultations, secure async messaging, and AI-assisted consultation notes in a single integrated telemedicine workflow.',
    color: '#FF7A40',
  },
  {
    icon: Globe,
    title: 'SADC & Africa-Specific AI',
    description: 'Herb-drug interaction alerts for traditional medicine disclosures, sickle cell crisis triage, PACTR clinical trial matching, Ubuntu psychosocial SDOH scoring, and IHR Annex 2 outbreak notification — built for the African clinical context.',
    color: '#00C896',
  },
];

const standardsGrid = [
  {
    standard: 'FHIR R4',
    org: 'HL7 International',
    icon: Network,
    color: '#00C896',
    description: 'Native FHIR R4 data model for patient records, clinical documents, lab results, medications, and encounters. Enables referrals, payer integration, and research export.',
  },
  {
    standard: 'SNOMED CT',
    org: 'SNOMED International',
    icon: Database,
    color: '#2B7FFF',
    description: 'Terminology-aware charting with SNOMED CT concept binding. Every diagnosis, finding, and procedure is codeable, searchable, and interoperable.',
  },
  {
    standard: 'ICD-10 CM/PCS',
    org: 'WHO / CMS',
    icon: FileText,
    color: '#FF7A40',
    description: 'ICD-10-CM for diagnoses, ICD-10-PCS for procedures. Powers claims, medical aid billing, disease registry, and epidemiological reporting.',
  },
  {
    standard: 'DHIS2',
    org: 'University of Oslo',
    icon: Globe,
    color: '#00C896',
    description: 'Native DHIS2 integration for aggregate data push, tracker programs, and program reporting. HIV, maternal, vaccination, and NCD program visibility.',
  },
  {
    standard: 'LOINC',
    org: 'Regenstrief Institute',
    icon: FlaskConical,
    color: '#2B7FFF',
    description: 'LOINC-coded laboratory and clinical observations. Enables lab result comparison, clinical trial matching, and research cohort queries.',
  },
  {
    standard: 'RxNorm',
    org: 'US NLM',
    icon: Activity,
    color: '#FF7A40',
    description: 'RxNorm-coded medication events for drug interaction checking, dose validation, pharmacy workflows, and medication reconciliation.',
  },
  {
    standard: 'HIPAA',
    org: 'US HHS',
    icon: Lock,
    color: '#00C896',
    description: 'HIPAA-aware audit logging, access controls, and data handling practices. Every user action is logged, every access is role-gated, every record is attributable.',
  },
  {
    standard: 'HL7 v2 / CDA R2',
    org: 'HL7 International',
    icon: Workflow,
    color: '#2B7FFF',
    description: 'HL7 v2 ADT, ORU, and ORM messaging for lab and radiology system integration. CDA R2 for clinical document exchange with legacy hospital systems.',
  },
];

const modules = [
  { label: 'CDSS + AI Guidance', icon: Brain, color: '#00C896' },
  { label: 'PostVisit AI', icon: Sparkles, color: '#2B7FFF' },
  { label: 'Maternity + Newborn', icon: HeartPulse, color: '#FF7A40' },
  { label: 'Diabetes + Chronic Care', icon: Activity, color: '#00C896' },
  { label: 'Vaccination + Preventive', icon: ShieldCheck, color: '#2B7FFF' },
  { label: 'Lab + Radiology', icon: FlaskConical, color: '#FF7A40' },
  { label: 'HIV Program Workflow', icon: Users, color: '#00C896' },
  { label: 'Cancer + Oncology', icon: TrendingUp, color: '#2B7FFF' },
  { label: 'Emergency Department', icon: AlertCircle, color: '#FF7A40' },
  { label: 'Cardiology', icon: HeartPulse, color: '#00C896' },
  { label: 'Ophthalmology', icon: Zap, color: '#2B7FFF' },
  { label: 'Claims + Medical Aid', icon: Wallet, color: '#FF7A40' },
  { label: 'Telemedicine + Video', icon: MessageSquare, color: '#00C896' },
  { label: 'Pharmacy + MAR', icon: Activity, color: '#2B7FFF' },
  { label: 'Blood Bank + Transfusion', icon: FlaskConical, color: '#FF7A40' },
  { label: 'Infection Control', icon: Shield, color: '#00C896' },
  { label: 'Population Health', icon: BarChart3, color: '#2B7FFF' },
  { label: 'Patient App + Portal', icon: Smartphone, color: '#FF7A40' },
  { label: 'Sickle Cell Disease', icon: Activity, color: '#FF7A40' },
  { label: 'Epilepsy + NCD Register', icon: Zap, color: '#2B7FFF' },
  { label: 'Traditional Medicine CDSS', icon: Sparkles, color: '#00C896' },
  { label: 'Maternal Mortality Audit', icon: HeartPulse, color: '#FF7A40' },
  { label: 'Ubuntu SDOH Wellbeing', icon: Users, color: '#00C896' },
  { label: 'NHIF / CBHI Insurance', icon: Wallet, color: '#2B7FFF' },
  { label: 'PACTR Clinical Trials', icon: FlaskConical, color: '#FF7A40' },
  { label: 'Cross-border Continuity', icon: Globe, color: '#00C896' },
  { label: 'NCD Complications', icon: TrendingUp, color: '#2B7FFF' },
];

const liveActivityItems = [
  { type: 'cdss', text: 'CDSS: Sepsis risk score elevated — initiating SIRS criteria review', color: '#FF7A40' },
  { type: 'ai', text: 'PostVisit AI: Generating SNOMED-coded discharge summary...', color: '#00C896' },
  { type: 'herb', text: 'Herb-drug alert: Umhlonyane + Warfarin — MAJOR interaction flagged in ward round', color: '#FF7A40' },
  { type: 'lang', text: 'Voice AI: Transcribed Setswana clinical notes → structured SOAP encounter', color: '#00C896' },
  { type: 'dhis2', text: 'DHIS2 sync: 14 ANC records pushed to national aggregate (Zambia MOH)', color: '#00C896' },
  { type: 'pactr', text: 'PACTR trial match: Patient eligible for Phase II SCD hydroxyurea dose optimisation trial', color: '#2B7FFF' },
  { type: 'fhir', text: 'FHIR R4: Patient bundle exported for cross-border SADC ART continuity transfer', color: '#2B7FFF' },
  { type: 'scd', text: 'SCD crisis: Vaso-occlusive crisis triage initiated — hydration + analgesia protocol loaded', color: '#FF7A40' },
  { type: 'icd', text: 'ICD-10: Auto-suggested Z34.0 for ANC first trimester visit', color: '#00C896' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const logoSrc = `${process.env.PUBLIC_URL || ''}/medicore.png`;
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
    <div className="min-h-screen overflow-x-hidden bg-[#080E1A] text-[#E8F0FF]">
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
        .glow-teal { box-shadow: 0 0 40px rgba(0, 200, 150, 0.25), 0 0 80px rgba(0, 200, 150, 0.1); }
        .glow-blue { box-shadow: 0 0 40px rgba(43, 127, 255, 0.25), 0 0 80px rgba(43, 127, 255, 0.1); }
        .glow-orange { box-shadow: 0 0 40px rgba(255, 122, 64, 0.25), 0 0 80px rgba(255, 122, 64, 0.1); }
        .card-hover { transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-4px); }
        .gradient-text-teal {
          background: linear-gradient(135deg, #00C896 0%, #2B7FFF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gradient-text-orange {
          background: linear-gradient(135deg, #FF7A40 0%, #FFB347 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb-1 absolute top-[-12rem] left-1/2 -translate-x-1/2 h-[50rem] w-[50rem] rounded-full bg-[#00C896]/[0.07] blur-3xl" />
        <div className="orb-2 absolute right-[-12rem] top-[25rem] h-[36rem] w-[36rem] rounded-full bg-[#2B7FFF]/[0.09] blur-3xl" />
        <div className="orb-3 absolute bottom-[-15rem] left-[-8rem] h-[40rem] w-[40rem] rounded-full bg-[#FF7A40]/[0.06] blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ── HEADER ── */}
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080E1A]/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8">
            <button
              className="flex items-center gap-3"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div className="rounded-2xl border border-[#1E3A5F] bg-white/90 p-1.5 shadow-[0_0_30px_rgba(0,200,150,0.15)]">
                <img src={logoSrc} alt="MediCore" className="h-9 w-auto md:h-10" />
              </div>
              <div className="text-left leading-none">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#5A78A0]">MediCore</div>
                <div
                  style={{ fontFamily: '"Fraunces", serif' }}
                  className="text-[18px] font-bold text-white"
                >
                  Clinical Intelligence
                </div>
              </div>
            </button>

            <nav className="hidden items-center gap-7 text-sm text-[#8FA8CC] lg:flex">
              <a href="#why" className="transition-colors hover:text-white">Why MediCore</a>
              <a href="#ai" className="transition-colors hover:text-white">AI & CDSS</a>
              <a href="#standards" className="transition-colors hover:text-white">Standards</a>
              <a href="#modules" className="transition-colors hover:text-white">Modules</a>
              <a href="#request-access" className="transition-colors hover:text-white">Get Access</a>
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/tenants')}
                className="hidden rounded-full border border-[#1E3050] bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#C5D5EE] transition hover:border-[#2B7FFF]/50 hover:bg-white/[0.08] lg:block"
              >
                Tenant Login
              </button>
              <button
                onClick={() => document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-full bg-gradient-to-r from-[#00C896] to-[#00B080] px-4 py-2 text-xs font-bold text-[#051119] transition hover:from-[#00D9A3] hover:to-[#00C896] sm:px-5 sm:text-sm"
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
                <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#00C896]/25 bg-[#00C896]/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-[#6EE7C2]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00C896] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00C896]" />
                  </span>
                  SADC-first · Built for Africa · Used globally
                </div>

                <h1
                  style={{ fontFamily: '"Fraunces", serif' }}
                  className="text-[2.4rem] font-black leading-[0.95] tracking-tight text-white sm:text-[3.2rem] md:text-[4rem] xl:text-[5rem]"
                >
                  The EHR that{' '}
                  <span className="gradient-text-teal">thinks with you.</span>
                  <br />
                  <span className="text-[#E8F0FF]/80">Not against you.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-[1.05rem] leading-[1.85] text-[#8FAACA]">
                  MediCore is an AI-first clinical platform built for SADC, Africa, and beyond. Real-time CDSS, PostVisit AI, multilingual voice support (40+ languages), FHIR R4 interoperability, DHIS2 program reporting, and 40+ specialty workflows — designed for clinicians across Johannesburg, Nairobi, Lusaka, Gaborone, Maputo, and wherever care happens.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={() => document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' })}
                    className="glow-teal inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00C896] to-[#00A87A] px-6 py-3 text-sm font-bold text-[#051119] transition hover:from-[#00D9A3] hover:to-[#00C896] sm:px-7 sm:py-3.5"
                  >
                    Request Guided Test Access
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigate('/tenants')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1E3A5F] bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:border-[#2B7FFF]/60 hover:bg-white/[0.08] sm:px-7 sm:py-3.5"
                  >
                    Clinic Login Directory
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Compliance badges */}
                <div className="mt-8 flex flex-wrap gap-2">
                  {['SADC-first', 'FHIR R4', 'SNOMED CT', 'ICD-10', 'RxNorm', 'DHIS2', 'LOINC', 'HIPAA-aware', 'HL7', '50+ modules', '40+ languages'].map((tag) => (
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
                    { icon: Brain, color: '#00C896', title: 'AI-First CDSS', sub: 'Real-time, protocol-linked, bedside' },
                    { icon: ShieldCheck, color: '#2B7FFF', title: 'HIPAA & FHIR', sub: 'Audit logs, structured, exportable' },
                    { icon: Globe, color: '#FF7A40', title: 'SADC + Africa', sub: '16 SADC countries, 40+ languages' },
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
              <div className="rounded-[28px] border border-[#1A2E4A] bg-[#0A1525] shadow-[0_40px_120px_rgba(0,0,0,0.6)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0D1C30] px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                      <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                      <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4A6A90]">MediCore AI Live Feed</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#00C896]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00C896] animate-pulse" />
                    Active
                  </span>
                </div>

                <div className="p-5 space-y-2 min-h-[220px]">
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

                <div className="border-t border-white/[0.06] bg-[#0D1C30] px-5 py-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#4A6A90]">Platform standards layer</div>
                  <div className="flex flex-wrap gap-2">
                    {['FHIR R4', 'SNOMED CT', 'ICD-10', 'DHIS2', 'LOINC', 'RxNorm', 'HIPAA'].map((s) => (
                      <span
                        key={s}
                        className="rounded-lg border border-[#1E3A5F] bg-[#0A1525] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#6A9AC8]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-white/[0.06] px-5 py-5 space-y-3">
                  {[
                    { label: 'Sepsis Risk Score', val: '78%', color: '#FF7A40', w: '78%' },
                    { label: 'ANC Cohort Coverage', val: '94%', color: '#00C896', w: '94%' },
                    { label: 'CDSS Alert Precision', val: '91%', color: '#2B7FFF', w: '91%' },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="mb-1.5 flex justify-between text-[11px]">
                        <span className="text-[#7A9CC0]">{bar.label}</span>
                        <span className="font-bold" style={{ color: bar.color }}>{bar.val}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.07]">
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

          {/* ── WHY MEDICORE / AUDIENCE SEGMENTS ── */}
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
                Whether you are a clinician, a data scientist, or running an NGO program — MediCore has exactly what you need.
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
                        <li key={point} className="flex items-start gap-2.5 text-sm text-[#8FAACA]">
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
            <div className="absolute inset-0 bg-gradient-to-b from-[#080E1A] via-[#060E1F] to-[#080E1A]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(0,200,150,0.06),transparent)]" />

            <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
              <div className="mb-10 text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C896]/20 bg-[#00C896]/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-[#6EE7C2]">
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
                  Not an AI chatbot bolted on the side. MediCore's CDSS fires at the point of care, PostVisit AI closes the loop, and every alert reaches the right person in real time.
                </p>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {aiFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="card-hover rounded-[24px] border border-white/[0.08] bg-gradient-to-b from-[#0D1829] to-[#080E1A] p-6"
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
                      className="rounded-full border border-[#2B7FFF]/30 bg-[#2B7FFF]/10 px-4 py-1.5 text-xs font-bold text-[#7AB8FF]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── CLINICAL MODULES ── */}
          <section id="modules" className="mx-auto max-w-7xl px-4 py-10 sm:px-5 lg:px-8">
            <div className="mb-8 text-center">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#5A78A0]">Clinical coverage</div>
              <h2
                style={{ fontFamily: '"Fraunces", serif' }}
                className="text-4xl font-black text-white md:text-5xl"
              >
                50+ modules.{' '}
                <span className="gradient-text-teal">Zero gaps in care.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#7A9CC0]">
                From emergency triage to post-visit AI, from sickle cell disease to PACTR clinical trial matching — every clinical service line in Southern and Eastern Africa is covered.
              </p>
            </div>

            <div className="grid gap-3 grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-6">
              {modules.map((mod) => {
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
                      color: '#00C896',
                      title: 'Doctor-first review',
                      body: 'Every request is reviewed by someone who understands clinical workflows — not a sales bot.',
                    },
                    {
                      icon: Zap,
                      color: '#2B7FFF',
                      title: 'Provisioned tenant after approval',
                      body: 'A real test environment with your clinic\'s configuration. Not a generic demo.',
                    },
                    {
                      icon: Database,
                      color: '#FF7A40',
                      title: 'Test any module end-to-end',
                      body: 'CDSS, PostVisit AI, maternity, diabetes, sickle cell, epilepsy, traditional medicine herb-drug, PACTR trials, Ubuntu SDOH, NHIF/CBHI, lab, radiology, HIV, oncology, DHIS2, claims, and more.',
                    },
                    {
                      icon: ShieldCheck,
                      color: '#00C896',
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

                <div className="mt-8 rounded-[20px] border border-[#00C896]/20 bg-[#00C896]/[0.07] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#4DDBB0]">Who uses MediCore?</p>
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
                        className="rounded-full border border-[#00C896]/25 bg-[#00C896]/[0.08] px-3 py-1 text-[11px] font-semibold text-[#6EE7C2]"
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
                    { field: 'workEmail' as const, label: 'Work email', placeholder: 'doctor@clinic.medicore.health', required: true, type: 'email' },
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
                        className="w-full rounded-2xl border border-[#1E3A5F] bg-[#060E1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#3A5070] focus:border-[#00C896]/60 focus:ring-1 focus:ring-[#00C896]/20"
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
                    className="w-full rounded-2xl border border-[#1E3A5F] bg-[#060E1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#3A5070] focus:border-[#00C896]/60 focus:ring-1 focus:ring-[#00C896]/20"
                  />
                </label>

                <div className="mt-4">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A78A0]">
                    What do you want to evaluate?
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((option) => {
                      const active = selectedInterests.has(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleInterest(option)}
                          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-[#00C896]/50 bg-[#00C896]/12 text-[#7AEEC8]'
                              : 'border-[#1E3A5F] bg-[#060E1A] text-[#6A88AA] hover:border-[#2B7FFF]/40 hover:text-[#9AB8E8]'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                    className="w-full rounded-[20px] border border-[#1E3A5F] bg-[#060E1A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#3A5070] focus:border-[#00C896]/60 focus:ring-1 focus:ring-[#00C896]/20"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A78A0]">Preferred contact</span>
                  <select
                    value={form.preferredContactMethod}
                    onChange={(e) => updateField('preferredContactMethod', e.target.value as ContactMethod)}
                    className="w-full rounded-2xl border border-[#1E3A5F] bg-[#060E1A] px-4 py-3 text-sm text-white outline-none transition focus:border-[#00C896]/60"
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
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#00C896]/25 bg-[#00C896]/[0.08] px-4 py-3 text-sm text-[#7AEEC8]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {success}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="glow-teal inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00C896] to-[#00A87A] px-7 py-3.5 text-sm font-bold text-[#051119] transition hover:from-[#00D9A3] hover:to-[#00C896] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Request test access'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/tenants')}
                    className="inline-flex items-center gap-2 rounded-full border border-[#1E3A5F] bg-[#060E1A] px-6 py-3.5 text-sm font-bold text-[#C5D5EE] transition hover:border-[#2B7FFF]/50"
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
                  <div className="rounded-2xl border border-[#1A2E45] bg-white/90 p-1.5">
                    <img src={logoSrc} alt="MediCore" className="h-8 w-auto" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#4A6A8A]">MediCore</p>
                    <p className="text-sm font-bold text-white">Clinical Intelligence Platform</p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-6 text-[#5A7A9A]">
                  SADC-first clinical AI platform — multilingual voice scribe (40+ languages), real-time CDSS, PostVisit AI, FHIR R4 interoperability, DHIS2 national reporting, 50+ specialty workflows including sickle cell, epilepsy, traditional medicine herb-drug alerts, PACTR trial matching, Ubuntu SDOH, and NHIF/CBHI insurance. Serving clinics across Southern, Eastern, and Western Africa.
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
                  {['CDSS + AI guidance', 'PostVisit AI', 'FHIR R4 data model', 'DHIS2 integration', 'SNOMED CT charting', 'Real-time alerts', 'Telemedicine + video', 'Patient portal'].map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              {/* Clinical focus */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#4A6A8A]">Clinical Focus</p>
                <div className="mt-3 space-y-2 text-xs text-[#6A8AAA]">
                  {['Maternity + newborn', 'Diabetes + chronic care', 'Lab + radiology', 'HIV program workflow', 'Cancer + oncology', 'Emergency department', 'Sickle cell + haemoglobinopathy', 'Epilepsy + NCD register', 'Traditional medicine CDSS', 'Maternal mortality audit', 'Ubuntu SDOH wellbeing', 'NHIF / CBHI insurance', 'Claims + billing'].map((item) => (
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
                © {currentYear} MediCore EHR. SADC-first · Built for Africa · Used globally — serving clinicians, NGOs, and MOH programs across 16 SADC nations. 50+ clinical modules.
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
