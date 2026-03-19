import React, { useState, useEffect } from 'react';
import { Home, ShoppingCart, Car, Users, DollarSign, BookOpen, Plus, ChevronDown, ChevronUp, CheckCircle, Clock } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface SdohAssessment {
  id: string;
  assessmentDate: string;
  housingStatus?: string;
  foodSecurityStatus?: string;
  transportationAccess?: string;
  socialIsolationScore?: number;
  financialStrain?: string;
  literacyLevel?: string;
  icdZCodes: Array<{ code: string; description: string }>;
  communityResourceReferrals: Array<{ resource: string; referralDate?: string; status?: string }>;
  notes?: string;
  createdAt: string;
}

interface PatientSdohTabProps {
  patientId: string;
  tenantSlug: string;
  token: string;
}

const HOUSING_LABELS: Record<string, { label: string; color: string }> = {
  stable: { label: 'Stable', color: 'text-green-700 bg-green-100' },
  unstable: { label: 'Unstable', color: 'text-amber-700 bg-amber-100' },
  at_risk: { label: 'At Risk', color: 'text-orange-700 bg-orange-100' },
  homeless: { label: 'Homeless', color: 'text-red-700 bg-red-100' },
};

const FOOD_LABELS: Record<string, { label: string; color: string }> = {
  secure: { label: 'Secure', color: 'text-green-700 bg-green-100' },
  insecure: { label: 'Insecure', color: 'text-amber-700 bg-amber-100' },
  hungry: { label: 'Hungry', color: 'text-red-700 bg-red-100' },
};

const FINANCIAL_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: 'None', color: 'text-green-700 bg-green-100' },
  mild: { label: 'Mild', color: 'text-yellow-700 bg-yellow-100' },
  moderate: { label: 'Moderate', color: 'text-orange-700 bg-orange-100' },
  severe: { label: 'Severe', color: 'text-red-700 bg-red-100' },
};

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
);

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm';

const emptyForm = {
  housingStatus: '',
  foodSecurityStatus: '',
  transportationAccess: '',
  socialIsolationScore: '',
  financialStrain: '',
  literacyLevel: '',
  notes: '',
};

const PatientSdohTab: React.FC<PatientSdohTabProps> = ({ patientId, tenantSlug, token }) => {
  const [assessments, setAssessments] = useState<SdohAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    load();
  }, [patientId]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await ehrApi.getPatientSdoh(patientId, token, tenantSlug);
      setAssessments(res.data || []);
    } catch {
      // silently keep empty
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (formData.housingStatus) payload.housingStatus = formData.housingStatus;
      if (formData.foodSecurityStatus) payload.foodSecurityStatus = formData.foodSecurityStatus;
      if (formData.transportationAccess) payload.transportationAccess = formData.transportationAccess;
      if (formData.socialIsolationScore !== '') payload.socialIsolationScore = parseInt(formData.socialIsolationScore, 10);
      if (formData.financialStrain) payload.financialStrain = formData.financialStrain;
      if (formData.literacyLevel) payload.literacyLevel = formData.literacyLevel;
      if (formData.notes) payload.notes = formData.notes;

      await ehrApi.createPatientSdoh(patientId, payload, token, tenantSlug);
      showSuccess('SDOH Saved', 'Social determinants assessment recorded');
      setShowForm(false);
      setFormData(emptyForm);
      await load();
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to save SDOH assessment');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  const latest = assessments[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Social Determinants of Health</h3>
          <p className="text-xs text-slate-500 mt-0.5">SDOH assessments feed the AI risk stratification model</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Assessment
        </button>
      </div>

      {/* Latest summary cards */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {latest.housingStatus && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
              <Home className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Housing</p>
                <Badge {...(HOUSING_LABELS[latest.housingStatus] ?? { label: latest.housingStatus, color: 'text-slate-700 bg-slate-100' })} />
              </div>
            </div>
          )}
          {latest.foodSecurityStatus && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Food Security</p>
                <Badge {...(FOOD_LABELS[latest.foodSecurityStatus] ?? { label: latest.foodSecurityStatus, color: 'text-slate-700 bg-slate-100' })} />
              </div>
            </div>
          )}
          {latest.transportationAccess && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
              <Car className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Transportation</p>
                <span className="text-xs font-medium text-slate-700 capitalize">{latest.transportationAccess.replace('_', ' ')}</span>
              </div>
            </div>
          )}
          {latest.socialIsolationScore !== undefined && latest.socialIsolationScore !== null && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
              <Users className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Social Isolation</p>
                <span className={`text-xs font-semibold ${latest.socialIsolationScore >= 7 ? 'text-red-600' : latest.socialIsolationScore >= 4 ? 'text-amber-600' : 'text-green-600'}`}>
                  {latest.socialIsolationScore}/10
                </span>
              </div>
            </div>
          )}
          {latest.financialStrain && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Financial Strain</p>
                <Badge {...(FINANCIAL_LABELS[latest.financialStrain] ?? { label: latest.financialStrain, color: 'text-slate-700 bg-slate-100' })} />
              </div>
            </div>
          )}
          {latest.literacyLevel && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Literacy</p>
                <span className="text-xs font-medium text-slate-700 capitalize">{latest.literacyLevel}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ICD Z-codes from latest */}
      {latest?.icdZCodes?.length > 0 && (
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-purple-700 mb-2">Active ICD-11 Z-Codes</p>
          <div className="flex flex-wrap gap-2">
            {latest.icdZCodes.map((z, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-mono">
                <span className="font-semibold">{z.code}</span>
                <span className="font-normal text-purple-600">— {z.description}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* New assessment form */}
      {showForm && (
        <form onSubmit={handleSave} className="border border-indigo-200 rounded-xl p-4 space-y-4 bg-indigo-50/40">
          <h4 className="text-sm font-semibold text-indigo-800">New SDOH Assessment</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Housing Status</label>
              <select value={formData.housingStatus} onChange={(e) => set('housingStatus', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="stable">Stable</option>
                <option value="unstable">Unstable</option>
                <option value="at_risk">At Risk</option>
                <option value="homeless">Homeless</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Food Security</label>
              <select value={formData.foodSecurityStatus} onChange={(e) => set('foodSecurityStatus', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="secure">Secure</option>
                <option value="insecure">Insecure</option>
                <option value="hungry">Hungry</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Transportation Access</label>
              <select value={formData.transportationAccess} onChange={(e) => set('transportationAccess', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="own">Own vehicle</option>
                <option value="public">Public transport</option>
                <option value="none">No access</option>
                <option value="barrier">Barrier (cost/distance)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Social Isolation Score (0–10)</label>
              <input
                type="number" min="0" max="10" step="1"
                value={formData.socialIsolationScore}
                onChange={(e) => set('socialIsolationScore', e.target.value)}
                className={inputCls}
                placeholder="0 = connected, 10 = severely isolated"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Financial Strain</label>
              <select value={formData.financialStrain} onChange={(e) => set('financialStrain', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="none">None</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Health Literacy</label>
              <select value={formData.literacyLevel} onChange={(e) => set('literacyLevel', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="adequate">Adequate</option>
                <option value="limited">Limited</option>
                <option value="inadequate">Inadequate</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Clinical Notes</label>
            <textarea rows={2} value={formData.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} placeholder="Additional context for this assessment..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Assessment'}
            </button>
          </div>
        </form>
      )}

      {/* Assessment history */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assessment History</p>
        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : assessments.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No SDOH assessments recorded yet.</div>
        ) : (
          assessments.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {new Date(a.assessmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <div className="flex gap-1.5">
                    {a.housingStatus && <Badge {...(HOUSING_LABELS[a.housingStatus] ?? { label: a.housingStatus, color: 'text-slate-700 bg-slate-100' })} />}
                    {a.financialStrain && a.financialStrain !== 'none' && <Badge {...(FINANCIAL_LABELS[a.financialStrain] ?? { label: a.financialStrain, color: 'text-slate-700 bg-slate-100' })} />}
                  </div>
                </div>
                {expandedId === a.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedId === a.id && (
                <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {a.housingStatus && <div><span className="text-slate-500">Housing:</span> <span className="font-medium capitalize">{a.housingStatus.replace('_', ' ')}</span></div>}
                    {a.foodSecurityStatus && <div><span className="text-slate-500">Food:</span> <span className="font-medium capitalize">{a.foodSecurityStatus}</span></div>}
                    {a.transportationAccess && <div><span className="text-slate-500">Transport:</span> <span className="font-medium capitalize">{a.transportationAccess.replace('_', ' ')}</span></div>}
                    {a.socialIsolationScore !== undefined && a.socialIsolationScore !== null && <div><span className="text-slate-500">Isolation:</span> <span className="font-medium">{a.socialIsolationScore}/10</span></div>}
                    {a.financialStrain && <div><span className="text-slate-500">Financial:</span> <span className="font-medium capitalize">{a.financialStrain}</span></div>}
                    {a.literacyLevel && <div><span className="text-slate-500">Literacy:</span> <span className="font-medium capitalize">{a.literacyLevel}</span></div>}
                  </div>
                  {a.notes && <p className="text-xs text-slate-600 italic">{a.notes}</p>}
                  {a.communityResourceReferrals?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Community Referrals</p>
                      <div className="space-y-1">
                        {a.communityResourceReferrals.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                            <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{r.resource}</span>
                            {r.status && <Badge label={r.status} color="text-slate-600 bg-slate-100" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PatientSdohTab;
