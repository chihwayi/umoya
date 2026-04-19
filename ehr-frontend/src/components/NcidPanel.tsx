import React, { useCallback, useEffect, useState } from 'react';
import {
  Fingerprint,
  AlertTriangle,
  CheckCircle,
  Plus,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ncidApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  patientId: string;
  tenantSlug: string;
  token: string;
  diagnoses: string[];
  ageYears: number;
  sex: string;
  isPregnant: boolean;
};

const ID_TYPES: Record<string, string[]> = {
  ZW: ['national_id', 'nhid', 'passport', 'birth_certificate'],
  ZA: ['national_id', 'passport', 'arc'],
  ZM: ['nrc', 'passport'],
  MZ: ['nuip', 'passport'],
  TZ: ['nida', 'passport'],
  KE: ['national_id', 'sha_beneficiary', 'passport'],
  MW: ['national_id', 'passport'],
  UG: ['national_id', 'passport'],
  RW: ['national_id', 'passport'],
  ET: ['national_id', 'passport'],
};

const PRIORITY_COLOURS: Record<string, string> = {
  urgent: 'bg-red-50 border-red-400 text-red-800',
  high: 'bg-orange-50 border-orange-400 text-orange-800',
  routine: 'bg-yellow-50 border-yellow-300 text-yellow-800',
};

const NcidPanel: React.FC<Props> = ({
  patientId,
  tenantSlug,
  token,
  diagnoses,
  ageYears,
  sex,
  isPregnant,
}) => {
  const { showError, showSuccess } = useNotification();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ids' | 'programmes' | 'gaps'>('ids');
  const [ids, setIds] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [gapSummary, setGapSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [form, setForm] = useState({
    countryCode: 'ZW',
    idType: 'national_id',
    idNumber: '',
    isPrimary: false,
  });

  const load = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [idsRes, progsRes] = await Promise.all([
        ncidApi.getPatientIds(tenantSlug, token, patientId),
        ncidApi.getProgrammes(tenantSlug, token, patientId),
      ]);
      setIds(Array.isArray(idsRes.data) ? idsRes.data : []);
      setProgrammes(Array.isArray(progsRes.data) ? progsRes.data : []);
    } catch {
      showError('NCID', 'Failed to load national IDs or programme linkages');
    } finally {
      setLoading(false);
    }
  }, [patientId, showError, tenantSlug, token]);

  const loadGaps = useCallback(async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const res = await ncidApi.analyseGaps(tenantSlug, token, patientId, {
        diagnoses,
        ageYears,
        sex,
        isPregnant,
      });
      const payload = res.data as { gaps?: unknown[]; summary?: string };
      setGaps(Array.isArray(payload?.gaps) ? (payload.gaps as any[]) : []);
      setGapSummary(payload?.summary ?? '');
    } catch {
      showError('NCID', 'Gap analysis failed');
    } finally {
      setLoading(false);
    }
  }, [ageYears, diagnoses, isPregnant, patientId, sex, showError, tenantSlug, token]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (activeTab === 'gaps' && open) void loadGaps();
  }, [activeTab, loadGaps, open]);

  const handleRegister = async () => {
    if (!tenantSlug || !token) return;
    try {
      await ncidApi.registerNcid(tenantSlug, token, { patientId, ...form });
      showSuccess('NCID', 'National ID registered');
      setShowRegisterForm(false);
      void load();
    } catch {
      showError('NCID', 'Could not register national ID — check format or duplicates');
    }
  };

  const urgentCount = gaps.filter(g => g?.priority === 'urgent').length;

  return (
    <div className="border border-slate-200/80 rounded-2xl mt-6 bg-white/70 backdrop-blur-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 rounded-t-2xl bg-slate-50/90 hover:bg-slate-100/90 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-emerald-600" />
          <span className="font-medium text-slate-800">National Client ID & Programme Linkages</span>
          {urgentCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {urgentCount} urgent gaps
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="p-4">
          <div className="flex gap-1 mb-4 border-b border-slate-200">
            {(['ids', 'programmes', 'gaps'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 text-sm font-medium rounded-t capitalize ${
                  activeTab === t
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'ids' ? 'National IDs' : t === 'programmes' ? 'Programmes' : 'Gap Analysis'}
              </button>
            ))}
          </div>

          {loading && <p className="text-sm text-slate-500">Loading...</p>}

          {activeTab === 'ids' && !loading && (
            <div>
              {ids.length === 0 && (
                <p className="text-sm text-slate-500 mb-3">No national IDs registered for this patient.</p>
              )}
              <div className="space-y-2 mb-3">
                {ids.map((idRow: any) => (
                  <div
                    key={idRow.id}
                    className="flex items-center justify-between bg-slate-50 rounded-lg p-2 text-sm border border-slate-100"
                  >
                    <div>
                      <span className="font-mono font-medium">{idRow.idNumberFormatted || idRow.idNumber}</span>
                      <span className="ml-2 text-slate-500">
                        {idRow.countryCode} · {idRow.idType}
                      </span>
                      {idRow.isPrimary && (
                        <span className="ml-2 bg-emerald-100 text-emerald-800 text-xs px-1 rounded">Primary</span>
                      )}
                    </div>
                    {idRow.verified ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                ))}
              </div>

              {!showRegisterForm && (
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(true)}
                  className="flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 font-medium"
                >
                  <Plus className="w-4 h-4" /> Register National ID
                </button>
              )}

              {showRegisterForm && (
                <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-3 space-y-2 mt-2">
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                    value={form.countryCode}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        countryCode: e.target.value,
                        idType: ID_TYPES[e.target.value]?.[0] ?? 'national_id',
                      }))
                    }
                  >
                    {Object.keys(ID_TYPES).map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                    value={form.idType}
                    onChange={e => setForm(f => ({ ...f, idType: e.target.value }))}
                  >
                    {(ID_TYPES[form.countryCode] ?? ['national_id']).map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                    placeholder="ID Number"
                    value={form.idNumber}
                    onChange={e => setForm(f => ({ ...f, idNumber: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isPrimary}
                      onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))}
                    />
                    Set as primary ID
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRegister()}
                      className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRegisterForm(false)}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'programmes' && !loading && (
            <div>
              {programmes.length === 0 && (
                <p className="text-sm text-slate-500">No programme linkages on record.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {programmes.map((p: any) => (
                  <div
                    key={p.id}
                    className={`rounded-lg p-2 text-sm border ${
                      p.active ? 'bg-emerald-50/80 border-emerald-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-emerald-600" />
                      <span className="font-medium capitalize text-slate-800">
                        {String(p.programme).replace(/_/g, ' ')}
                      </span>
                    </div>
                    {p.programmeNumber && (
                      <div className="text-slate-500 text-xs mt-0.5">#{p.programmeNumber}</div>
                    )}
                    {p.enrolledAt && (
                      <div className="text-slate-400 text-xs">Enrolled: {p.enrolledAt}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gaps' && !loading && (
            <div>
              {gapSummary && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900 mb-3">
                  {gapSummary}
                </div>
              )}
              {gaps.length === 0 && (
                <p className="text-sm text-emerald-700">No cross-programme enrolment gaps detected.</p>
              )}
              <div className="space-y-2">
                {gaps.map((gap: any, i: number) => (
                  <div
                    key={i}
                    className={`rounded-lg border-l-4 p-3 ${
                      PRIORITY_COLOURS[gap.priority] ?? 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm capitalize">
                        {String(gap.missing_programme ?? '').replace(/_/g, ' ') || 'Programme gap'}
                      </span>
                      <span className="text-xs font-medium uppercase">{gap.priority}</span>
                    </div>
                    <p className="text-xs mt-1 text-slate-700">{gap.reason}</p>
                    <p className="text-xs mt-1 font-medium text-slate-800">Action: {gap.action}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void loadGaps()}
                className="mt-3 text-xs text-emerald-700 hover:underline font-medium"
              >
                Re-run gap analysis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NcidPanel;
