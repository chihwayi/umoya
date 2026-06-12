import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Droplets, AlertCircle } from 'lucide-react';
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
  haemoglobin: number;
  enrollmentDate: string;
  status: string;
}

const HaematologyDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'register' | 'cdss'>('register');
  const [registerData, setRegisterData] = useState<RegisterRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Anaemia Workup form
  const [anaemiaForm, setAnaemiaForm] = useState({
    haemoglobin: '',
    mcv: '',
    mch: '',
    reticulocytes: '',
    ferritin: '',
    b12: '',
  });
  const [anaemiaResult, setAnaemiaResult] = useState<any>(null);

  // Transfusion Trigger form
  const [transfusionForm, setTransfusionForm] = useState({
    haemoglobin: '',
    symptomatic: false,
    cardiacDisease: false,
    activeBleed: false,
  });
  const [transfusionResult, setTransfusionResult] = useState<any>(null);

  // Lymphoma Staging form
  const [lymphomaForm, setLymphomaForm] = useState({
    nodeSites: {
      cervical: false,
      axillary: false,
      inguinal: false,
      paraAortic: false,
      mediastinal: false,
    },
    extranodal: false,
    bSymptoms: false,
  });
  const [lymphomaResult, setLymphomaResult] = useState<any>(null);

  const loadRegister = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/haematology/register`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setRegisterData(response.data || []);
    } catch (error) {
      console.error('Failed to load haematology register:', error);
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

  const classifyAnaemia = () => {
    const hb = parseFloat(anaemiaForm.haemoglobin) || 0;
    const mcv = parseFloat(anaemiaForm.mcv) || 0;
    const ferritin = parseFloat(anaemiaForm.ferritin) || 0;
    const b12 = parseFloat(anaemiaForm.b12) || 0;
    const retic = parseFloat(anaemiaForm.reticulocytes) || 0;

    let classification = '';
    let nextSteps = '';

    if (mcv < 80) {
      // Microcytic
      if (ferritin < 30) {
        classification = 'Iron Deficiency Anaemia';
        nextSteps = 'Start iron supplementation, investigate source of blood loss, recheck Fe studies in 6-8 weeks';
      } else {
        classification = 'Microcytic Anaemia (other)';
        nextSteps = 'Consider β-thalassaemia trait, sideroblastic anaemia, or chronic disease';
      }
    } else if (mcv > 100) {
      // Macrocytic
      if (b12 < 200) {
        classification = 'Vitamin B12 Deficiency';
        nextSteps = 'Give B12 1000µg IM weekly x 4, then monthly. Investigate pernicious anaemia vs dietary/absorption issues';
      } else {
        classification = 'Macrocytic Anaemia (other)';
        nextSteps = 'Consider folate deficiency, alcohol use, or medication effects';
      }
    } else if (retic > 3) {
      // Normal MCV with high reticulocytes
      classification = 'Haemolytic Anaemia';
      nextSteps = 'Check reticulocyte count, LDH, indirect bilirubin, haptoglobin, DAT. Consider G6PD, hereditary spherocytosis';
    } else {
      classification = 'Normocytic Normochromic Anaemia';
      nextSteps = 'Investigate bone marrow involvement, acute bleeding, or chronic disease';
    }

    setAnaemiaResult({ classification, nextSteps, hb });
  };

  const assessTransfusionTrigger = () => {
    const hb = parseFloat(transfusionForm.haemoglobin) || 0;
    let threshold = 7.0; // General threshold
    let decision = '';

    if (transfusionForm.activeBleed) {
      threshold = 8.0;
      decision = 'TRANSFUSE if Hb <8.0 g/dL. Active bleeding overrides conservative threshold.';
    } else if (transfusionForm.cardiacDisease) {
      threshold = 9.0;
      decision = 'TRANSFUSE if Hb <9.0 g/dL due to risk of cardiac events.';
    } else if (transfusionForm.symptomatic) {
      decision = 'TRANSFUSE if Hb <8.0 g/dL with symptoms (dyspnea, syncope, tachycardia).';
    } else {
      decision = 'HOLD transfusion if Hb ≥7.0 g/dL and asymptomatic. Reassess after source control.';
    }

    const shouldTransfuse = hb < threshold;

    setTransfusionResult({ shouldTransfuse, threshold, decision, hb });
  };

  const stageLymphoma = () => {
    const nodeSiteCount = Object.values(lymphomaForm.nodeSites).filter(Boolean).length;
    let stage = '';
    let modifier = lymphomaForm.bSymptoms ? 'B' : 'A';

    if (nodeSiteCount === 0 && lymphomaForm.extranodal) {
      stage = 'I (E)';
    } else if (nodeSiteCount <= 1) {
      stage = 'I';
    } else if (nodeSiteCount === 2 && !lymphomaForm.extranodal) {
      stage = 'II';
    } else if (nodeSiteCount === 2 || lymphomaForm.extranodal) {
      stage = 'III';
    } else {
      stage = 'IV';
    }

    const finalStage = `${stage} ${modifier}`;
    const description = modifier === 'B'
      ? 'Presence of B symptoms (fever, night sweats, weight loss) indicates worse prognosis'
      : 'Absence of B symptoms indicates better prognosis';

    setLymphomaResult({ stage: finalStage, description, modifier });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl shadow-sm border border-red-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Haematology Dashboard</h1>
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
          <div className="text-2xl font-bold text-red-600">{registerData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Active Patients</div>
          <div className="text-2xl font-bold text-rose-600">{registerData.filter(r => r.status === 'active').length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Low Hb (&lt;10)</div>
          <div className="text-2xl font-bold text-orange-600">{registerData.filter(r => r.haemoglobin < 10).length}</div>
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
                ? 'text-red-600 border-b-2 border-red-600'
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
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Primary Condition</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Haemoglobin (g/dL)</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Enrollment</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {registerData.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{record.patientName}</td>
                  <td className="px-4 py-3">{record.primaryCondition}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${record.haemoglobin < 10 ? 'text-red-600' : 'text-green-600'}`}>
                      {record.haemoglobin}
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
      )}

      {/* CDSS Tab */}
      {activeTab === 'cdss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Anaemia Workup */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Anaemia Workup (MCV-based)</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Haemoglobin (g/dL)"
                step="0.1"
                value={anaemiaForm.haemoglobin}
                onChange={(e) => setAnaemiaForm({ ...anaemiaForm, haemoglobin: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="MCV (fL)"
                step="0.1"
                value={anaemiaForm.mcv}
                onChange={(e) => setAnaemiaForm({ ...anaemiaForm, mcv: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="MCH (pg)"
                step="0.1"
                value={anaemiaForm.mch}
                onChange={(e) => setAnaemiaForm({ ...anaemiaForm, mch: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Reticulocytes (%)"
                step="0.1"
                value={anaemiaForm.reticulocytes}
                onChange={(e) => setAnaemiaForm({ ...anaemiaForm, reticulocytes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Ferritin (µg/L)"
                step="0.1"
                value={anaemiaForm.ferritin}
                onChange={(e) => setAnaemiaForm({ ...anaemiaForm, ferritin: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="B12 (pmol/L)"
                step="0.1"
                value={anaemiaForm.b12}
                onChange={(e) => setAnaemiaForm({ ...anaemiaForm, b12: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <button
                onClick={classifyAnaemia}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Classify Anaemia
              </button>
              {anaemiaResult && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Classification: <span className="text-red-600">{anaemiaResult.classification}</span></p>
                  <p className="text-sm text-slate-700">Hb: {anaemiaResult.hb} g/dL</p>
                  <p className="text-sm text-slate-700"><span className="font-semibold">Next Steps:</span> {anaemiaResult.nextSteps}</p>
                </div>
              )}
            </div>
          </div>

          {/* Transfusion Trigger */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Transfusion Trigger Assessment</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Haemoglobin (g/dL)"
                step="0.1"
                value={transfusionForm.haemoglobin}
                onChange={(e) => setTransfusionForm({ ...transfusionForm, haemoglobin: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={transfusionForm.symptomatic}
                  onChange={(e) => setTransfusionForm({ ...transfusionForm, symptomatic: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Symptomatic (dyspnea, syncope, tachycardia)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={transfusionForm.cardiacDisease}
                  onChange={(e) => setTransfusionForm({ ...transfusionForm, cardiacDisease: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Cardiac disease</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={transfusionForm.activeBleed}
                  onChange={(e) => setTransfusionForm({ ...transfusionForm, activeBleed: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Active bleeding</span>
              </label>
              <button
                onClick={assessTransfusionTrigger}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Assess Trigger
              </button>
              {transfusionResult && (
                <div className={`mt-4 p-4 rounded-lg ${transfusionResult.shouldTransfuse ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className={`text-sm font-semibold ${transfusionResult.shouldTransfuse ? 'text-red-900' : 'text-green-900'}`}>
                    {transfusionResult.decision}
                  </p>
                  <p className="text-xs text-slate-700 mt-2">Threshold: {transfusionResult.threshold} g/dL | Current Hb: {transfusionResult.hb} g/dL</p>
                </div>
              )}
            </div>
          </div>

          {/* Lymphoma Staging */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Lymphoma Ann Arbor Staging</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <p className="text-xs font-semibold text-slate-600 col-span-full mb-2">Node Sites Involved</p>
              {(['cervical', 'axillary', 'inguinal', 'paraAortic', 'mediastinal'] as const).map((site) => (
                <label key={site} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={lymphomaForm.nodeSites[site]}
                    onChange={(e) => setLymphomaForm({
                      ...lymphomaForm,
                      nodeSites: { ...lymphomaForm.nodeSites, [site]: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 capitalize">{site === 'paraAortic' ? 'Para-aortic' : site}</span>
                </label>
              ))}
            </div>
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={lymphomaForm.extranodal}
                  onChange={(e) => setLymphomaForm({ ...lymphomaForm, extranodal: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Extranodal disease</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={lymphomaForm.bSymptoms}
                  onChange={(e) => setLymphomaForm({ ...lymphomaForm, bSymptoms: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">B symptoms (fever, night sweats, weight loss)</span>
              </label>
              <button
                onClick={stageLymphoma}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Stage Lymphoma
              </button>
              {lymphomaResult && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-lg font-bold text-slate-900">Stage: <span className="text-red-600">{lymphomaResult.stage}</span></p>
                  <p className="text-sm text-slate-700 mt-2">{lymphomaResult.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HaematologyDashboard;
