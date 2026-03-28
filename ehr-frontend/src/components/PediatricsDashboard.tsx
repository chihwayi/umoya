import React, { useEffect, useState, useCallback } from 'react';
import {
  Baby, TrendingUp, Brain, Plus, AlertTriangle, CheckCircle,
  RefreshCw, ChevronDown, ChevronUp, Scale, Ruler,
} from 'lucide-react';
import { cdssApi } from '../services/api';

interface GrowthMeasurement {
  id: string;
  measuredAt: string;
  ageMonths?: number;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  muacCm?: number;
  weightForAgeZ?: number;
  heightForAgeZ?: number;
  nutritionalStatus?: string;
}

interface Milestone {
  id: string;
  domain: string;
  milestone: string;
  expectedAgeMonths?: number;
  status: string;
  notes?: string;
}

interface GrowthAssessment {
  weight_for_age_z?: number;
  height_for_age_z?: number;
  nutritional_status?: string;
  flags?: string[];
  growth_chart_percentile?: number;
  action_required?: boolean;
}

interface PediatricsDashboardProps {
  patientId: string;
  patientDob?: string;
  patientGender?: string;
  token: string;
  tenantSlug: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  gross_motor: 'bg-blue-100 text-blue-800 border-blue-200',
  fine_motor:  'bg-purple-100 text-purple-800 border-purple-200',
  language:    'bg-green-100 text-green-800 border-green-200',
  social:      'bg-pink-100 text-pink-800 border-pink-200',
  cognitive:   'bg-amber-100 text-amber-800 border-amber-200',
  adaptive:    'bg-teal-100 text-teal-800 border-teal-200',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  achieved: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
  delayed:  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
  referred: <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />,
  pending:  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />,
};

const NUTRITION_COLORS: Record<string, string> = {
  normal:              'text-green-600',
  underweight:         'text-amber-600',
  severely_underweight:'text-red-600',
  stunted:             'text-amber-600',
  severely_stunted:    'text-red-600',
  overweight:          'text-orange-600',
  obese:               'text-red-600',
  sam:                 'text-red-700',
  mam:                 'text-orange-600',
};

function calcAgeMonths(dob?: string): number | null {
  if (!dob) return null;
  const now   = new Date();
  const birth = new Date(dob);
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

function zColor(z?: number | null): string {
  if (z == null) return 'text-slate-400';
  if (z < -3 || z > 3) return 'text-red-600 font-bold';
  if (z < -2 || z > 2) return 'text-amber-600 font-semibold';
  return 'text-green-600';
}

const PediatricsDashboard: React.FC<PediatricsDashboardProps> = ({
  patientId, patientDob, patientGender, token, tenantSlug,
}) => {
  const [growth, setGrowth]             = useState<GrowthMeasurement[]>([]);
  const [milestones, setMilestones]     = useState<Milestone[]>([]);
  const [assessment, setAssessment]     = useState<GrowthAssessment | null>(null);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<'growth' | 'milestones' | 'neonatal'>('growth');
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [growthForm, setGrowthForm]     = useState({
    measuredAt: '', weightKg: '', heightCm: '', headCircumferenceCm: '', muacCm: '',
  });
  const [milestoneForm, setMilestoneForm] = useState({ domain: 'gross_motor', milestone: '', expectedAgeMonths: '', status: 'achieved' });
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  const ageMonths = calcAgeMonths(patientDob);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, mRes] = await Promise.all([
        cdssApi.getPediatricGrowth(patientId, token, tenantSlug),
        cdssApi.getPediatricMilestones(patientId, token, tenantSlug),
      ]);
      setGrowth(gRes.data || []);
      setMilestones(mRes.data || []);

      // If we have recent growth data, get AI assessment
      const latest = (gRes.data || [])[0];
      if (latest && ageMonths != null) {
        const aRes = await cdssApi.assessPediatricGrowth({
          patient_id: patientId,
          age_months: ageMonths,
          weight_kg:  latest.weightKg,
          height_cm:  latest.heightCm,
          muac_cm:    latest.muacCm,
          gender:     patientGender,
        }, token, tenantSlug);
        setAssessment(aRes.data);
      }
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }, [patientId, token, tenantSlug, ageMonths, patientGender]);

  useEffect(() => { load(); }, [load]);

  const handleAddGrowth = async () => {
    setSubmitting(true);
    try {
      await cdssApi.addPediatricGrowth(patientId, {
        measuredAt:          growthForm.measuredAt || undefined,
        weightKg:            growthForm.weightKg ? Number(growthForm.weightKg) : undefined,
        heightCm:            growthForm.heightCm ? Number(growthForm.heightCm) : undefined,
        headCircumferenceCm: growthForm.headCircumferenceCm ? Number(growthForm.headCircumferenceCm) : undefined,
        muacCm:              growthForm.muacCm ? Number(growthForm.muacCm) : undefined,
        ageMonths:           ageMonths ?? undefined,
      }, token, tenantSlug);
      setGrowthForm({ measuredAt: '', weightKg: '', heightCm: '', headCircumferenceCm: '', muacCm: '' });
      setShowGrowthForm(false);
      load();
    } catch {
      // swallow
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMilestone = async () => {
    setSubmitting(true);
    try {
      await cdssApi.upsertPediatricMilestone(patientId, {
        ...milestoneForm,
        expectedAgeMonths: milestoneForm.expectedAgeMonths ? Number(milestoneForm.expectedAgeMonths) : undefined,
        achievedDate: milestoneForm.status === 'achieved' ? new Date().toISOString().split('T')[0] : undefined,
        ageAtAchievementMonths: milestoneForm.status === 'achieved' && ageMonths != null ? ageMonths : undefined,
      }, token, tenantSlug);
      setMilestoneForm({ domain: 'gross_motor', milestone: '', expectedAgeMonths: '', status: 'achieved' });
      setShowMilestoneForm(false);
      load();
    } catch {
      // swallow
    } finally {
      setSubmitting(false);
    }
  };

  const latestGrowth = growth[0];
  const delayedMilestones = milestones.filter(m => m.status === 'delayed' || m.status === 'referred');

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-blue-600" />
            <div>
              <span className="font-semibold text-slate-900">Pediatric Record</span>
              {ageMonths != null && (
                <span className="ml-2 text-xs text-slate-500">
                  Age: {ageMonths < 24 ? `${ageMonths} months` : `${Math.floor(ageMonths / 12)}y ${ageMonths % 12}m`}
                </span>
              )}
            </div>
          </div>
          <button onClick={load} className="p-1.5 text-slate-400 hover:text-blue-600 rounded">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Quick stats */}
        {latestGrowth && (
          <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-3 gap-3">
            {latestGrowth.weightKg != null && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Scale className="w-3 h-3" /> Weight</p>
                <p className="text-base font-bold text-slate-800">{latestGrowth.weightKg} kg</p>
                {latestGrowth.weightForAgeZ != null && (
                  <p className={`text-[10px] ${zColor(latestGrowth.weightForAgeZ)}`}>WAZ {latestGrowth.weightForAgeZ > 0 ? '+' : ''}{latestGrowth.weightForAgeZ?.toFixed(1)}</p>
                )}
              </div>
            )}
            {latestGrowth.heightCm != null && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase flex items-center gap-1"><Ruler className="w-3 h-3" /> Height</p>
                <p className="text-base font-bold text-slate-800">{latestGrowth.heightCm} cm</p>
                {latestGrowth.heightForAgeZ != null && (
                  <p className={`text-[10px] ${zColor(latestGrowth.heightForAgeZ)}`}>HAZ {latestGrowth.heightForAgeZ > 0 ? '+' : ''}{latestGrowth.heightForAgeZ?.toFixed(1)}</p>
                )}
              </div>
            )}
            {latestGrowth.nutritionalStatus && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Status</p>
                <p className={`text-sm font-bold capitalize ${NUTRITION_COLORS[latestGrowth.nutritionalStatus] ?? 'text-slate-700'}`}>
                  {latestGrowth.nutritionalStatus.replace(/_/g, ' ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* AI flags */}
        {assessment?.flags && assessment.flags.length > 0 && (
          <div className="mt-2 space-y-1">
            {assessment.flags.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{f}
              </div>
            ))}
          </div>
        )}

        {/* Delayed milestones alert */}
        {delayedMilestones.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {delayedMilestones.length} delayed milestone{delayedMilestones.length !== 1 ? 's' : ''} — developmental review recommended
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {([['growth', 'Growth'], ['milestones', 'Milestones'], ['neonatal', 'Neonatal']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === tab ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Growth tab */}
      {activeTab === 'growth' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowGrowthForm(!showGrowthForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" /> Add Measurement
            </button>
          </div>

          {showGrowthForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">New Growth Measurement</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Date', 'measuredAt', 'date'],
                  ['Weight (kg)', 'weightKg', 'number'],
                  ['Height (cm)', 'heightCm', 'number'],
                  ['Head Circ (cm)', 'headCircumferenceCm', 'number'],
                  ['MUAC (cm)', 'muacCm', 'number'],
                ].map(([label, field, type]) => (
                  <div key={field}>
                    <label className="text-[10px] text-slate-400 block mb-1">{label}</label>
                    <input type={type} value={(growthForm as any)[field]}
                      onChange={e => setGrowthForm(f => ({ ...f, [field]: e.target.value }))}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddGrowth} disabled={submitting}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-60">
                  {submitting ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowGrowthForm(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading && <p className="text-xs text-slate-400">Loading…</p>}
          {!loading && growth.length === 0 && <p className="text-xs text-slate-400">No growth measurements recorded.</p>}

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {growth.map((g) => (
              <div key={g.id} className="flex items-center gap-3 bg-white border border-slate-100 rounded-lg px-3 py-2 text-xs">
                <span className="text-slate-400 w-20 shrink-0">{new Date(g.measuredAt).toLocaleDateString()}</span>
                {g.weightKg != null && <span className="flex items-center gap-1"><Scale className="w-3 h-3 text-slate-400" /><strong>{g.weightKg}</strong> kg</span>}
                {g.heightCm != null && <span className="flex items-center gap-1"><Ruler className="w-3 h-3 text-slate-400" /><strong>{g.heightCm}</strong> cm</span>}
                {g.weightForAgeZ != null && (
                  <span className={`ml-auto ${zColor(g.weightForAgeZ)}`}>WAZ {g.weightForAgeZ > 0 ? '+' : ''}{g.weightForAgeZ.toFixed(1)}</span>
                )}
                {g.nutritionalStatus && (
                  <span className={`capitalize text-[10px] ${NUTRITION_COLORS[g.nutritionalStatus] ?? 'text-slate-500'}`}>
                    {g.nutritionalStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones tab */}
      {activeTab === 'milestones' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowMilestoneForm(!showMilestoneForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700">
              <Plus className="w-3.5 h-3.5" /> Add Milestone
            </button>
          </div>

          {showMilestoneForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Record Milestone</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Domain</label>
                  <select value={milestoneForm.domain} onChange={e => setMilestoneForm(f => ({ ...f, domain: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1">
                    {Object.keys(DOMAIN_COLORS).map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Status</label>
                  <select value={milestoneForm.status} onChange={e => setMilestoneForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1">
                    {['achieved','delayed','referred','pending'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-1">Milestone Description</label>
                  <input value={milestoneForm.milestone} onChange={e => setMilestoneForm(f => ({ ...f, milestone: e.target.value }))}
                    placeholder="e.g. Sits without support" className="w-full text-xs border border-slate-200 rounded px-2 py-1" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Expected Age (months)</label>
                  <input type="number" value={milestoneForm.expectedAgeMonths} onChange={e => setMilestoneForm(f => ({ ...f, expectedAgeMonths: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddMilestone} disabled={submitting || !milestoneForm.milestone}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-700 disabled:opacity-60">
                  {submitting ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowMilestoneForm(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200">Cancel</button>
              </div>
            </div>
          )}

          {!loading && milestones.length === 0 && <p className="text-xs text-slate-400">No milestones recorded.</p>}

          {/* Group by domain */}
          {Object.keys(DOMAIN_COLORS).map(domain => {
            const domainMs = milestones.filter(m => m.domain === domain);
            if (domainMs.length === 0) return null;
            return (
              <div key={domain}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{domain.replace(/_/g, ' ')}</p>
                <div className="space-y-1">
                  {domainMs.map(m => (
                    <div key={m.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${DOMAIN_COLORS[m.domain] ?? ''}`}>
                      {STATUS_ICON[m.status]}
                      <span className="flex-1">{m.milestone}</span>
                      {m.expectedAgeMonths && <span className="text-slate-400 shrink-0">{m.expectedAgeMonths}m</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Neonatal tab */}
      {activeTab === 'neonatal' && (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs gap-2">
          <Baby className="w-8 h-8" />
          <p>Neonatal records are managed via <code className="text-[10px] bg-slate-100 px-1 rounded">POST /pediatrics/patient/{patientId}/neonatal</code></p>
        </div>
      )}
    </div>
  );
};

export default PediatricsDashboard;
