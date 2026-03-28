import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, Plus, ChevronDown, ChevronUp, CheckCircle,
  AlertTriangle, ClipboardList, Users, FlaskConical, Calendar,
} from 'lucide-react';
import { cdssApi } from '../services/api';

interface TbPatient {
  id: string;
  patientId: string;
  tbRegisterNumber?: string;
  registrationDate: string;
  caseType: string;
  treatmentCategory: string;
  hivStatus: string;
  anatomicalSite?: string;
  treatingFacility?: string;
  status: string;
}

interface TbDotRecord {
  id: string;
  dotDate: string;
  observed: boolean;
  dotMethod: string;
  reasonMissed?: string;
}

interface AdherenceResult {
  total_doses_expected: number;
  doses_observed: number;
  adherence_rate_percent: number;
  default_risk: string;
  alert?: string;
}

interface TbDashboardProps {
  patientId: string;
  token: string;
  tenantSlug: string;
}

const CASE_TYPE_LABEL: Record<string, string> = {
  pulmonary: 'Pulmonary TB',
  extrapulmonary: 'Extrapulmonary TB',
  mdr: 'MDR-TB',
  xdr: 'XDR-TB',
  other: 'Other TB',
};

const STATUS_COLORS: Record<string, string> = {
  on_treatment:   'bg-blue-100 text-blue-800',
  completed:      'bg-green-100 text-green-800',
  cured:          'bg-green-100 text-green-800',
  failed:         'bg-red-100 text-red-800',
  died:           'bg-slate-200 text-slate-700',
  ltfu:           'bg-amber-100 text-amber-800',
  transferred_out:'bg-purple-100 text-purple-800',
  not_evaluated:  'bg-slate-100 text-slate-600',
};

const RISK_COLORS: Record<string, string> = {
  high:     'text-red-600',
  moderate: 'text-amber-600',
  low:      'text-green-600',
  unknown:  'text-slate-400',
};

const TbDashboard: React.FC<TbDashboardProps> = ({ patientId, token, tenantSlug }) => {
  const [tbRecord, setTbRecord]         = useState<TbPatient | null>(null);
  const [dotRecords, setDotRecords]     = useState<TbDotRecord[]>([]);
  const [adherence, setAdherence]       = useState<AdherenceResult | null>(null);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<'overview' | 'dot' | 'contacts' | 'dst'>('overview');
  const [showRegisterForm, setShowForm] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    caseType: 'pulmonary', treatmentCategory: 'new', hivStatus: 'unknown',
    anatomicalSite: '', treatingFacility: '', tbRegisterNumber: '',
  });
  const [dotForm, setDotForm]           = useState({ dotDate: '', observed: true, dotMethod: 'in_person', reasonMissed: '' });
  const [submitting, setSubmitting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cdssApi.getTbPatientByPatient(patientId, token, tenantSlug);
      if (res.data) {
        setTbRecord(res.data);
        const dotRes = await cdssApi.getTbDotRecords(res.data.id, token, tenantSlug);
        const records = dotRes.data || [];
        setDotRecords(records);
        if (records.length) {
          const adhRes = await cdssApi.analyseTbAdherence(
            { tb_patient_id: res.data.id, dot_records: records },
            token, tenantSlug,
          );
          setAdherence(adhRes.data);
        }
      }
    } catch {
      // no TB record yet
    } finally {
      setLoading(false);
    }
  }, [patientId, token, tenantSlug]);

  useEffect(() => { load(); }, [load]);

  const handleRegister = async () => {
    setSubmitting(true);
    try {
      await cdssApi.registerTbPatient({ ...registerForm, patientId }, token, tenantSlug);
      setShowForm(false);
      load();
    } catch {
      // swallow
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordDot = async () => {
    if (!tbRecord || !dotForm.dotDate) return;
    setSubmitting(true);
    try {
      await cdssApi.recordTbDot(tbRecord.id, {
        ...dotForm,
        patientId,
        observed: Boolean(dotForm.observed),
      }, token, tenantSlug);
      setDotForm({ dotDate: '', observed: true, dotMethod: 'in_person', reasonMissed: '' });
      load();
    } catch {
      // swallow
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-slate-400">Loading TB records…</div>;

  if (!tbRecord && !showRegisterForm) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-slate-800">Tuberculosis</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
          >
            <Plus className="w-3.5 h-3.5" /> Register TB Case
          </button>
        </div>
        <p className="text-xs text-slate-400">No TB case registered for this patient.</p>
      </div>
    );
  }

  if (showRegisterForm) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-red-600" />
          <span className="font-semibold text-slate-800">Register TB Case</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Case Type</label>
            <select value={registerForm.caseType} onChange={e => setRegisterForm(f => ({ ...f, caseType: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5">
              {Object.entries(CASE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Treatment Category</label>
            <select value={registerForm.treatmentCategory} onChange={e => setRegisterForm(f => ({ ...f, treatmentCategory: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5">
              {['new','relapse','treatment_after_failure','treatment_after_ltfu','other_previously_treated','unknown'].map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">HIV Status</label>
            <select value={registerForm.hivStatus} onChange={e => setRegisterForm(f => ({ ...f, hivStatus: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5">
              {['positive','negative','unknown'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">TB Register #</label>
            <input value={registerForm.tbRegisterNumber} onChange={e => setRegisterForm(f => ({ ...f, tbRegisterNumber: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" placeholder="e.g. ZW-2026-001" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-500 block mb-1">Treating Facility</label>
            <input value={registerForm.treatingFacility} onChange={e => setRegisterForm(f => ({ ...f, treatingFacility: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRegister} disabled={submitting}
            className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-60">
            {submitting ? 'Saving…' : 'Register'}
          </button>
          <button onClick={() => setShowForm(false)} className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs hover:bg-slate-200">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{CASE_TYPE_LABEL[tbRecord!.caseType] ?? tbRecord!.caseType}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[tbRecord!.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {tbRecord!.status.replace(/_/g, ' ')}
                </span>
                {tbRecord!.hivStatus === 'positive' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-800">HIV+</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Reg: {tbRecord!.tbRegisterNumber || 'N/A'} · Category: {tbRecord!.treatmentCategory.replace(/_/g, ' ')}
                {tbRecord!.treatingFacility && ` · ${tbRecord!.treatingFacility}`}
              </p>
            </div>
          </div>
        </div>

        {/* Adherence summary */}
        {adherence && (
          <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Adherence</p>
              <p className="text-lg font-bold text-slate-900">{adherence.adherence_rate_percent}%</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Doses</p>
              <p className="text-sm font-semibold text-slate-700">{adherence.doses_observed}/{adherence.total_doses_expected}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Default Risk</p>
              <p className={`text-sm font-bold ${RISK_COLORS[adherence.default_risk]}`}>
                {adherence.default_risk.toUpperCase()}
              </p>
            </div>
            {adherence.alert && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 border border-red-200 rounded text-xs text-red-700 max-w-xs">
                <AlertTriangle className="w-3 h-3 shrink-0" />{adherence.alert}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {(['overview', 'dot', 'contacts', 'dst'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === tab ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab === 'dot' ? 'DOT Records' : tab === 'dst' ? 'DST Results' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-2 text-xs text-slate-700">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Registration Date', new Date(tbRecord!.registrationDate).toLocaleDateString()],
              ['Anatomical Site', tbRecord!.anatomicalSite || '—'],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-slate-400 text-[10px] uppercase">{k}</p>
                <p className="font-medium">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DOT Records tab */}
      {activeTab === 'dot' && (
        <div className="space-y-3">
          {/* Quick DOT entry */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600">Record Today's DOT</p>
            <div className="flex gap-2 items-end">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Date</label>
                <input type="date" value={dotForm.dotDate} onChange={e => setDotForm(f => ({ ...f, dotDate: e.target.value }))}
                  className="text-xs border border-slate-200 rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Observed?</label>
                <select value={dotForm.observed ? 'yes' : 'no'} onChange={e => setDotForm(f => ({ ...f, observed: e.target.value === 'yes' }))}
                  className="text-xs border border-slate-200 rounded px-2 py-1">
                  <option value="yes">Yes</option>
                  <option value="no">No (missed)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Method</label>
                <select value={dotForm.dotMethod} onChange={e => setDotForm(f => ({ ...f, dotMethod: e.target.value }))}
                  className="text-xs border border-slate-200 rounded px-2 py-1">
                  {['in_person','video','community_worker','self_administered'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <button onClick={handleRecordDot} disabled={submitting || !dotForm.dotDate}
                className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 disabled:opacity-60">
                Save
              </button>
            </div>
            {!dotForm.observed && (
              <textarea value={dotForm.reasonMissed} onChange={e => setDotForm(f => ({ ...f, reasonMissed: e.target.value }))}
                placeholder="Reason missed…" rows={2}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 resize-none" />
            )}
          </div>

          {/* DOT history */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {dotRecords.length === 0 && <p className="text-xs text-slate-400">No DOT records yet.</p>}
            {dotRecords.map((d) => (
              <div key={d.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${d.observed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {d.observed
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  <span className="font-medium">{new Date(d.dotDate).toLocaleDateString()}</span>
                  <span className="text-slate-400">{d.dotMethod.replace(/_/g,' ')}</span>
                </div>
                {d.reasonMissed && <span className="text-red-600 italic truncate max-w-[160px]">{d.reasonMissed}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts and DST tabs — placeholders with navigation prompt */}
      {(activeTab === 'contacts' || activeTab === 'dst') && (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs gap-2">
          {activeTab === 'contacts' ? <Users className="w-8 h-8" /> : <FlaskConical className="w-8 h-8" />}
          <p>
            {activeTab === 'contacts' ? 'Contact investigations' : 'DST results'} are managed via the
            {' '}<span className="text-indigo-600 font-medium">TB module API</span> (
            <code className="text-[10px] bg-slate-100 px-1 rounded">
              {activeTab === 'contacts' ? `GET /tb/${tbRecord!.id}/contacts` : `GET /tb/${tbRecord!.id}/dst`}
            </code>).
          </p>
        </div>
      )}
    </div>
  );
};

export default TbDashboard;
