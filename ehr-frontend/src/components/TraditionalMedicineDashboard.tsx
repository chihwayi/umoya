import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FlaskConical, Leaf, RefreshCcw, ShieldAlert } from 'lucide-react';
import { traditionalMedicineApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'remedies' | 'alerts' | 'toxicity';

const severityBadgeStyles: Record<string, string> = {
  contraindicated: 'bg-red-100 text-red-800 border-red-200',
  major: 'bg-red-100 text-red-800 border-red-200',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200',
  minor: 'bg-blue-100 text-blue-800 border-blue-200',
  informational: 'bg-slate-100 text-slate-700 border-slate-200',
};

const bannerStyles: Record<string, string> = {
  danger: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  none: 'border-green-200 bg-green-50 text-green-900',
};

const emptyInteractionCheck = { alert_level: 'none', interactions_found: 0, interactions: [] as any[] };

export default function TraditionalMedicineDashboard({ patientId }: { patientId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || '';
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('remedies');
  const [remedies, setRemedies] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [toxicityEvents, setToxicityEvents] = useState<any[]>([]);
  const [interactionCheck, setInteractionCheck] = useState<any>(emptyInteractionCheck);

  const [remedyForm, setRemedyForm] = useState({
    remedyName: '',
    scientificName: '',
    preparation: 'decoction',
    route: 'oral',
    doseDescription: '',
    frequency: 'daily',
    durationDays: '',
    indication: '',
    source: 'self',
    icd11Tm2Code: '',
    snomedConceptId: '',
    isDisclosed: true,
    notes: '',
  });
  const [toxicityForm, setToxicityForm] = useState({
    tmRemedyId: '',
    organSystem: 'hepatic',
    presentation: '',
    labMarkersJson: '',
    causalityAssessment: 'possible',
    outcome: 'ongoing',
    notes: '',
  });
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});

  const remedyMap = useMemo(
    () => Object.fromEntries(remedies.map((item) => [item.id, item])),
    [remedies],
  );

  const ongoingHerbs = useMemo(
    () => remedies.filter((item) => item.isOngoing).map((item) => item.remedyName).filter(Boolean),
    [remedies],
  );

  const loadData = async () => {
    if (!tenantSlug || !token) return;
    try {
      const [remedyRows, alertRows, toxicityRows] = await Promise.all([
        traditionalMedicineApi.getRemedies(patientId, token, tenantSlug),
        traditionalMedicineApi.getAlerts(patientId, token, tenantSlug),
        traditionalMedicineApi.getToxicityEvents(patientId, token, tenantSlug),
      ]);
      setRemedies(Array.isArray(remedyRows) ? remedyRows : []);
      setAlerts(Array.isArray(alertRows) ? alertRows : []);
      setToxicityEvents(Array.isArray(toxicityRows) ? toxicityRows : []);
    } catch (error: any) {
      showError('Traditional Medicine', error?.response?.data?.message || 'Failed to load traditional medicine records.');
    }
  };

  useEffect(() => {
    void loadData();
  }, [patientId, tenantSlug]);

  const submitRemedy = async () => {
    if (!tenantSlug || !token || !remedyForm.remedyName.trim()) {
      showError('Traditional Medicine', 'Remedy name is required.');
      return;
    }

    try {
      const response = await traditionalMedicineApi.recordRemedy(
        patientId,
        {
          remedyName: remedyForm.remedyName.trim(),
          scientificName: remedyForm.scientificName.trim() || null,
          preparation: remedyForm.preparation || null,
          route: remedyForm.route,
          doseDescription: remedyForm.doseDescription.trim() || null,
          frequency: remedyForm.frequency || null,
          durationDays: remedyForm.durationDays ? Number(remedyForm.durationDays) : null,
          indication: remedyForm.indication.trim() || null,
          source: remedyForm.source || null,
          icd11Tm2Code: remedyForm.icd11Tm2Code.trim() || null,
          snomedConceptId: remedyForm.snomedConceptId.trim() || null,
          isDisclosed: remedyForm.isDisclosed,
          notes: remedyForm.notes.trim() || null,
        },
        token,
        tenantSlug,
      );
      setInteractionCheck(response?.interactionCheck || emptyInteractionCheck);
      setRemedyForm({
        remedyName: '',
        scientificName: '',
        preparation: 'decoction',
        route: 'oral',
        doseDescription: '',
        frequency: 'daily',
        durationDays: '',
        indication: '',
        source: 'self',
        icd11Tm2Code: '',
        snomedConceptId: '',
        isDisclosed: true,
        notes: '',
      });
      showSuccess('Traditional Medicine', 'Remedy recorded and interaction screening completed.');
      await loadData();
    } catch (error: any) {
      showError('Traditional Medicine', error?.response?.data?.message || 'Failed to record remedy.');
    }
  };

  const manualRecheck = async () => {
    if (!tenantSlug || !token || ongoingHerbs.length === 0) {
      showError('Interaction Check', 'No ongoing remedies available for re-check.');
      return;
    }

    try {
      const response = await traditionalMedicineApi.checkInteractions(
        patientId,
        { herbs: ongoingHerbs },
        token,
        tenantSlug,
      );
      setInteractionCheck(response || emptyInteractionCheck);
      await loadData();
      showSuccess('Interaction Check', 'Herb-drug interaction check completed.');
    } catch (error: any) {
      showError('Interaction Check', error?.response?.data?.message || 'Failed to run interaction check.');
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    if (!tenantSlug || !token) return;
    try {
      await traditionalMedicineApi.acknowledgeAlert(
        alertId,
        { overrideReason: overrideReasons[alertId] || null },
        token,
        tenantSlug,
      );
      showSuccess('HDI Alert', 'Alert acknowledged.');
      await loadData();
    } catch (error: any) {
      showError('HDI Alert', error?.response?.data?.message || 'Failed to acknowledge alert.');
    }
  };

  const stopRemedy = async (remedyId: string) => {
    if (!tenantSlug || !token) return;
    try {
      await traditionalMedicineApi.updateRemedy(
        remedyId,
        {
          isOngoing: false,
          stoppedAt: new Date().toISOString().slice(0, 10),
        },
        token,
        tenantSlug,
      );
      showSuccess('Traditional Medicine', 'Remedy marked as stopped.');
      await loadData();
    } catch (error: any) {
      showError('Traditional Medicine', error?.response?.data?.message || 'Failed to update remedy.');
    }
  };

  const submitToxicity = async () => {
    if (!tenantSlug || !token || !toxicityForm.presentation.trim()) {
      showError('Toxicity Event', 'Presentation details are required.');
      return;
    }

    let labMarkers: Record<string, number> | null = null;
    if (toxicityForm.labMarkersJson.trim()) {
      try {
        labMarkers = JSON.parse(toxicityForm.labMarkersJson);
      } catch {
        showError('Toxicity Event', 'Lab markers must be valid JSON.');
        return;
      }
    }

    try {
      const response = await traditionalMedicineApi.recordToxicityEvent(
        patientId,
        {
          tmRemedyId: toxicityForm.tmRemedyId || null,
          organSystem: toxicityForm.organSystem,
          presentation: toxicityForm.presentation.trim(),
          labMarkers,
          causalityAssessment: toxicityForm.causalityAssessment || null,
          outcome: toxicityForm.outcome || null,
          notes: toxicityForm.notes.trim() || null,
        },
        token,
        tenantSlug,
      );
      showSuccess(
        'Toxicity Event',
        response?.toxicityGuidance?.has_toxicity_risk
          ? 'Toxicity event saved with herb toxicity guidance.'
          : 'Toxicity event saved.',
      );
      setToxicityForm({
        tmRemedyId: '',
        organSystem: 'hepatic',
        presentation: '',
        labMarkersJson: '',
        causalityAssessment: 'possible',
        outcome: 'ongoing',
        notes: '',
      });
      await loadData();
    } catch (error: any) {
      showError('Toxicity Event', error?.response?.data?.message || 'Failed to save toxicity event.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'remedies', label: 'Remedies & Interactions', icon: Leaf },
          { key: 'alerts', label: 'Herb-Drug Alerts', icon: ShieldAlert },
          { key: 'toxicity', label: 'Toxicity Events', icon: FlaskConical },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as TabKey)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'remedies' && (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-700" />
              <h3 className="text-lg font-semibold text-slate-900">Record Traditional Remedy</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={remedyForm.remedyName} onChange={(e) => setRemedyForm((c) => ({ ...c, remedyName: e.target.value }))} placeholder="Remedy name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={remedyForm.scientificName} onChange={(e) => setRemedyForm((c) => ({ ...c, scientificName: e.target.value }))} placeholder="Scientific name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={remedyForm.preparation} onChange={(e) => setRemedyForm((c) => ({ ...c, preparation: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['decoction', 'infusion', 'powder', 'raw', 'capsule', 'topical', 'other'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={remedyForm.route} onChange={(e) => setRemedyForm((c) => ({ ...c, route: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['oral', 'topical', 'inhaled', 'rectal', 'other'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <input value={remedyForm.doseDescription} onChange={(e) => setRemedyForm((c) => ({ ...c, doseDescription: e.target.value }))} placeholder="Dose description" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
              <select value={remedyForm.frequency} onChange={(e) => setRemedyForm((c) => ({ ...c, frequency: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['daily', 'twice_daily', 'weekly', 'as_needed'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <input value={remedyForm.durationDays} onChange={(e) => setRemedyForm((c) => ({ ...c, durationDays: e.target.value }))} type="number" placeholder="Duration days (optional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={remedyForm.indication} onChange={(e) => setRemedyForm((c) => ({ ...c, indication: e.target.value }))} placeholder="Indication / reason for use" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
              <select value={remedyForm.source} onChange={(e) => setRemedyForm((c) => ({ ...c, source: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['traditional_healer', 'self', 'family', 'pharmacy', 'online'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
              </select>
              <input value={remedyForm.icd11Tm2Code} onChange={(e) => setRemedyForm((c) => ({ ...c, icd11Tm2Code: e.target.value }))} placeholder="ICD-11 TM2 code" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={remedyForm.snomedConceptId} onChange={(e) => setRemedyForm((c) => ({ ...c, snomedConceptId: e.target.value }))} placeholder="SNOMED concept ID" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <textarea value={remedyForm.notes} onChange={(e) => setRemedyForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={remedyForm.isDisclosed} onChange={(e) => setRemedyForm((c) => ({ ...c, isDisclosed: e.target.checked }))} />
              Patient disclosed use to clinician
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={submitRemedy} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                Save Remedy
              </button>
              <button type="button" onClick={manualRecheck} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <RefreshCcw className="h-4 w-4" />
                Manual Re-check
              </button>
            </div>

            <div className={`rounded-2xl border p-4 ${bannerStyles[interactionCheck?.alert_level || 'none'] || bannerStyles.none}`}>
              <div className="flex items-center gap-2">
                {interactionCheck?.alert_level === 'danger' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                <div>
                  <p className="text-sm font-semibold">
                    Interaction status: {interactionCheck?.alert_level || 'none'}
                  </p>
                  <p className="text-xs">
                    {interactionCheck?.interactions_found || 0} interaction(s) found
                  </p>
                </div>
              </div>
              {(interactionCheck?.interactions || []).slice(0, 3).map((item: any, index: number) => (
                <div key={`${item.herb}-${item.mechanism}-${index}`} className="mt-3 rounded-xl border border-white/40 bg-white/50 p-3 text-sm">
                  <p className="font-semibold">{item.herb} • {item.severity}</p>
                  <p>{item.clinical_effect}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Recorded Remedies</h3>
            <div className="space-y-3">
              {remedies.length === 0 && <p className="text-sm text-slate-500">No traditional remedies recorded yet.</p>}
              {remedies.map((remedy) => (
                <div key={remedy.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{remedy.remedyName}</p>
                      <p className="text-sm text-slate-500">{remedy.scientificName || 'Scientific name not recorded'}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${remedy.isOngoing ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                      {remedy.isOngoing ? 'ongoing' : 'stopped'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p><span className="font-medium text-slate-800">Dose:</span> {remedy.doseDescription || 'Not recorded'}</p>
                    <p><span className="font-medium text-slate-800">Indication:</span> {remedy.indication || 'Not recorded'}</p>
                    <p><span className="font-medium text-slate-800">Codes:</span> ICD-11 TM2 {remedy.icd11Tm2Code || '—'} • SNOMED {remedy.snomedConceptId || '—'}</p>
                  </div>
                  {remedy.isOngoing && (
                    <button type="button" onClick={() => stopRemedy(remedy.id)} className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Mark as stopped
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={manualRecheck} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <RefreshCcw className="h-4 w-4" />
              Re-check ongoing remedies
            </button>
          </div>
          {alerts.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              No herb-drug alerts recorded yet.
            </div>
          )}
          {alerts.map((alert) => {
            const remedy = alert.tmRemedyId ? remedyMap[alert.tmRemedyId] : null;
            return (
              <div key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{remedy?.remedyName || 'Traditional remedy'}</p>
                    <p className="text-sm text-slate-500">Matched drug: {alert.drugName}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityBadgeStyles[alert.severity] || severityBadgeStyles.informational}`}>
                    {alert.severity}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-900">Mechanism:</span> {alert.mechanism || 'Not specified'}</p>
                  <p><span className="font-semibold text-slate-900">Effect:</span> {alert.clinicalEffect}</p>
                  <p><span className="font-semibold text-slate-900">Management:</span> {alert.management || 'No management guidance supplied'}</p>
                </div>
                {!alert.acknowledgedAt ? (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={overrideReasons[alert.id] || ''}
                      onChange={(e) => setOverrideReasons((current) => ({ ...current, [alert.id]: e.target.value }))}
                      rows={2}
                      placeholder="Override reason / acknowledgement notes"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button type="button" onClick={() => acknowledgeAlert(alert.id)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                      Acknowledge alert
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Acknowledged {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleString() : ''}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'toxicity' && (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-amber-600" />
              <h3 className="text-lg font-semibold text-slate-900">Record Toxicity Event</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={toxicityForm.tmRemedyId} onChange={(e) => setToxicityForm((c) => ({ ...c, tmRemedyId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2">
                <option value="">Select suspect remedy (optional)</option>
                {remedies.map((remedy) => <option key={remedy.id} value={remedy.id}>{remedy.remedyName}</option>)}
              </select>
              <select value={toxicityForm.organSystem} onChange={(e) => setToxicityForm((c) => ({ ...c, organSystem: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['hepatic', 'renal', 'cardiac', 'neurological', 'haematological', 'other'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={toxicityForm.causalityAssessment} onChange={(e) => setToxicityForm((c) => ({ ...c, causalityAssessment: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['definite', 'probable', 'possible', 'unlikely'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={toxicityForm.outcome} onChange={(e) => setToxicityForm((c) => ({ ...c, outcome: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2">
                {['resolved', 'ongoing', 'hospitalised', 'fatal'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <textarea value={toxicityForm.presentation} onChange={(e) => setToxicityForm((c) => ({ ...c, presentation: e.target.value }))} rows={4} placeholder="Clinical presentation" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={toxicityForm.labMarkersJson} onChange={(e) => setToxicityForm((c) => ({ ...c, labMarkersJson: e.target.value }))} rows={3} placeholder='Lab markers JSON, e.g. {"ALT":320,"AST":280,"creatinine":2.1}' className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono" />
            <textarea value={toxicityForm.notes} onChange={(e) => setToxicityForm((c) => ({ ...c, notes: e.target.value }))} rows={3} placeholder="Notes" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={submitToxicity} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
              Save toxicity event
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Toxicity Event History</h3>
            <div className="space-y-3">
              {toxicityEvents.length === 0 && <p className="text-sm text-slate-500">No toxicity events recorded yet.</p>}
              {toxicityEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{event.organSystem}</p>
                      <p className="text-sm text-slate-500">{event.causalityAssessment || 'causality not set'} • {event.outcome || 'outcome not set'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {event.recordedAt ? new Date(event.recordedAt).toLocaleDateString() : 'Recorded'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{event.presentation}</p>
                  {event.labMarkers && (
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(event.labMarkers, null, 2)}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
