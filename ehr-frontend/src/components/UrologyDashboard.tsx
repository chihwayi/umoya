import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Activity, AlertCircle } from 'lucide-react';
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
  primaryCondition: string;
  ipssScore: number;
  psa: number;
  enrollmentDate: string;
}

const UrologyDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'register' | 'cdss'>('register');
  const [registerData, setRegisterData] = useState<RegisterRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // BPH/IPSS form
  const [bphForm, setBphForm] = useState({
    ipssScore: '',
    uroflowRate: '',
    postVoidResidual: '',
  });
  const [bphResult, setBphResult] = useState<any>(null);

  // Renal Stone form
  const [stoneForm, setStoneForm] = useState({
    stoneSize: '',
    uretericColic: false,
    infectionPresent: false,
    solcaryKidney: false,
  });
  const [stoneResult, setStoneResult] = useState<any>(null);

  // PSA Interpretation form
  const [psaForm, setPsaForm] = useState({
    psa: '',
    age: '',
    prostateVolume: '',
    previousBiopsy: false,
  });
  const [psaResult, setPsaResult] = useState<any>(null);

  const loadRegister = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/urology/register`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setRegisterData(response.data || []);
    } catch (error) {
      console.error('Failed to load urology register:', error);
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

  const getBPHManagement = () => {
    const ipss = parseInt(bphForm.ipssScore) || 0;
    const uroflow = parseFloat(bphForm.uroflowRate) || 0;
    const pvr = parseFloat(bphForm.postVoidResidual) || 0;

    let recommendation = '';
    if (ipss <= 7) {
      recommendation = 'Watchful waiting: annual DRE, PSA, renal function, post-void residual. Lifestyle modifications (fluid restriction, avoid caffeine/alcohol)';
    } else if (ipss <= 19) {
      recommendation = 'Start α-blocker (tamsulosin 0.4mg daily or doxazosin 2-4mg daily). Consider 5-alpha reductase inhibitor if prostate >40g';
    } else {
      recommendation = 'Moderate-to-severe symptoms: consider TURP or laser (GreenLight/HoLEP) if medical therapy fails or acute retention occurs. Refer to urology.';
    }

    if (pvr > 300 || (uroflow > 0 && uroflow < 10)) {
      recommendation += ' ⚠️ High post-void residual or poor flow—urgent urology review for possible retention/obstruction.';
    }

    setBphResult({ recommendation, ipss });
  };

  const getStoneManagement = () => {
    const size = parseFloat(stoneForm.stoneSize) || 0;
    let plan = '';

    if (stoneForm.uretericColic && stoneForm.infectionPresent) {
      plan = 'URGENT: Infected obstructed ureter → percutaneous nephrostomy or ureteric stent. IV antibiotics + pain relief + urgent urology.';
    } else if (size < 5) {
      plan = 'Conservative: pain management, hydration, NSAIDs (indomethacin 50mg TDS), alpha-blockers (tamsulosin). Most pass spontaneously.';
    } else if (size < 10) {
      plan = 'ESWL (extracorporeal shock wave lithotripsy) or URS (ureteroscopic lithotripsy) if ESWL contraindicated.';
    } else {
      plan = 'PCNL (percutaneous nephrolithotomy) for large stones. Consider pre-treatment with alpha-blocker if in ureter.';
    }

    if (stoneForm.solcaryKidney) {
      plan += ' ⚠️ Solitary kidney—avoid aggressive intervention; consider medical management first.';
    }

    setStoneResult({ plan, size });
  };

  const interpretPSA = () => {
    const psa = parseFloat(psaForm.psa) || 0;
    const age = parseInt(psaForm.age) || 0;
    const volume = parseFloat(psaForm.prostateVolume) || 0;
    const psa_density = volume > 0 ? psa / volume : 0;

    let interpretation = '';
    let recommendation = '';

    if (age < 40) {
      interpretation = 'Age <40: PSA screening not recommended unless high risk (family history).';
    } else if (age >= 40 && age < 50) {
      if (psa < 1.0) {
        interpretation = 'Low risk: PSA <1.0 ng/mL in men age 40-49. Rescreen in 2 years.';
      } else {
        interpretation = 'Consider annual screening.';
        recommendation = 'If PSA >2.5, discuss PSA density and DRE; consider prostate biopsy.';
      }
    } else if (age >= 50) {
      if (psa < 2.5) {
        interpretation = 'Age-appropriate: PSA <2.5 ng/mL in men ≥50. Rescreen annually.';
      } else if (psa < 4.0) {
        interpretation = 'Borderline elevated: PSA 2.5–4.0 ng/mL. Check PSA density, DRE findings.';
        recommendation = `PSA density: ${psa_density.toFixed(2)}. If >0.15, consider biopsy.`;
      } else {
        interpretation = 'Elevated PSA: >4.0 ng/mL. Risk of malignancy increases with higher PSA.';
        recommendation = 'Discuss DRE, PSA density, multiparametric MRI, or prostate biopsy (MRI-guided preferred).';
      }
    }

    if (psaForm.previousBiopsy) {
      recommendation += ' Previous biopsy: follow trend. If persistently elevated, consider repeat or MRI surveillance.';
    }

    setPsaResult({ interpretation, recommendation, psa, psa_density: psa_density.toFixed(2) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-sm border border-blue-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Urology Dashboard</h1>
              <p className="text-sm text-slate-600">Patient register and CDSS clinical decision support tools</p>
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
          <div className="text-2xl font-bold text-blue-600">{registerData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">BPH Patients</div>
          <div className="text-2xl font-bold text-indigo-600">{registerData.filter(r => r.primaryCondition === 'BPH').length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Avg PSA</div>
          <div className="text-2xl font-bold text-cyan-600">
            {registerData.length > 0 ? (registerData.reduce((sum, r) => sum + r.psa, 0) / registerData.length).toFixed(1) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">CDSS Tools</div>
          <div className="text-2xl font-bold text-pink-600">3</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['register', 'cdss'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Register Tab */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Condition</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">IPSS</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">PSA (ng/mL)</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Enrollment</th>
              </tr>
            </thead>
            <tbody>
              {registerData.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{record.patientName}</td>
                  <td className="px-4 py-3">{record.primaryCondition}</td>
                  <td className="px-4 py-3 font-semibold">{record.ipssScore}</td>
                  <td className="px-4 py-3">
                    <span className={record.psa > 4 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                      {record.psa}
                    </span>
                  </td>
                  <td className="px-4 py-3">{fmt(record.enrollmentDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {registerData.length === 0 && (
            <div className="text-center py-8 text-slate-500">No patients enrolled</div>
          )}
        </div>
      )}

      {/* CDSS Tab */}
      {activeTab === 'cdss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BPH/IPSS Management */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">BPH / IPSS Management</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="IPSS Score (0-35)"
                value={bphForm.ipssScore}
                onChange={(e) => setBphForm({ ...bphForm, ipssScore: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Uroflow Rate (mL/s)"
                step="0.1"
                value={bphForm.uroflowRate}
                onChange={(e) => setBphForm({ ...bphForm, uroflowRate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Post-Void Residual (mL)"
                step="10"
                value={bphForm.postVoidResidual}
                onChange={(e) => setBphForm({ ...bphForm, postVoidResidual: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={getBPHManagement}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Get Management
              </button>
              {bphResult && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900 mb-2">IPSS: {bphResult.ipss}</p>
                  <p className="text-sm text-slate-700">{bphResult.recommendation}</p>
                </div>
              )}
            </div>
          </div>

          {/* Renal Stone Management */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Renal Stone Management</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Stone Size (mm)"
                step="0.1"
                value={stoneForm.stoneSize}
                onChange={(e) => setStoneForm({ ...stoneForm, stoneSize: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stoneForm.uretericColic}
                  onChange={(e) => setStoneForm({ ...stoneForm, uretericColic: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Ureteric colic</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stoneForm.infectionPresent}
                  onChange={(e) => setStoneForm({ ...stoneForm, infectionPresent: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Infection present</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stoneForm.solcaryKidney}
                  onChange={(e) => setStoneForm({ ...stoneForm, solcaryKidney: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Solitary kidney</span>
              </label>
              <button
                onClick={getStoneManagement}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Get Plan
              </button>
              {stoneResult && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900 mb-2">Size: {stoneResult.size} mm</p>
                  <p className="text-sm text-slate-700">{stoneResult.plan}</p>
                </div>
              )}
            </div>
          </div>

          {/* PSA Interpretation */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">PSA Interpretation</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="number"
                placeholder="PSA (ng/mL)"
                step="0.1"
                value={psaForm.psa}
                onChange={(e) => setPsaForm({ ...psaForm, psa: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Age"
                value={psaForm.age}
                onChange={(e) => setPsaForm({ ...psaForm, age: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Prostate Volume (mL)"
                step="0.1"
                value={psaForm.prostateVolume}
                onChange={(e) => setPsaForm({ ...psaForm, prostateVolume: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2 col-span-1">
                <input
                  type="checkbox"
                  checked={psaForm.previousBiopsy}
                  onChange={(e) => setPsaForm({ ...psaForm, previousBiopsy: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700 whitespace-nowrap">Previous biopsy</span>
              </label>
              <button
                onClick={interpretPSA}
                className="md:col-span-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Interpret PSA
              </button>
              {psaResult && (
                <div className="md:col-span-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-slate-900">PSA: {psaResult.psa} ng/mL | PSA Density: {psaResult.psa_density}</p>
                  <p className="text-sm text-slate-700"><span className="font-semibold">Interpretation:</span> {psaResult.interpretation}</p>
                  <p className="text-sm text-slate-700"><span className="font-semibold">Recommendation:</span> {psaResult.recommendation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrologyDashboard;
