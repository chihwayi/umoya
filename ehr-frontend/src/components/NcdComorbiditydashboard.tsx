import React, { useCallback, useState } from 'react';
import { RefreshCw, Activity, AlertCircle, AlertTriangle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import axios from 'axios';
import { runtimeUrls } from '../config/runtime';

const auth = () => ({
  token: localStorage.getItem('ehr_token') || '',
  tenantSlug: localStorage.getItem('ehr_tenant_slug') || '',
});

interface NCDProfile {
  diabetes: { hba1c: number; lastReview: string };
  ckd: { egfr: number; stage: string };
  cvd: { framingham10Yr: number; totalCholesterol: number; hdlCholesterol: number };
  retinopathy: { lastScreening: string; grade: string };
  comorbidityAlerts: string[];
}

const NcdComorbiditydashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'profile' | 'cvd-risk'>('profile');
  const [patientId, setPatientId] = useState('');
  const [profile, setProfile] = useState<NCDProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // CVD Risk form
  const [cvdForm, setCvdForm] = useState({
    age: '',
    gender: 'male',
    systolicBP: '',
    totalCholesterol: '',
    hdlCholesterol: '',
    diabetes: false,
    smoker: false,
    onBpMeds: false,
  });
  const [cvdResult, setCvdResult] = useState<any>(null);

  const loadProfile = useCallback(async () => {
    if (!patientId.trim()) {
      showError('Error', 'Enter patient ID');
      return;
    }
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/ncd-comorbidity/profile/${patientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setProfile(response.data || null);
    } catch (error) {
      console.error('Failed to load NCD profile:', error);
      showError('Error', 'Failed to load patient profile');
    } finally {
      setLoading(false);
    }
  }, [patientId, showError]);

  const syncProfile = async () => {
    if (!patientId.trim()) {
      showError('Error', 'Enter patient ID');
      return;
    }
    setSyncing(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.post(
        `${runtimeUrls.ehrApi}/ncd-comorbidity/profile/${patientId}/sync`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantSlug,
          },
        }
      );
      setProfile(response.data || null);
      showSuccess('Success', 'Profile synced');
    } catch (error) {
      console.error('Failed to sync profile:', error);
      showError('Error', 'Failed to sync profile');
    } finally {
      setSyncing(false);
    }
  };

  const calculateCVDRisk = () => {
    const age = parseInt(cvdForm.age) || 0;
    const sbp = parseInt(cvdForm.systolicBP) || 0;
    const tc = parseFloat(cvdForm.totalCholesterol) || 0;
    const hdl = parseFloat(cvdForm.hdlCholesterol) || 0;

    if (!age || !sbp || !tc || !hdl) {
      showError('Error', 'Fill in all fields');
      return;
    }

    // Simplified Framingham Risk Score (men vs women)
    let score = 0;
    const male = cvdForm.gender === 'male';

    // Age points
    if (male) {
      if (age < 35) score += 0;
      else if (age < 45) score += 1;
      else if (age < 55) score += 2;
      else if (age < 65) score += 3;
      else if (age < 75) score += 4;
      else score += 5;
    } else {
      if (age < 35) score += 0;
      else if (age < 45) score += 1;
      else if (age < 55) score += 2;
      else if (age < 65) score += 3;
      else if (age < 75) score += 4;
      else score += 5;
    }

    // TC points (simplified)
    if (tc < 160) score += 0;
    else if (tc < 200) score += 1;
    else if (tc < 240) score += 2;
    else if (tc < 280) score += 3;
    else score += 4;

    // HDL points (inverse)
    if (hdl > 60) score -= 1;
    else if (hdl >= 50) score += 0;
    else if (hdl >= 40) score += 1;
    else score += 2;

    // Systolic BP
    if (sbp < 120) score += 0;
    else if (sbp < 130) score += 1;
    else if (sbp < 140) score += 2;
    else if (sbp < 160) score += 3;
    else score += 4;

    // Diabetes
    if (cvdForm.diabetes) score += 2;

    // Smoker
    if (cvdForm.smoker) score += 2;

    // On BP meds
    if (cvdForm.onBpMeds) score += 1;

    // Convert to 10-year risk percentage (simplified)
    let riskPercentage = 0;
    if (male) {
      riskPercentage = Math.min(score * 1.5, 30);
    } else {
      riskPercentage = Math.min(score * 1.2, 25);
    }

    let category = '';
    let recommendations = '';

    if (riskPercentage < 10) {
      category = 'Low risk';
      recommendations = 'Continue lifestyle modifications: diet, exercise, no smoking. Reassess in 5 years.';
    } else if (riskPercentage < 20) {
      category = 'Intermediate risk';
      recommendations = 'Optimize BP control, lipid management. Consider statins. Reassess annually.';
    } else {
      category = 'High risk';
      recommendations = 'Start statin therapy. Tight BP/glucose/lipid control. Aspirin if no contraindications. Cardiology referral if severe.';
    }

    setCvdResult({ riskPercentage: parseFloat(riskPercentage.toFixed(1)), category, recommendations });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl shadow-sm border border-indigo-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">NCD Comorbidity Dashboard</h1>
              <p className="text-sm text-slate-600">Unified chronic disease profile and CVD risk assessment</p>
            </div>
          </div>
          <button
            onClick={() => patientId && loadProfile()}
            disabled={loading}
            className="p-2 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Patient ID Input */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
        <input
          type="text"
          placeholder="Enter Patient ID"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && loadProfile()}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          onClick={loadProfile}
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-semibold"
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {/* Tabs */}
      {profile && (
        <>
          <div className="flex gap-2 border-b border-slate-200">
            {(['profile', 'cvd-risk'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'profile' ? 'Profile' : 'CVD Risk'}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && profile && (
            <div className="space-y-6">
              {/* Comorbidity Alerts */}
              {profile.comorbidityAlerts && profile.comorbidityAlerts.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 mb-2">Comorbidity Alerts</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.comorbidityAlerts.map((alert, idx) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            {alert}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Diabetes Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Diabetes
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-700">HbA1c</span>
                      <span className={`text-lg font-bold ${profile.diabetes.hba1c > 7 ? 'text-orange-600' : 'text-green-600'}`}>
                        {profile.diabetes.hba1c}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-700">Last Review</span>
                      <span className="text-sm text-slate-600">{new Date(profile.diabetes.lastReview).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* CKD Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-600" />
                    Chronic Kidney Disease
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-700">eGFR</span>
                      <span className={`text-lg font-bold ${profile.ckd.egfr < 30 ? 'text-red-600' : profile.ckd.egfr < 60 ? 'text-orange-600' : 'text-green-600'}`}>
                        {profile.ckd.egfr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-700">CKD Stage</span>
                      <span className="text-sm font-bold text-slate-900">{profile.ckd.stage}</span>
                    </div>
                  </div>
                </div>

                {/* CVD Risk Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-600" />
                    CVD Risk
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-700">Framingham 10-Yr</span>
                      <span className={`text-lg font-bold ${profile.cvd.framingham10Yr > 20 ? 'text-red-600' : profile.cvd.framingham10Yr > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                        {profile.cvd.framingham10Yr}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-rose-50 rounded-lg">
                        <p className="text-xs font-semibold text-slate-600 mb-1">Total Chol</p>
                        <p className="text-sm font-bold text-slate-900">{profile.cvd.totalCholesterol}</p>
                      </div>
                      <div className="p-2 bg-rose-50 rounded-lg">
                        <p className="text-xs font-semibold text-slate-600 mb-1">HDL Chol</p>
                        <p className="text-sm font-bold text-slate-900">{profile.cvd.hdlCholesterol}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Retinopathy Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    Retinopathy Screening
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-700">Last Screening</span>
                      <span className="text-sm text-slate-600">{new Date(profile.retinopathy.lastScreening).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-semibold text-slate-700">Grade</span>
                      <span className={`text-sm font-bold ${profile.retinopathy.grade === 'none' ? 'text-green-600' : 'text-orange-600'}`}>
                        {profile.retinopathy.grade}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={syncProfile}
                disabled={syncing}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
              >
                {syncing && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Sync Profile Now
              </button>
            </div>
          )}

          {/* CVD Risk Tab */}
          {activeTab === 'cvd-risk' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Framingham CVD Risk Calculator</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <input
                  type="number"
                  placeholder="Age"
                  value={cvdForm.age}
                  onChange={(e) => setCvdForm({ ...cvdForm, age: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <select
                  value={cvdForm.gender}
                  onChange={(e) => setCvdForm({ ...cvdForm, gender: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <input
                  type="number"
                  placeholder="Systolic BP (mmHg)"
                  value={cvdForm.systolicBP}
                  onChange={(e) => setCvdForm({ ...cvdForm, systolicBP: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Total Cholesterol (mmol/L)"
                  step="0.1"
                  value={cvdForm.totalCholesterol}
                  onChange={(e) => setCvdForm({ ...cvdForm, totalCholesterol: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="HDL Cholesterol (mmol/L)"
                  step="0.1"
                  value={cvdForm.hdlCholesterol}
                  onChange={(e) => setCvdForm({ ...cvdForm, hdlCholesterol: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <label className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={cvdForm.diabetes}
                    onChange={(e) => setCvdForm({ ...cvdForm, diabetes: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">Diabetes</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={cvdForm.smoker}
                    onChange={(e) => setCvdForm({ ...cvdForm, smoker: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">Smoker</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={cvdForm.onBpMeds}
                    onChange={(e) => setCvdForm({ ...cvdForm, onBpMeds: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">On BP Meds</span>
                </label>
              </div>
              <button
                onClick={calculateCVDRisk}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
              >
                Calculate 10-Year CVD Risk
              </button>
              {cvdResult && (
                <div className={`mt-6 p-6 rounded-xl border-2 space-y-3 ${
                  cvdResult.category === 'Low risk' ? 'bg-green-50 border-green-200' :
                  cvdResult.category === 'Intermediate risk' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-3xl font-bold ${
                    cvdResult.category === 'Low risk' ? 'text-green-600' :
                    cvdResult.category === 'Intermediate risk' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {cvdResult.riskPercentage}%
                  </p>
                  <p className={`text-lg font-semibold ${
                    cvdResult.category === 'Low risk' ? 'text-green-900' :
                    cvdResult.category === 'Intermediate risk' ? 'text-yellow-900' :
                    'text-red-900'
                  }`}>
                    {cvdResult.category}
                  </p>
                  <p className="text-sm text-slate-700">{cvdResult.recommendations}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!profile && patientId && !loading && (
        <div className="text-center py-12 text-slate-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Patient not found or no NCD profile data</p>
        </div>
      )}
    </div>
  );
};

export default NcdComorbiditydashboard;
