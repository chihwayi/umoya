import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Activity, AlertCircle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import axios from 'axios';
import { runtimeUrls } from '../config/runtime';

const auth = () => ({
  token: localStorage.getItem('ehr_token') || '',
  tenantSlug: localStorage.getItem('ehr_tenant_slug') || '',
});

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

interface RegisterRecord {
  id: string;
  patientName: string;
  endocrineCondition: string;
  tsh: number;
  hba1c: number;
  enrollmentDate: string;
  status: string;
}

const EndocrinologyDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'register' | 'cdss'>('register');
  const [registerData, setRegisterData] = useState<RegisterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Register form
  const [registerForm, setRegisterForm] = useState({
    patientId: '',
    primaryCondition: '',
    tsh: '',
    hba1c: '',
  });

  // Thyroid Management form
  const [thyroidForm, setThyroidForm] = useState({
    tsh: '',
    ft4: '',
    symptoms: '',
  });
  const [thyroidResult, setThyroidResult] = useState<any>(null);

  // Adrenal Crisis form
  const [adrenalForm, setAdrenalForm] = useState({
    haemodynamicInstability: false,
    nausea: false,
    lowSodium: false,
    highPotassium: false,
  });
  const [adrenalResult, setAdrenalResult] = useState<any>(null);

  // Levothyroxine Dose form
  const [levoForm, setLevoForm] = useState({
    weight: '',
    age: '',
    cardiacDisease: false,
    pregnant: false,
    currentDose: '',
  });
  const [levoResult, setLevoResult] = useState<any>(null);

  const loadRegister = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/endocrinology/register`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setRegisterData(response.data || []);
    } catch (error) {
      console.error('Failed to load endocrinology register:', error);
      showError('Error', 'Failed to load register');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (activeTab === 'register') {
      loadRegister();
    }
  }, [activeTab, loadRegister]);

  const saveRegisterEntry = async () => {
    setSaving(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const payload = {
        patientId: registerForm.patientId,
        primaryCondition: registerForm.primaryCondition,
        tsh: parseFloat(registerForm.tsh) || null,
        hba1c: parseFloat(registerForm.hba1c) || null,
      };
      await axios.post(`${runtimeUrls.ehrApi}/endocrinology/register`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      showSuccess('Success', 'Patient added to endocrinology register');
      setRegisterForm({ patientId: '', primaryCondition: '', tsh: '', hba1c: '' });
      await loadRegister();
    } catch (error) {
      console.error('Failed to save register entry:', error);
      showError('Error', 'Failed to save patient');
    } finally {
      setSaving(false);
    }
  };

  const assessThyroid = () => {
    const tsh = parseFloat(thyroidForm.tsh) || 0;
    const ft4 = parseFloat(thyroidForm.ft4) || 0;

    let classification = '';
    let guidance = '';

    if (tsh < 0.5 && ft4 > 24) {
      classification = 'Hyperthyroid';
      guidance = 'Start carbimazole 10mg TDS or propranolol 40mg TDS. PTU 100mg TDS if pregnant. Check TSH/FT4 weekly until stable.';
    } else if (tsh < 0.5 && ft4 <= 24) {
      classification = 'Subclinical hyperthyroid';
      guidance = 'Consider watchful waiting or low-dose carbimazole if symptomatic. Recheck in 6 weeks.';
    } else if (tsh > 4.0 && ft4 < 10) {
      classification = 'Hypothyroid';
      guidance = 'Start levothyroxine 25-50µg daily. Increase by 25µg every 4-6 weeks. Target TSH 0.5-2.0. Recheck TSH in 6-8 weeks.';
    } else if (tsh > 4.0 && ft4 >= 10) {
      classification = 'Subclinical hypothyroid';
      guidance = 'Monitor. Start levothyroxine if: TSH >10, symptoms of hypothyroidism, pregnancy planning, or cardiac disease.';
    } else {
      classification = 'Euthyroid';
      guidance = 'Normal thyroid function. Continue current management. Rescreen annually if on replacement.';
    }

    setThyroidResult({ classification, guidance });
  };

  const checkAdrenalCrisis = () => {
    const isCrisis = adrenalForm.haemodynamicInstability || adrenalForm.nausea || adrenalForm.lowSodium || adrenalForm.highPotassium;

    const protocol = isCrisis
      ? `ADRENAL CRISIS PROTOCOL:
1. IV access × 2 large bore
2. Hydrocortisone 100mg IV stat
3. Then 50-100mg IV q6-8h OR continuous infusion 10mg/h
4. Rapid NS infusion (500mL over 30 min), repeat as needed
5. Monitor electrolytes q2-4h
6. Investigate trigger (infection, trauma, medication change)
7. Once stable, transition to oral replacement`
      : 'Clinical features suggest possible adrenal crisis. Immediate specialist evaluation required.';

    setAdrenalResult({ protocol, isCrisis });
  };

  const calculateLevothyroxineDose = () => {
    const weight = parseFloat(levoForm.weight) || 0;
    const age = parseInt(levoForm.age) || 0;

    let baseDose = weight * 1.6; // µg/day

    if (age > 65 || levoForm.cardiacDisease) {
      baseDose = baseDose * 0.75; // Reduce by 25% in elderly or cardiac disease
    }

    if (levoForm.pregnant) {
      baseDose = baseDose * 1.3; // Increase by 30% in pregnancy
    }

    const currentDose = parseFloat(levoForm.currentDose) || 0;
    let adjustment = '';
    if (currentDose > 0) {
      const diff = baseDose - currentDose;
      if (diff > 12.5) {
        adjustment = `Increase by ${Math.round(diff / 12.5) * 12.5}µg`;
      } else if (diff < -12.5) {
        adjustment = `Decrease by ${Math.round(-diff / 12.5) * 12.5}µg`;
      } else {
        adjustment = 'No change needed';
      }
    }

    const rationale = levoForm.cardiacDisease
      ? 'Reduced dose due to cardiac disease (risk of arrhythmia). Monitor HR and ECG.'
      : levoForm.pregnant
      ? 'Increased dose during pregnancy. Recheck TSH monthly.'
      : 'Standard dose calculation: 1.6µg/kg/day.';

    setLevoResult({ calculatedDose: Math.round(baseDose), adjustment, rationale });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl shadow-sm border border-yellow-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Endocrinology Dashboard</h1>
              <p className="text-sm text-slate-600">Patient register and CDSS endocrine clinical decision support</p>
            </div>
          </div>
          <button
            onClick={loadRegister}
            disabled={loading}
            className="p-2 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Total Enrolled</div>
          <div className="text-2xl font-bold text-yellow-600">{registerData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Active Patients</div>
          <div className="text-2xl font-bold text-amber-600">{registerData.filter(r => r.status === 'active').length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Avg TSH (mIU/L)</div>
          <div className="text-2xl font-bold text-orange-600">
            {registerData.length > 0 ? (registerData.reduce((sum, r) => sum + r.tsh, 0) / registerData.length).toFixed(1) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">CDSS Tools</div>
          <div className="text-2xl font-bold text-red-600">3</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {(['register', 'cdss'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'text-yellow-600 border-b-2 border-yellow-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Register Tab */}
      {activeTab === 'register' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add Patient to Register
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Patient ID"
                value={registerForm.patientId}
                onChange={(e) => setRegisterForm({ ...registerForm, patientId: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Primary Condition (Diabetes, Hypothyroidism, etc.)"
                value={registerForm.primaryCondition}
                onChange={(e) => setRegisterForm({ ...registerForm, primaryCondition: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="TSH (mIU/L)"
                step="0.1"
                value={registerForm.tsh}
                onChange={(e) => setRegisterForm({ ...registerForm, tsh: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="HbA1c (%)"
                step="0.1"
                value={registerForm.hba1c}
                onChange={(e) => setRegisterForm({ ...registerForm, hba1c: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <button
                onClick={saveRegisterEntry}
                disabled={saving}
                className="md:col-span-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Add to Register
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Condition</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">TSH (mIU/L)</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">HbA1c (%)</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Enrollment</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {registerData.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{record.patientName}</td>
                    <td className="px-4 py-3">{record.endocrineCondition}</td>
                    <td className="px-4 py-3">
                      <span className={record.tsh > 4 || (record.tsh > 0 && record.tsh < 0.5) ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                        {record.tsh}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={record.hba1c > 7 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                        {record.hba1c}
                      </span>
                    </td>
                    <td className="px-4 py-3">{fmt(record.enrollmentDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        record.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {registerData.length === 0 && (
              <div className="text-center py-8 text-slate-500">No patients enrolled</div>
            )}
          </div>
        </div>
      )}

      {/* CDSS Tab */}
      {activeTab === 'cdss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Thyroid Management */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Thyroid Management Algorithm</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="TSH (mIU/L)"
                step="0.1"
                value={thyroidForm.tsh}
                onChange={(e) => setThyroidForm({ ...thyroidForm, tsh: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="FT4 (pmol/L)"
                step="0.1"
                value={thyroidForm.ft4}
                onChange={(e) => setThyroidForm({ ...thyroidForm, ft4: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <textarea
                placeholder="Symptoms (fatigue, weight loss, tremor, etc.)"
                value={thyroidForm.symptoms}
                onChange={(e) => setThyroidForm({ ...thyroidForm, symptoms: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                rows={2}
              />
              <button
                onClick={assessThyroid}
                className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
              >
                Assess Thyroid
              </button>
              {thyroidResult && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Classification: <span className="text-yellow-600">{thyroidResult.classification}</span></p>
                  <p className="text-sm text-slate-700">{thyroidResult.guidance}</p>
                </div>
              )}
            </div>
          </div>

          {/* Adrenal Crisis Protocol */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Adrenal Crisis Protocol</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adrenalForm.haemodynamicInstability}
                  onChange={(e) => setAdrenalForm({ ...adrenalForm, haemodynamicInstability: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Haemodynamic instability</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adrenalForm.nausea}
                  onChange={(e) => setAdrenalForm({ ...adrenalForm, nausea: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Severe nausea/vomiting</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adrenalForm.lowSodium}
                  onChange={(e) => setAdrenalForm({ ...adrenalForm, lowSodium: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Hyponatraemia (Na &lt;130)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={adrenalForm.highPotassium}
                  onChange={(e) => setAdrenalForm({ ...adrenalForm, highPotassium: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Hyperkalaemia (K &gt;5.5)</span>
              </label>
              <button
                onClick={checkAdrenalCrisis}
                className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
              >
                Adrenal Crisis Check
              </button>
              {adrenalResult && (
                <div className={`mt-4 p-4 rounded-lg whitespace-pre-wrap text-xs leading-relaxed ${adrenalResult.isCrisis ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <p className={`font-semibold ${adrenalResult.isCrisis ? 'text-red-900' : 'text-yellow-900'}`}>{adrenalResult.protocol}</p>
                </div>
              )}
            </div>
          </div>

          {/* Levothyroxine Dose Calculator */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Levothyroxine Dose Calculator</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="number"
                placeholder="Weight (kg)"
                value={levoForm.weight}
                onChange={(e) => setLevoForm({ ...levoForm, weight: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Age"
                value={levoForm.age}
                onChange={(e) => setLevoForm({ ...levoForm, age: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Current Dose (µg)"
                value={levoForm.currentDose}
                onChange={(e) => setLevoForm({ ...levoForm, currentDose: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levoForm.cardiacDisease}
                    onChange={(e) => setLevoForm({ ...levoForm, cardiacDisease: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 whitespace-nowrap">Cardiac disease</span>
                </label>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={levoForm.pregnant}
                    onChange={(e) => setLevoForm({ ...levoForm, pregnant: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 whitespace-nowrap">Pregnant</span>
                </label>
              </div>
              <button
                onClick={calculateLevothyroxineDose}
                className="md:col-span-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
              >
                Calculate Dose
              </button>
              {levoResult && (
                <div className="md:col-span-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Calculated Dose: <span className="text-yellow-600">{levoResult.calculatedDose}µg/day</span></p>
                  {levoResult.adjustment && (
                    <p className="text-sm text-slate-700"><span className="font-semibold">Adjustment:</span> {levoResult.adjustment}</p>
                  )}
                  <p className="text-sm text-slate-700"><span className="font-semibold">Rationale:</span> {levoResult.rationale}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EndocrinologyDashboard;
