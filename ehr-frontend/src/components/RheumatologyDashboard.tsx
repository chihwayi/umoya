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
  primaryDiagnosis: string;
  enrollmentDate: string;
  careStatus: string;
}

interface AssessmentRecord {
  id: string;
  patientName: string;
  das28Score: number;
  cdai: number;
  assessmentDate: string;
  diseaseActivityCategory: string;
}

interface DMARDRecord {
  id: string;
  patientName: string;
  drugName: string;
  startDate: string;
  status: string;
  reasonStopped?: string;
}

const RheumatologyDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'register' | 'assessments' | 'dmards' | 'cdss'>('register');
  const [registerData, setRegisterData] = useState<RegisterRecord[]>([]);
  const [assessmentData, setAssessmentData] = useState<AssessmentRecord[]>([]);
  const [dmardData, setDmardData] = useState<DMARDRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Assessment form
  const [assessmentForm, setAssessmentForm] = useState({
    patientId: '',
    swollenJoints28: '',
    tenderJoints28: '',
    esr: '',
    patientGlobalAssessment: '',
    drGlobalAssessment: '',
  });
  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  // DMARD form
  const [dmardForm, setDmardForm] = useState({
    patientId: '',
    drugName: '',
    startDate: '',
    indication: '',
  });

  // Treat-to-Target form
  const [treatmentForm, setTreatmentForm] = useState({
    das28Score: '',
    sdai: '',
    treatmentLine: 'first',
  });
  const [treatmentResult, setTreatmentResult] = useState<any>(null);

  // Gout Protocol form
  const [goutForm, setGoutForm] = useState({
    uricAcid: '',
    goutAttack: false,
    kidneyDisease: false,
  });
  const [goutResult, setGoutResult] = useState<any>(null);

  // Biologic Pre-Screen form
  const [biologicForm, setBiologicForm] = useState({
    tbScreeningDone: false,
    quantiferonResult: 'negative',
    chestXrayDate: '',
  });
  const [biologicResult, setBiologicResult] = useState<any>(null);

  const loadRegister = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/rheumatology/register`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setRegisterData(response.data || []);
    } catch (error) {
      console.error('Failed to load rheumatology register:', error);
      showError('Error', 'Failed to load register');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/rheumatology/assessments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setAssessmentData(response.data || []);
    } catch (error) {
      console.error('Failed to load assessments:', error);
      showError('Error', 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadDMARDs = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/rheumatology/dmards`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setDmardData(response.data || []);
    } catch (error) {
      console.error('Failed to load DMARDs:', error);
      showError('Error', 'Failed to load DMARDs');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (activeTab === 'register') {
      loadRegister();
    } else if (activeTab === 'assessments') {
      loadAssessments();
    } else if (activeTab === 'dmards') {
      loadDMARDs();
    }
  }, [activeTab, loadRegister, loadAssessments, loadDMARDs]);

  const saveAssessment = async () => {
    setSaving(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const swollenJoints = parseInt(assessmentForm.swollenJoints28) || 0;
      const tenderJoints = parseInt(assessmentForm.tenderJoints28) || 0;
      const esr = parseFloat(assessmentForm.esr) || 0;
      const patientGlobal = parseFloat(assessmentForm.patientGlobalAssessment) || 0;
      const drGlobal = parseFloat(assessmentForm.drGlobalAssessment) || 0;

      const das28 = 0.56 * Math.sqrt(tenderJoints) + 0.28 * Math.sqrt(swollenJoints) + 0.70 * Math.log(esr) + 0.014 * patientGlobal;

      const payload = {
        patientId: assessmentForm.patientId,
        swollenJoints28: swollenJoints,
        tenderJoints28: tenderJoints,
        esr: esr,
        patientGlobalAssessment: patientGlobal,
        drGlobalAssessment: drGlobal,
        das28Score: parseFloat(das28.toFixed(2)),
      };
      await axios.post(`${runtimeUrls.ehrApi}/rheumatology/assessments`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      showSuccess('Success', 'Assessment recorded');
      setAssessmentForm({
        patientId: '',
        swollenJoints28: '',
        tenderJoints28: '',
        esr: '',
        patientGlobalAssessment: '',
        drGlobalAssessment: '',
      });
      setAssessmentResult({ das28: parseFloat(das28.toFixed(2)) });
      await loadAssessments();
    } catch (error) {
      console.error('Failed to save assessment:', error);
      showError('Error', 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const saveDMARD = async () => {
    setSaving(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const payload = {
        patientId: dmardForm.patientId,
        drugName: dmardForm.drugName,
        startDate: dmardForm.startDate,
        indication: dmardForm.indication,
      };
      await axios.post(`${runtimeUrls.ehrApi}/rheumatology/dmards`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      showSuccess('Success', 'DMARD recorded');
      setDmardForm({ patientId: '', drugName: '', startDate: '', indication: '' });
      await loadDMARDs();
    } catch (error) {
      console.error('Failed to save DMARD:', error);
      showError('Error', 'Failed to save DMARD');
    } finally {
      setSaving(false);
    }
  };

  const getTreatmentStrategy = () => {
    const das28 = parseFloat(treatmentForm.das28Score) || 0;
    let recommendation = '';
    const line = treatmentForm.treatmentLine;

    if (das28 > 5.1) {
      recommendation = line === 'first' ? 'Start first-line DMARD (MTX)' : line === 'second' ? 'Escalate to biologic or TNF inhibitor' : 'Consider combination biologic therapy';
    } else if (das28 > 3.2) {
      recommendation = line === 'first' ? 'Optimize MTX dose or add second DMARD' : 'Consider biologic therapy';
    } else {
      recommendation = 'Continue current regimen, monitor closely';
    }

    setTreatmentResult({ recommendation, line });
  };

  const getGoutProtocol = () => {
    const uricAcid = parseFloat(goutForm.uricAcid) || 0;
    const guidance = goutForm.goutAttack
      ? 'Acute: NSAIDs or colchicine 0.5mg daily; prevent with allopurinol 50-100mg daily'
      : uricAcid > 6.8
      ? 'Target <6 mg/dL: Allopurinol 50mg daily, titrate by 50mg monthly'
      : 'Continue xanthine oxidase inhibitor; reassess in 3 months';

    if (goutForm.kidneyDisease) {
      const note = 'Reduce allopurinol dose; consider febuxostat 40-80mg daily';
      setGoutResult({ guidance: `${guidance}. ${note}` });
    } else {
      setGoutResult({ guidance });
    }
  };

  const checkBiologicSafety = () => {
    const safe = !biologicForm.tbScreeningDone || biologicForm.quantiferonResult === 'negative';
    const recommendation = safe
      ? 'Safe to start biologic therapy; ensure INH prophylaxis if CXR+ or QFT indeterminate'
      : 'DO NOT START biologic until TB treatment completed. High risk of TB reactivation.';

    setBiologicResult({ safe, recommendation });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl shadow-sm border border-purple-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Rheumatology Dashboard</h1>
              <p className="text-sm text-slate-600">Patient register, assessments, DMARDs, and clinical decision support</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'register') loadRegister();
              else if (activeTab === 'assessments') loadAssessments();
              else if (activeTab === 'dmards') loadDMARDs();
            }}
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
          <div className="text-2xl font-bold text-purple-600">{registerData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Recent Assessments</div>
          <div className="text-2xl font-bold text-violet-600">{assessmentData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">On DMARDs</div>
          <div className="text-2xl font-bold text-indigo-600">{dmardData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">CDSS Tools</div>
          <div className="text-2xl font-bold text-pink-600">3</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {(['register', 'assessments', 'dmards', 'cdss'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'text-purple-600 border-b-2 border-purple-600'
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
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Primary Diagnosis</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Enrollment</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Care Status</th>
              </tr>
            </thead>
            <tbody>
              {registerData.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{record.patientName}</td>
                  <td className="px-4 py-3">{record.primaryDiagnosis}</td>
                  <td className="px-4 py-3">{fmt(record.enrollmentDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                      record.careStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {record.careStatus}
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
      )}

      {/* Assessments Tab */}
      {activeTab === 'assessments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Record New Assessment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Patient ID"
                value={assessmentForm.patientId}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, patientId: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Swollen Joints (28)"
                value={assessmentForm.swollenJoints28}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, swollenJoints28: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Tender Joints (28)"
                value={assessmentForm.tenderJoints28}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, tenderJoints28: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="ESR (mm/h)"
                value={assessmentForm.esr}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, esr: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Patient Global Assessment (0-100)"
                value={assessmentForm.patientGlobalAssessment}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, patientGlobalAssessment: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Dr Global Assessment (0-100)"
                value={assessmentForm.drGlobalAssessment}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, drGlobalAssessment: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={saveAssessment}
                disabled={saving}
                className="md:col-span-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Record Assessment & Calculate DAS28
              </button>
              {assessmentResult && (
                <div className="md:col-span-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">DAS28 Score: <span className="text-purple-600">{assessmentResult.das28}</span></p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">DAS28 Score</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">CDAI</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Activity</th>
                </tr>
              </thead>
              <tbody>
                {assessmentData.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{record.patientName}</td>
                    <td className="px-4 py-3 font-semibold">{record.das28Score}</td>
                    <td className="px-4 py-3">{record.cdai}</td>
                    <td className="px-4 py-3">{fmt(record.assessmentDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        record.diseaseActivityCategory === 'low' ? 'bg-green-100 text-green-800' :
                        record.diseaseActivityCategory === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.diseaseActivityCategory}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assessmentData.length === 0 && (
              <div className="text-center py-8 text-slate-500">No assessments recorded</div>
            )}
          </div>
        </div>
      )}

      {/* DMARDs Tab */}
      {activeTab === 'dmards' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add DMARD
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Patient ID"
                value={dmardForm.patientId}
                onChange={(e) => setDmardForm({ ...dmardForm, patientId: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Drug Name"
                value={dmardForm.drugName}
                onChange={(e) => setDmardForm({ ...dmardForm, drugName: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="date"
                value={dmardForm.startDate}
                onChange={(e) => setDmardForm({ ...dmardForm, startDate: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Indication"
                value={dmardForm.indication}
                onChange={(e) => setDmardForm({ ...dmardForm, indication: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={saveDMARD}
                disabled={saving}
                className="md:col-span-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Save DMARD
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Drug Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Start Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Reason Stopped</th>
                </tr>
              </thead>
              <tbody>
                {dmardData.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{record.patientName}</td>
                    <td className="px-4 py-3">{record.drugName}</td>
                    <td className="px-4 py-3">{fmt(record.startDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        record.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.reasonStopped || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dmardData.length === 0 && (
              <div className="text-center py-8 text-slate-500">No DMARDs recorded</div>
            )}
          </div>
        </div>
      )}

      {/* CDSS Tab */}
      {activeTab === 'cdss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Treat-to-Target */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Treat-to-Target Strategy</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="DAS28 Score"
                step="0.1"
                value={treatmentForm.das28Score}
                onChange={(e) => setTreatmentForm({ ...treatmentForm, das28Score: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="SDAI"
                step="0.1"
                value={treatmentForm.sdai}
                onChange={(e) => setTreatmentForm({ ...treatmentForm, sdai: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <select
                value={treatmentForm.treatmentLine}
                onChange={(e) => setTreatmentForm({ ...treatmentForm, treatmentLine: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="first">Treatment Line: First</option>
                <option value="second">Treatment Line: Second</option>
                <option value="third">Treatment Line: Third</option>
              </select>
              <button
                onClick={getTreatmentStrategy}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
              >
                Get Strategy
              </button>
              {treatmentResult && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-slate-900">{treatmentResult.recommendation}</p>
                </div>
              )}
            </div>
          </div>

          {/* Gout Protocol */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Gout Protocol</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Uric Acid (mg/dL)"
                step="0.1"
                value={goutForm.uricAcid}
                onChange={(e) => setGoutForm({ ...goutForm, uricAcid: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={goutForm.goutAttack}
                  onChange={(e) => setGoutForm({ ...goutForm, goutAttack: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Acute gout attack</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={goutForm.kidneyDisease}
                  onChange={(e) => setGoutForm({ ...goutForm, kidneyDisease: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Kidney disease</span>
              </label>
              <button
                onClick={getGoutProtocol}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
              >
                Get Protocol
              </button>
              {goutResult && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-slate-900">{goutResult.guidance}</p>
                </div>
              )}
            </div>
          </div>

          {/* Biologic Pre-Screen */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Biologic Pre-Screen (TB)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={biologicForm.tbScreeningDone}
                  onChange={(e) => setBiologicForm({ ...biologicForm, tbScreeningDone: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">TB screening done</span>
              </label>
              <select
                value={biologicForm.quantiferonResult}
                onChange={(e) => setBiologicForm({ ...biologicForm, quantiferonResult: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="negative">Quantiferon: Negative</option>
                <option value="positive">Quantiferon: Positive</option>
                <option value="indeterminate">Quantiferon: Indeterminate</option>
              </select>
              <input
                type="date"
                placeholder="Chest X-ray Date"
                value={biologicForm.chestXrayDate}
                onChange={(e) => setBiologicForm({ ...biologicForm, chestXrayDate: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={checkBiologicSafety}
                className="md:col-span-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
              >
                Check Biologic Safety
              </button>
              {biologicResult && (
                <div className={`md:col-span-3 p-4 rounded-lg ${biologicResult.safe ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-sm font-semibold ${biologicResult.safe ? 'text-green-900' : 'text-red-900'}`}>
                    {biologicResult.recommendation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RheumatologyDashboard;
