import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Microscope,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { vhfApi } from '../services/api';

type TabKey = 'cases' | 'contacts' | 'mpox' | 'summary';

type Props = {
  tenantSlug: string;
  token: string;
};

const pathogenBadge: Record<string, string> = {
  mpox_clade_i: 'bg-orange-100 text-orange-800 border-orange-200',
  mpox_clade_ii: 'bg-amber-100 text-amber-800 border-amber-200',
  ebola: 'bg-red-100 text-red-800 border-red-200',
  marburg: 'bg-red-100 text-red-800 border-red-200',
  lassa: 'bg-purple-100 text-purple-800 border-purple-200',
  rvf: 'bg-blue-100 text-blue-800 border-blue-200',
  crimean_congo: 'bg-pink-100 text-pink-800 border-pink-200',
};

const statusBadge: Record<string, string> = {
  suspected: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  probable: 'bg-orange-100 text-orange-800 border-orange-200',
  confirmed: 'bg-red-100 text-red-800 border-red-200',
  discarded: 'bg-slate-100 text-slate-700 border-slate-200',
};

const emptySummary = {
  total: 0,
  suspected: 0,
  probable: 0,
  confirmed: 0,
  mpoxCases: 0,
  contactsUnderMonitoring: 0,
  whoNotificationsPending: 0,
};

const initialCaseForm = {
  patientId: '',
  pathogen: 'mpox_clade_i',
  pathogenClade: 'Ib',
  exposureDate: '',
  exposureType: 'human_contact',
  symptomOnsetDate: '',
  classification: 'suspected',
  caseDefinitionMet: '',
  isolationStatus: 'pending',
  specimenType: 'swab',
  labPcrResult: 'pending',
  travelHistoryJson: '',
  animalExposureJson: '',
  fever: true,
  rash: true,
  haemorrhage: false,
  vomiting: false,
  diarrhoea: false,
  myalgia: true,
  headache: true,
  pharyngitis: false,
  contactWithVhfCase: true,
  healthcareWorker: false,
  immunocompromised: false,
};

const initialContactForm = {
  contactName: '',
  contactPhone: '',
  contactAddress: '',
  contactType: 'household',
  relationship: '',
  firstExposureDate: '',
  lastExposureDate: '',
  exposureNature: 'direct_contact',
  assignedChwId: '',
};

const initialLesionDistribution = {
  face: false,
  trunk: false,
  arms: false,
  legs: false,
  palms: false,
  soles: false,
  genitalia: false,
  oral_mucosa: false,
  conjunctival: false,
  anal: false,
};

const initialMpoxForm = {
  patientId: '',
  vhfCaseId: '',
  stage: 'pustules',
  dayOfIllness: '7',
  lesionCountEstimate: '',
  lesionCountCategory: 'moderate_10-100',
  lesionDepth: 'umbilicated',
  lesionSynchrony: 'all_same_stage',
  complicationsNotes: '',
  immunocompromised: false,
  hivPositive: false,
  pregnant: false,
  clade: 'Ib',
  cornealInvolvement: false,
  respiratoryInvolvement: false,
  secondaryBacterialInfection: false,
  encephalitis: false,
  genitalLesions: false,
  proctitis: false,
  cnsInvolvement: false,
  cnsSymptomsCsv: '',
  supportiveCareCsv: 'wound_care,pain_management,hydration',
  lesionDistribution: initialLesionDistribution,
};

function parseJsonArray(input: string, label: string): any[] {
  if (!input.trim()) return [];
  const parsed = JSON.parse(input);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }
  return parsed;
}

export default function VhfSurveillanceDashboard({ tenantSlug, token }: Props) {
  const { showError, showSuccess } = useNotification();
  const [tab, setTab] = useState<TabKey>('cases');
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [lesionHistory, setLesionHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(emptySummary);
  const [triageResult, setTriageResult] = useState<any>(null);
  const [mpoxSeverity, setMpoxSeverity] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseForm, setCaseForm] = useState(initialCaseForm);
  const [contactForm, setContactForm] = useState(initialContactForm);
  const [mpoxForm, setMpoxForm] = useState(initialMpoxForm);
  const [contactStatusDrafts, setContactStatusDrafts] = useState<Record<string, string>>({});

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  const loadData = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [caseRows, summaryRow] = await Promise.all([
        vhfApi.getCases(token, tenantSlug),
        vhfApi.getSurveillanceSummary(token, tenantSlug),
      ]);
      setCases(Array.isArray(caseRows) ? caseRows : []);
      setSummary(summaryRow || emptySummary);
    } catch (error: any) {
      showError('VHF Surveillance', error?.response?.data?.message || 'Failed to load VHF surveillance data.');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, showError]);

  const loadContacts = useCallback(async (caseId: string) => {
    if (!caseId || !tenantSlug || !token) return;
    try {
      const rows = await vhfApi.getContacts(caseId, token, tenantSlug);
      setContacts(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      showError('Contact Tracing', error?.response?.data?.message || 'Failed to load contacts.');
    }
  }, [tenantSlug, token, showError]);

  const loadLesionHistory = useCallback(async (patientId: string) => {
    if (!patientId || !tenantSlug || !token) return;
    try {
      const rows = await vhfApi.getLesionHistory(patientId, token, tenantSlug);
      setLesionHistory(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      showError('Mpox Lesions', error?.response?.data?.message || 'Failed to load lesion history.');
    }
  }, [tenantSlug, token, showError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedCaseId) {
      void loadContacts(selectedCaseId);
    } else {
      setContacts([]);
    }
  }, [selectedCaseId, loadContacts]);

  const submitCase = async () => {
    try {
      const payload = {
        patientId: caseForm.patientId.trim(),
        pathogen: caseForm.pathogen,
        pathogenClade: caseForm.pathogen.startsWith('mpox') ? (caseForm.pathogenClade || null) : null,
        exposureDate: caseForm.exposureDate || null,
        exposureType: caseForm.exposureType || null,
        symptomOnsetDate: caseForm.symptomOnsetDate || null,
        classification: caseForm.classification || 'suspected',
        caseDefinitionMet: caseForm.caseDefinitionMet.trim() || null,
        isolationStatus: caseForm.isolationStatus || 'pending',
        specimenType: caseForm.specimenType || null,
        labPcrResult: caseForm.labPcrResult || null,
        travelHistory: parseJsonArray(caseForm.travelHistoryJson, 'Travel history'),
        animalExposure: parseJsonArray(caseForm.animalExposureJson, 'Animal exposure'),
        fever: caseForm.fever,
        rash: caseForm.rash,
        haemorrhage: caseForm.haemorrhage,
        vomiting: caseForm.vomiting,
        diarrhoea: caseForm.diarrhoea,
        myalgia: caseForm.myalgia,
        headache: caseForm.headache,
        pharyngitis: caseForm.pharyngitis,
        contactWithVhfCase: caseForm.contactWithVhfCase,
        healthcareWorker: caseForm.healthcareWorker,
        immunocompromised: caseForm.immunocompromised,
      };
      const response = await vhfApi.reportCase(payload, token, tenantSlug);
      setTriageResult(response?.cdssTriage || null);
      setShowCaseForm(false);
      setCaseForm(initialCaseForm);
      showSuccess('VHF Surveillance', 'Case reported successfully.');
      await loadData();
    } catch (error: any) {
      showError('VHF Surveillance', error?.message || error?.response?.data?.message || 'Failed to report case.');
    }
  };

  const rerunTriage = async (caseId: string) => {
    try {
      const result = await vhfApi.triageCase(caseId, {}, token, tenantSlug);
      setSelectedCaseId(caseId);
      setTriageResult(result);
      showSuccess('VHF Triage', 'Case triage refreshed.');
    } catch (error: any) {
      showError('VHF Triage', error?.response?.data?.message || 'Failed to re-run triage.');
    }
  };

  const submitContact = async () => {
    if (!selectedCaseId) {
      showError('Contact Tracing', 'Select a case before adding contacts.');
      return;
    }
    try {
      await vhfApi.addContact(
        selectedCaseId,
        {
          contactName: contactForm.contactName.trim(),
          contactPhone: contactForm.contactPhone.trim() || null,
          contactAddress: contactForm.contactAddress.trim() || null,
          contactType: contactForm.contactType,
          relationship: contactForm.relationship.trim() || null,
          firstExposureDate: contactForm.firstExposureDate,
          lastExposureDate: contactForm.lastExposureDate,
          exposureNature: contactForm.exposureNature || null,
          assignedChwId: contactForm.assignedChwId.trim() || null,
        },
        token,
        tenantSlug,
      );
      setContactForm(initialContactForm);
      showSuccess('Contact Tracing', 'Contact added for follow-up.');
      await Promise.all([loadContacts(selectedCaseId), loadData()]);
    } catch (error: any) {
      showError('Contact Tracing', error?.response?.data?.message || 'Failed to add contact.');
    }
  };

  const saveContactStatus = async (contactId: string, currentStatus: string) => {
    try {
      await vhfApi.updateContactStatus(
        contactId,
        { status: contactStatusDrafts[contactId] || currentStatus },
        token,
        tenantSlug,
      );
      showSuccess('Contact Tracing', 'Contact status updated.');
      if (selectedCaseId) {
        await Promise.all([loadContacts(selectedCaseId), loadData()]);
      }
    } catch (error: any) {
      showError('Contact Tracing', error?.response?.data?.message || 'Failed to update contact status.');
    }
  };

  const submitLesionAssessment = async () => {
    try {
      const payload = {
        patientId: mpoxForm.patientId.trim(),
        vhfCaseId: mpoxForm.vhfCaseId.trim() || null,
        stage: mpoxForm.stage,
        dayOfIllness: mpoxForm.dayOfIllness ? Number(mpoxForm.dayOfIllness) : null,
        lesionCountEstimate: mpoxForm.lesionCountEstimate ? Number(mpoxForm.lesionCountEstimate) : null,
        lesionCountCategory: mpoxForm.lesionCountCategory,
        lesionDistribution: mpoxForm.lesionDistribution,
        lesionDepth: mpoxForm.lesionDepth || null,
        lesionSynchrony: mpoxForm.lesionSynchrony || null,
        secondaryBacterialInfection: mpoxForm.secondaryBacterialInfection,
        cornealInvolvement: mpoxForm.cornealInvolvement,
        respiratoryInvolvement: mpoxForm.respiratoryInvolvement,
        encephalitis: mpoxForm.encephalitis,
        genitalLesions: mpoxForm.genitalLesions,
        proctitis: mpoxForm.proctitis,
        complicationsNotes: mpoxForm.complicationsNotes.trim() || null,
        cnsInvolvement: mpoxForm.cnsInvolvement,
        cnsSymptoms: mpoxForm.cnsSymptomsCsv
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        supportiveCare: mpoxForm.supportiveCareCsv
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        immunocompromised: mpoxForm.immunocompromised,
        hivPositive: mpoxForm.hivPositive,
        pregnant: mpoxForm.pregnant,
        clade: mpoxForm.clade || null,
      };
      const response = await vhfApi.recordLesionAssessment(payload, token, tenantSlug);
      setMpoxSeverity(response?.cdssSeverity || null);
      showSuccess('Mpox Lesions', 'Lesion assessment recorded.');
      await loadLesionHistory(mpoxForm.patientId.trim());
      await loadData();
    } catch (error: any) {
      showError('Mpox Lesions', error?.response?.data?.message || 'Failed to save lesion assessment.');
    }
  };

  const notificationCases = useMemo(
    () => cases.filter((item) => ['probable', 'confirmed'].includes(item.classification) && !item.notifiedWho),
    [cases],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            VHF / Mpox Surveillance
          </h2>
          <p className="text-sm text-slate-500">Case reporting, contact tracing, mpox lesion scoring, and notification workflow.</p>
        </div>
        {loading && <span className="text-sm text-slate-500">Refreshing...</span>}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total cases</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{summary.total ?? 0}</div>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="text-xs uppercase tracking-wide text-yellow-700">Suspected / probable</div>
          <div className="mt-1 text-2xl font-bold text-yellow-900">{(summary.suspected ?? 0) + (summary.probable ?? 0)}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-xs uppercase tracking-wide text-red-700">Confirmed</div>
          <div className="mt-1 text-2xl font-bold text-red-900">{summary.confirmed ?? 0}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs uppercase tracking-wide text-blue-700">Contacts monitored</div>
          <div className="mt-1 text-2xl font-bold text-blue-900">{summary.contactsUnderMonitoring ?? 0}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'cases', label: 'VHF Cases', icon: AlertTriangle },
          { key: 'contacts', label: 'Contact Tracing', icon: Users },
          { key: 'mpox', label: 'Mpox Lesions', icon: Activity },
          { key: 'summary', label: 'Surveillance', icon: Shield },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as TabKey)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'cases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">VHF Case Register</h3>
            <button
              type="button"
              onClick={() => setShowCaseForm((prev) => !prev)}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              {showCaseForm ? 'Hide Form' : 'Report New Case'}
            </button>
          </div>

          {showCaseForm && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <input value={caseForm.patientId} onChange={(e) => setCaseForm((c) => ({ ...c, patientId: e.target.value }))} placeholder="Patient UUID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select value={caseForm.pathogen} onChange={(e) => setCaseForm((c) => ({ ...c, pathogen: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="mpox_clade_i">Mpox Clade I</option>
                  <option value="mpox_clade_ii">Mpox Clade II</option>
                  <option value="ebola">Ebola</option>
                  <option value="marburg">Marburg</option>
                  <option value="lassa">Lassa</option>
                  <option value="rvf">Rift Valley Fever</option>
                  <option value="crimean_congo">Crimean Congo</option>
                </select>
                <input value={caseForm.pathogenClade} onChange={(e) => setCaseForm((c) => ({ ...c, pathogenClade: e.target.value }))} placeholder="Clade (e.g. Ib)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="date" value={caseForm.exposureDate} onChange={(e) => setCaseForm((c) => ({ ...c, exposureDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select value={caseForm.exposureType} onChange={(e) => setCaseForm((c) => ({ ...c, exposureType: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="human_contact">Human contact</option>
                  <option value="animal_contact">Animal contact</option>
                  <option value="healthcare_worker">Healthcare worker</option>
                  <option value="unknown">Unknown</option>
                </select>
                <input type="date" value={caseForm.symptomOnsetDate} onChange={(e) => setCaseForm((c) => ({ ...c, symptomOnsetDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select value={caseForm.classification} onChange={(e) => setCaseForm((c) => ({ ...c, classification: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="suspected">Suspected</option>
                  <option value="probable">Probable</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="discarded">Discarded</option>
                </select>
                <select value={caseForm.isolationStatus} onChange={(e) => setCaseForm((c) => ({ ...c, isolationStatus: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="pending">Pending isolation</option>
                  <option value="isolated">Isolated</option>
                  <option value="home_isolation">Home isolation</option>
                  <option value="discharged">Discharged</option>
                </select>
                <select value={caseForm.labPcrResult} onChange={(e) => setCaseForm((c) => ({ ...c, labPcrResult: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="pending">PCR pending</option>
                  <option value="positive">PCR positive</option>
                  <option value="negative">PCR negative</option>
                  <option value="indeterminate">PCR indeterminate</option>
                </select>
              </div>
              <textarea value={caseForm.caseDefinitionMet} onChange={(e) => setCaseForm((c) => ({ ...c, caseDefinitionMet: e.target.value }))} placeholder="WHO case definition met / notes" className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="grid gap-3 md:grid-cols-2">
                <textarea value={caseForm.travelHistoryJson} onChange={(e) => setCaseForm((c) => ({ ...c, travelHistoryJson: e.target.value }))} placeholder='Travel history JSON array, e.g. [{"country":"DRC","city":"Goma"}]' className="min-h-[90px] rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <textarea value={caseForm.animalExposureJson} onChange={(e) => setCaseForm((c) => ({ ...c, animalExposureJson: e.target.value }))} placeholder='Animal exposure JSON array, e.g. [{"species":"rodent","type":"handling"}]' className="min-h-[90px] rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  ['fever', 'Fever'],
                  ['rash', 'Rash'],
                  ['haemorrhage', 'Haemorrhage'],
                  ['vomiting', 'Vomiting'],
                  ['diarrhoea', 'Diarrhoea'],
                  ['myalgia', 'Myalgia'],
                  ['headache', 'Headache'],
                  ['pharyngitis', 'Pharyngitis'],
                  ['contactWithVhfCase', 'Known VHF contact'],
                  ['healthcareWorker', 'Healthcare worker'],
                  ['immunocompromised', 'Immunocompromised'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(caseForm as any)[key]}
                      onChange={(e) => setCaseForm((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button type="button" onClick={submitCase} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Save Case and Run CDSS Triage
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Pathogen</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Isolation</th>
                  <th className="px-4 py-3">WHO</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {cases.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700">{item.dateReported}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pathogenBadge[item.pathogen] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {String(item.pathogen || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge[item.classification] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {item.classification}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">{String(item.isolationStatus || '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{item.notifiedWho ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setSelectedCaseId(item.id); setTab('contacts'); }} className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                          Contacts
                        </button>
                        <button type="button" onClick={() => void rerunTriage(item.id)} className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                          Re-run triage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No VHF cases recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {triageResult && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-900">
                <Stethoscope className="h-4 w-4" />
                <h4 className="font-semibold">Latest CDSS Triage</h4>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                <div><span className="font-medium text-slate-700">Classification:</span> {triageResult.classification}</div>
                <div><span className="font-medium text-slate-700">Risk level:</span> {triageResult.risk_level}</div>
                <div><span className="font-medium text-slate-700">PPE:</span> {triageResult.ppe_level}</div>
              </div>
              <div className="mt-3 text-sm text-slate-700">{triageResult.treatment_guidance}</div>
              {Array.isArray(triageResult.immediate_actions) && triageResult.immediate_actions.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {triageResult.immediate_actions.map((action: string, index: number) => (
                    <li key={`triage-action-${index}`}>- {action}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Contact Tracing</h3>
            {selectedCase && (
              <div className="text-sm text-slate-500">
                Selected case: <span className="font-medium text-slate-700">{selectedCase.pathogen}</span>
              </div>
            )}
          </div>
          {!selectedCase && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Select a case from the VHF Cases tab to manage contacts.
            </div>
          )}
          {selectedCase && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <input value={contactForm.contactName} onChange={(e) => setContactForm((c) => ({ ...c, contactName: e.target.value }))} placeholder="Contact name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={contactForm.contactPhone} onChange={(e) => setContactForm((c) => ({ ...c, contactPhone: e.target.value }))} placeholder="Phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={contactForm.contactAddress} onChange={(e) => setContactForm((c) => ({ ...c, contactAddress: e.target.value }))} placeholder="Address" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={contactForm.contactType} onChange={(e) => setContactForm((c) => ({ ...c, contactType: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="household">Household</option>
                    <option value="healthcare_worker">Healthcare worker</option>
                    <option value="community">Community</option>
                    <option value="sexual">Sexual contact</option>
                  </select>
                  <input value={contactForm.relationship} onChange={(e) => setContactForm((c) => ({ ...c, relationship: e.target.value }))} placeholder="Relationship" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={contactForm.exposureNature} onChange={(e) => setContactForm((c) => ({ ...c, exposureNature: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="direct_contact">Direct contact</option>
                    <option value="bodily_fluids">Bodily fluids</option>
                    <option value="same_room_no_ppe">Same room without PPE</option>
                    <option value="ppe_protected">PPE protected</option>
                  </select>
                  <input type="date" value={contactForm.firstExposureDate} onChange={(e) => setContactForm((c) => ({ ...c, firstExposureDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input type="date" value={contactForm.lastExposureDate} onChange={(e) => setContactForm((c) => ({ ...c, lastExposureDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={contactForm.assignedChwId} onChange={(e) => setContactForm((c) => ({ ...c, assignedChwId: e.target.value }))} placeholder="Assigned CHW UUID (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <button type="button" onClick={submitContact} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Add Contact
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Last exposure</th>
                      <th className="px-4 py-3">Monitoring end</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {contacts.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-700">{item.contactName}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{String(item.contactType || '').replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-slate-700">{item.lastExposureDate}</td>
                        <td className="px-4 py-3 text-slate-700">{item.monitoringEndDate}</td>
                        <td className="px-4 py-3">
                          <select
                            value={contactStatusDrafts[item.id] ?? item.status}
                            onChange={(e) => setContactStatusDrafts((c) => ({ ...c, [item.id]: e.target.value }))}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="under_monitoring">Under monitoring</option>
                            <option value="cleared">Cleared</option>
                            <option value="became_case">Became case</option>
                            <option value="lost_to_followup">Lost to follow-up</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => void saveContactStatus(item.id, item.status)} className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {contacts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No contacts listed for this case yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'mpox' && (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Mpox Lesion Assessment</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={mpoxForm.patientId} onChange={(e) => setMpoxForm((c) => ({ ...c, patientId: e.target.value }))} placeholder="Patient UUID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={mpoxForm.vhfCaseId} onChange={(e) => setMpoxForm((c) => ({ ...c, vhfCaseId: e.target.value }))} placeholder="Linked VHF case UUID (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={mpoxForm.stage} onChange={(e) => setMpoxForm((c) => ({ ...c, stage: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="prodrome">Prodrome</option>
                <option value="macules">Macules</option>
                <option value="papules">Papules</option>
                <option value="vesicles">Vesicles</option>
                <option value="pustules">Pustules</option>
                <option value="crusting">Crusting</option>
                <option value="resolving">Resolving</option>
              </select>
              <input value={mpoxForm.dayOfIllness} onChange={(e) => setMpoxForm((c) => ({ ...c, dayOfIllness: e.target.value }))} placeholder="Day of illness" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={mpoxForm.lesionCountEstimate} onChange={(e) => setMpoxForm((c) => ({ ...c, lesionCountEstimate: e.target.value }))} placeholder="Lesion count estimate" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={mpoxForm.lesionCountCategory} onChange={(e) => setMpoxForm((c) => ({ ...c, lesionCountCategory: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="few_<10">Few &lt;10</option>
                <option value="moderate_10-100">Moderate 10-100</option>
                <option value="many_>100">Many &gt;100</option>
              </select>
              <select value={mpoxForm.clade} onChange={(e) => setMpoxForm((c) => ({ ...c, clade: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="Ia">Ia</option>
                <option value="Ib">Ib</option>
                <option value="IIa">IIa</option>
                <option value="IIb">IIb</option>
              </select>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Lesion distribution</div>
              <div className="grid gap-2 md:grid-cols-5">
                {Object.entries(mpoxForm.lesionDistribution).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setMpoxForm((c) => ({
                        ...c,
                        lesionDistribution: { ...c.lesionDistribution, [key]: e.target.checked },
                      }))}
                    />
                    {key.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              {[
                ['cornealInvolvement', 'Corneal involvement'],
                ['respiratoryInvolvement', 'Respiratory involvement'],
                ['secondaryBacterialInfection', 'Secondary infection'],
                ['encephalitis', 'Encephalitis'],
                ['genitalLesions', 'Genital lesions'],
                ['proctitis', 'Proctitis'],
                ['cnsInvolvement', 'CNS involvement'],
                ['immunocompromised', 'Immunocompromised'],
                ['hivPositive', 'HIV positive'],
                ['pregnant', 'Pregnant'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={(mpoxForm as any)[key]}
                    onChange={(e) => setMpoxForm((c) => ({ ...c, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <textarea value={mpoxForm.cnsSymptomsCsv} onChange={(e) => setMpoxForm((c) => ({ ...c, cnsSymptomsCsv: e.target.value }))} placeholder="CNS symptoms CSV, e.g. confusion,seizure" className="min-h-[70px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={mpoxForm.supportiveCareCsv} onChange={(e) => setMpoxForm((c) => ({ ...c, supportiveCareCsv: e.target.value }))} placeholder="Supportive care CSV, e.g. wound_care,pain_management,hydration" className="min-h-[70px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={mpoxForm.complicationsNotes} onChange={(e) => setMpoxForm((c) => ({ ...c, complicationsNotes: e.target.value }))} placeholder="Complication notes" className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={submitLesionAssessment} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
                Save Assessment
              </button>
              <button type="button" onClick={() => void loadLesionHistory(mpoxForm.patientId.trim())} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                Load History
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-orange-900">
                <Microscope className="h-4 w-4" />
                <h4 className="font-semibold">Mpox Severity Result</h4>
              </div>
              {!mpoxSeverity ? (
                <p className="mt-3 text-sm text-orange-900">Save an assessment to compute WHO-guided severity and antiviral indication.</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div><span className="font-medium">Severity:</span> {mpoxSeverity.severity_category} ({mpoxSeverity.severity_score}/10)</div>
                  <div><span className="font-medium">Antiviral:</span> {mpoxSeverity.antiviral_indicated ? `${mpoxSeverity.antiviral_drug} - ${mpoxSeverity.antiviral_dose}` : 'Not indicated'}</div>
                  <div><span className="font-medium">Hospitalisation:</span> {mpoxSeverity.hospitalisation_required ? 'Required' : 'Not required'}</div>
                  {Array.isArray(mpoxSeverity.care_principles) && (
                    <ul className="space-y-1">
                      {mpoxSeverity.care_principles.map((item: string, index: number) => (
                        <li key={`care-${index}`}>- {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="font-semibold text-slate-900">Lesion History</h4>
              <div className="mt-3 space-y-3">
                {lesionHistory.length === 0 && (
                  <p className="text-sm text-slate-500">No lesion history loaded for this patient.</p>
                )}
                {lesionHistory.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-900">{item.assessmentDate} - {item.stage}</div>
                      <div className="text-slate-500">{item.lesionCountCategory || 'count not categorised'}</div>
                    </div>
                    <div className="mt-1 text-slate-600">
                      Severity: {item.cdssSeverityScore ?? 'n/a'} | Antiviral: {item.antiviralDrug || 'none'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'summary' && (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Notification Queue</h3>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              WHO / IHR attention items pending: <span className="font-semibold">{summary.whoNotificationsPending ?? 0}</span>
            </div>
            {notificationCases.length === 0 && (
              <p className="text-sm text-slate-500">No probable or confirmed cases awaiting WHO notification.</p>
            )}
            {notificationCases.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="font-medium text-slate-900">{String(item.pathogen || '').replace(/_/g, ' ')}</div>
                <div className="mt-1 text-slate-600">Reported {item.dateReported} • Classification {item.classification}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900">Operational Notes</h3>
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                Any probable or confirmed VHF event should trigger immediate IPC escalation, specimen workflow, and district or national reporting review.
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                Active mpox cases: <span className="font-semibold">{summary.mpoxCases ?? 0}</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                Contacts under monitoring: <span className="font-semibold">{summary.contactsUnderMonitoring ?? 0}</span>. Standard follow-up period is 21 days from last exposure.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
