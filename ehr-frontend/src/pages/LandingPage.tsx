import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Brain,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  FlaskConical,
  HeartPulse,
  MessageSquare,
  Network,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Wallet,
  Workflow,
} from 'lucide-react';
import { tenantApi } from '../services/api';

type ContactMethod = 'email' | 'phone' | 'whatsapp';

const interestOptions = [
  'PostVisit AI',
  'CDSS and AI decision support',
  'FHIR interoperability',
  'SNOMED and structured coding',
  'DHIS2 reporting',
  'HIV program workflows',
  'Cancer and specialty modules',
  'Patient portal and mobile app',
];

const featureHighlights = [
  {
    title: 'PostVisit AI that closes the loop',
    description: 'Turn visits into signed, patient-safe follow-through with grounded summaries, escalations, teach-back, and follow-up execution.',
    icon: Sparkles,
  },
  {
    title: 'Clinical intelligence without generic AI fluff',
    description: 'CDSS, dosing safeguards, terminology-aware documentation, risk cues, and protocol-driven execution for real bedside work.',
    icon: Brain,
  },
  {
    title: 'Interoperability built into care',
    description: 'FHIR, SNOMED CT, ICD-10, RxNorm, and DHIS2 support make the record usable for referrals, reporting, public-health programs, and cleaner downstream data.',
    icon: Network,
  },
  {
    title: 'Depth where clinics actually compete',
    description: 'HIV, oncology, cardiology, diabetes, ED, pharmacy, claims, medical-aid readiness, telemedicine, and doctor-nurse coordination.',
    icon: Workflow,
  },
];

const proofPoints = [
  {
    title: 'HIV, chronic care, and specialty depth',
    body: 'MediCore is not a thin notes app. It already carries HIV workflows, oncology, cardiology, diabetes, maternity, emergency, lab, imaging, pharmacy, and revenue-cycle surfaces.',
    icon: HeartPulse,
  },
  {
    title: 'FHIR + SNOMED + HIPAA-aware operations',
    body: 'Structured terminology, interoperability, and auditability make the platform more useful for quality improvement, cleaner data exchange, and safer longitudinal care.',
    icon: ShieldCheck,
  },
  {
    title: 'DHIS2 that supports program reporting and research readiness',
    body: 'DHIS2 alignment helps clinics and programs push cleaner operational and public-health data, improve cohort visibility, and strengthen reporting for grants, registries, and research workflows.',
    icon: FileText,
  },
];

const moduleChips = [
  { label: 'HIV Program Workflow', icon: Activity },
  { label: 'Cancer and Oncology', icon: FlaskConical },
  { label: 'CDSS + AI', icon: Brain },
  { label: 'Claims + Medical Aid', icon: Wallet },
  { label: 'Telemedicine + Messaging', icon: MessageSquare },
  { label: 'Patient App + Mobile', icon: Smartphone },
];

export default function LandingPage() {
  const navigate = useNavigate();
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
    'HIV program workflows',
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedInterests = useMemo(() => new Set(interestAreas), [interestAreas]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleInterest = (option: string) => {
    setInterestAreas((current) => {
      if (current.includes(option)) {
        return current.filter((item) => item !== option);
      }
      return [...current, option];
    });
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
      await tenantApi.submitDemoAccessRequest({
        ...form,
        interestAreas,
      });
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
      setInterestAreas(['PostVisit AI', 'CDSS and AI decision support', 'HIV program workflows']);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to submit your request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#080E1A] text-[#E8F0FF]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-[-10rem] mx-auto h-[32rem] w-[32rem] rounded-full bg-[#00C896]/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-[20rem] h-[24rem] w-[24rem] rounded-full bg-[#2B7FFF]/18 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-[#FF7A40]/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080E1A]/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
            <button className="flex items-center gap-3" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#253A58] bg-[#0E1829] shadow-[0_0_40px_rgba(0,200,150,0.12)]">
                <Stethoscope className="h-5 w-5 text-[#00C896]" />
              </div>
              <div className="text-left">
                <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">MediCore</div>
                <div style={{ fontFamily: '"Fraunces", serif' }} className="text-xl font-semibold text-white">
                  Clinical Intelligence Platform
                </div>
              </div>
            </button>

            <div className="hidden items-center gap-8 text-sm text-[#9AB1D6] lg:flex">
              <a href="#why" className="transition hover:text-white">Why MediCore</a>
              <a href="#platform" className="transition hover:text-white">Platform</a>
              <a href="#request-access" className="transition hover:text-white">Request Access</a>
              <button
                onClick={() => navigate('/tenants')}
                className="rounded-full border border-[#253A58] bg-white/5 px-4 py-2 font-medium text-white transition hover:border-[#00C896]/60 hover:bg-white/10"
              >
                Existing Tenant Login
              </button>
            </div>
          </div>
        </header>

        <main>
          <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:pt-24">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00C896]/30 bg-[#00C896]/12 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#7DE8CA]">
                <Sparkles className="h-4 w-4" />
                Better than a traditional EHR because it actually helps the care team work
              </div>

              <h1 style={{ fontFamily: '"Fraunces", serif' }} className="max-w-4xl text-5xl leading-[0.95] text-white md:text-6xl xl:text-7xl">
                Clinical software that feels built for the bedside,
                <span className="text-[#7DE8CA]"> not for surviving forms.</span>
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#AFC1DF]">
                MediCore combines doctor-nurse coordination, PostVisit AI, CDSS, FHIR interoperability, SNOMED-structured data, DHIS2 reporting, and specialty workflows like HIV and oncology in one platform designed for real clinical execution.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 rounded-full bg-[#00C896] px-6 py-3 text-sm font-semibold text-[#051119] shadow-[0_20px_80px_rgba(0,200,150,0.22)] transition hover:bg-[#24D9A8]"
                >
                  Request Guided Test Access
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/tenants')}
                  className="inline-flex items-center gap-2 rounded-full border border-[#253A58] bg-[#0E1829]/80 px-6 py-3 text-sm font-semibold text-white transition hover:border-[#2B7FFF] hover:bg-[#13233A]"
                >
                  Clinic Login Directory
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {['PostVisit AI', 'CDSS', 'FHIR R4', 'SNOMED CT', 'DHIS2', 'HIPAA-aware'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#A8BEDD]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {proofPoints.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(4,12,25,0.2)] backdrop-blur-xl">
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#0E1829] text-[#00C896]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-base font-semibold text-white">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[#97ADCF]">{item.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[32px] border border-[#253A58] bg-[linear-gradient(180deg,rgba(14,24,41,0.96),rgba(8,14,26,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#7A92B8]">Why doctors switch</div>
                  <div style={{ fontFamily: '"Fraunces", serif' }} className="mt-2 text-3xl text-white">
                    Faster documentation. Stronger follow-through.
                  </div>
                </div>
                <div className="rounded-2xl border border-[#253A58] bg-[#102139] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#7DE8CA]">
                  Live platform
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  'PostVisit AI summaries, signoff, patient-safe publishing, and grounded follow-up',
                  'Doctor-nurse coordination around triage, abnormal vitals, critical results, and shared action loops',
                  'FHIR, SNOMED CT, ICD-10, RxNorm, HIPAA-aware auditability, and cleaner downstream data',
                  'DHIS2 integration for stronger program reporting, cohort visibility, and research-ready data operations',
                ].map((point) => (
                  <div key={point} className="flex gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00C896]" />
                    <p className="text-sm leading-6 text-[#C6D4EC]">{point}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {moduleChips.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <div key={chip.label} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#0D172A] px-4 py-3 text-sm text-[#DAE5F8]">
                      <Icon className="h-4 w-4 text-[#2B7FFF]" />
                      <span>{chip.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="why" className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Why MediCore</div>
                <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-3 text-4xl text-white">
                  A concise pitch, with the things clinicians actually ask about.
                </h2>
              </div>
              <div className="hidden rounded-full border border-[#253A58] bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#9AB1D6] lg:block">
                Built for private clinics, programs, and specialty growth
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {featureHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#00C896]/35"
                  >
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#102139] text-[#7DE8CA]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#9FB3D3]">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="platform" className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[30px] border border-[#253A58] bg-[#0E1829]/90 p-7">
                <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Built to impress in minutes</div>
                <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-3 text-4xl text-white">
                  The short version of the platform.
                </h2>
                <div className="mt-6 space-y-4 text-sm leading-7 text-[#B7C8E4]">
                  <p>
                    <span className="font-semibold text-white">Clinical depth:</span> HIV workflows, specialty dashboards, pharmacy, imaging, telemedicine, billing, claims, and operational coordination.
                  </p>
                  <p>
                    <span className="font-semibold text-white">Interoperability:</span> FHIR-ready records, SNOMED CT terminology support, ICD-10 coding, and DHIS2 alignment for reporting and data continuity.
                  </p>
                  <p>
                    <span className="font-semibold text-white">Patient engagement:</span> patient portal, medication reminders, post-visit AI follow-through, messaging, and the mobile app direction already defined.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: 'AI workflow',
                    copy: 'PostVisit AI, CDSS, dictation, guidance, and patient-safe follow-up.',
                    icon: Sparkles,
                  },
                  {
                    title: 'Care operations',
                    copy: 'Doctor-nurse handoffs, alerts, queues, tasks, and critical-result execution.',
                    icon: Activity,
                  },
                  {
                    title: 'Financial engine',
                    copy: 'Claims readiness, medical-aid workflows, billing, and collection visibility.',
                    icon: Wallet,
                  },
                  {
                    title: 'Terminology',
                    copy: 'SNOMED CT, ICD-10, RxNorm, and better structured clinical data.',
                    icon: Building2,
                  },
                  {
                    title: 'Interoperability',
                    copy: 'FHIR exports and integration-ready records for external ecosystems.',
                    icon: Network,
                  },
                  {
                    title: 'Mobile-ready',
                    copy: 'Provider and patient mobile workflows are already planned from the real backend surface.',
                    icon: Smartphone,
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.title} className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#11233A] text-[#2B7FFF]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold text-white">{card.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#9DB1D0]">{card.copy}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="request-access" className="mx-auto max-w-7xl px-5 pb-20 pt-10 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[30px] border border-[#253A58] bg-[#0E1829]/90 p-7">
                <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Request test access</div>
                <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-3 text-4xl text-white">
                  Request a guided clinic test environment.
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#AFC1DF]">
                  This is not a throwaway sandbox. Tell us your specialty, your clinic, and what you want to validate. We will review the request and use it to prepare the right testing tenant.
                </p>

                <div className="mt-8 space-y-3 text-sm text-[#D9E5F7]">
                  {[
                    'Doctor-first review of requests',
                    'Provisioned testing tenant after approval',
                    'Useful for HIV, oncology, chronic care, claims, interoperability, and AI workflow evaluation',
                  ].map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00C896]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <form
                onSubmit={submitRequest}
                className="rounded-[32px] border border-[#253A58] bg-[linear-gradient(180deg,rgba(14,24,41,0.98),rgba(8,14,26,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Full name</span>
                    <input
                      required
                      value={form.fullName}
                      onChange={(event) => updateField('fullName', event.target.value)}
                      className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                      placeholder="Dr. Tariro Moyo"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Clinic or hospital</span>
                    <input
                      required
                      value={form.clinicName}
                      onChange={(event) => updateField('clinicName', event.target.value)}
                      className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                      placeholder="Borrowdale Specialist Centre"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Work email</span>
                    <input
                      required
                      type="email"
                      value={form.workEmail}
                      onChange={(event) => updateField('workEmail', event.target.value)}
                      className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                      placeholder="doctor@clinic.co.zw"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Phone</span>
                    <input
                      required
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                      placeholder="+263 77 123 4567"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Role</span>
                    <input
                      value={form.roleTitle}
                      onChange={(event) => updateField('roleTitle', event.target.value)}
                      className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                      placeholder="Consultant physician"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Specialty</span>
                    <input
                      value={form.specialization}
                      onChange={(event) => updateField('specialization', event.target.value)}
                      className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                      placeholder="HIV, internal medicine, oncology"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Current system</span>
                  <input
                    value={form.currentSystem}
                    onChange={(event) => updateField('currentSystem', event.target.value)}
                    className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                    placeholder="Current EHR or current workflow pain point"
                  />
                </label>

                <div className="mt-4">
                  <span className="mb-3 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">What do you want to evaluate?</span>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((option) => {
                      const active = selectedInterests.has(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleInterest(option)}
                          className={`rounded-full border px-4 py-2 text-sm transition ${
                            active
                              ? 'border-[#00C896] bg-[#00C896]/14 text-[#D9FFF2]'
                              : 'border-[#253A58] bg-[#091320] text-[#9CB1D2] hover:border-[#2B7FFF]'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Short request summary</span>
                  <textarea
                    required
                    rows={5}
                    value={form.interestSummary}
                    onChange={(event) => updateField('interestSummary', event.target.value)}
                    className="w-full rounded-[24px] border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#00C896]"
                    placeholder="Tell us what you want to test: HIV program management, doctor-nurse coordination, patient follow-up, interoperability, oncology workflows, DHIS2 reporting, claims, or AI support."
                  />
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-[#7A92B8]">Preferred contact</span>
                  <select
                    value={form.preferredContactMethod}
                    onChange={(event) => updateField('preferredContactMethod', event.target.value as ContactMethod)}
                    className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition focus:border-[#00C896]"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone call</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>

                {error && (
                  <div className="mt-4 rounded-2xl border border-[#FF4D6A]/30 bg-[#FF4D6A]/10 px-4 py-3 text-sm text-[#FFD2DA]">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mt-4 rounded-2xl border border-[#00C896]/30 bg-[#00C896]/12 px-4 py-3 text-sm text-[#C9FFF1]">
                    {success}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-[#00C896] px-6 py-3 text-sm font-semibold text-[#051119] shadow-[0_20px_80px_rgba(0,200,150,0.22)] transition hover:bg-[#24D9A8] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? 'Submitting request...' : 'Request test access'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/tenants')}
                    className="inline-flex items-center gap-2 rounded-full border border-[#253A58] bg-[#091320] px-5 py-3 text-sm font-semibold text-white transition hover:border-[#2B7FFF]"
                  >
                    Existing tenant login
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
