import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Beaker, AlertCircle } from 'lucide-react';
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
  diagnosis: string;
  enrollmentDate: string;
  status: string;
}

interface EndoscopyRecord {
  id: string;
  patientName: string;
  procedureType: string;
  findings: string;
  date: string;
}

const GastroenterologyDashboard: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'register' | 'endoscopy' | 'cdss'>('register');
  const [registerData, setRegisterData] = useState<RegisterRecord[]>([]);
  const [endoscopyData, setEndoscopyData] = useState<EndoscopyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Endoscopy form
  const [endoscopyForm, setEndoscopyForm] = useState({
    patientId: '',
    procedureType: '',
    findings: '',
    complications: '',
  });

  // Rockall form
  const [rockallForm, setRockallForm] = useState({
    age: '',
    shockPresent: false,
    comorbidities: { chf: false, renalFailure: false, liverDisease: false, malignancy: false },
    endoscopicStigmata: 'none',
  });
  const [rockallResult, setRockallResult] = useState<any>(null);

  // Child-Pugh form
  const [childPughForm, setChildPughForm] = useState({
    bilirubin: '',
    albumin: '',
    ptSeconds: '',
    ascites: 'none',
    encephalopathy: 'none',
  });
  const [childPughResult, setChildPughResult] = useState<any>(null);

  const loadRegister = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/gastroenterology/register`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setRegisterData(response.data || []);
    } catch (error) {
      console.error('Failed to load gastroenterology register:', error);
      showError('Error', 'Failed to load register');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadEndoscopy = useCallback(async () => {
    setLoading(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const response = await axios.get(`${runtimeUrls.ehrApi}/gastroenterology/endoscopy`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      setEndoscopyData(response.data || []);
    } catch (error) {
      console.error('Failed to load endoscopy records:', error);
      showError('Error', 'Failed to load endoscopy records');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (activeTab === 'register') {
      loadRegister();
    } else if (activeTab === 'endoscopy') {
      loadEndoscopy();
    }
  }, [activeTab, loadRegister, loadEndoscopy]);

  const saveEndoscopyRecord = async () => {
    setSaving(true);
    try {
      const { token, tenantSlug } = auth();
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }
      const payload = {
        patientId: endoscopyForm.patientId,
        procedureType: endoscopyForm.procedureType,
        findings: endoscopyForm.findings,
        complications: endoscopyForm.complications,
      };
      await axios.post(`${runtimeUrls.ehrApi}/gastroenterology/endoscopy`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantSlug,
        },
      });
      showSuccess('Success', 'Endoscopy record saved');
      setEndoscopyForm({ patientId: '', procedureType: '', findings: '', complications: '' });
      await loadEndoscopy();
    } catch (error) {
      console.error('Failed to save endoscopy record:', error);
      showError('Error', 'Failed to save endoscopy record');
    } finally {
      setSaving(false);
    }
  };

  const calculateRockall = () => {
    const { age, shockPresent, comorbidities, endoscopicStigmata } = rockallForm;
    const ageNum = parseInt(age) || 0;
    let score = 0;

    if (ageNum >= 60) score += 1;
    if (shockPresent) score += 2;
    if (comorbidities.chf || comorbidities.renalFailure || comorbidities.liverDisease || comorbidities.malignancy) score += 2;
    if (endoscopicStigmata === 'dark spot') score += 1;
    if (endoscopicStigmata === 'adherent clot') score += 2;
    if (endoscopicStigmata === 'vessel') score += 2;
    if (endoscopicStigmata === 'active') score += 2;

    const mortalityRisk = score <= 2 ? '<1%' : score <= 4 ? '3%' : '50%';
    const recommendation = score <= 2 ? 'Low risk - outpatient management' : score <= 4 ? 'Moderate risk - admit for observation' : 'High risk - admit, intensive management';

    setRockallResult({ score, mortalityRisk, recommendation });
  };

  const calculateChildPugh = () => {
    const { bilirubin, albumin, ptSeconds, ascites, encephalopathy } = childPughForm;
    let score = 0;

    const bilirubinNum = parseFloat(bilirubin) || 0;
    if (bilirubinNum <= 34) score += 1;
    else if (bilirubinNum <= 51) score += 2;
    else score += 3;

    const albuminNum = parseFloat(albumin) || 0;
    if (albuminNum > 35) score += 1;
    else if (albuminNum > 28) score += 2;
    else score += 3;

    const ptNum = parseFloat(ptSeconds) || 0;
    if (ptNum <= 4) score += 1;
    else if (ptNum <= 6) score += 2;
    else score += 3;

    if (ascites === 'none') score += 1;
    else if (ascites === 'mild') score += 2;
    else if (ascites === 'moderate') score += 3;

    if (encephalopathy === 'none') score += 1;
    else if (encephalopathy === 'grade1-2') score += 2;
    else if (encephalopathy === 'grade3-4') score += 3;

    const cirrhosisClass = score <= 6 ? 'A' : score <= 9 ? 'B' : 'C';
    const yearSurvival = cirrhosisClass === 'A' ? '100%' : cirrhosisClass === 'B' ? '80%' : '45%';

    setChildPughResult({ score, cirrhosisClass, yearSurvival });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-sm border border-amber-200/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <Beaker className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gastroenterology Dashboard</h1>
              <p className="text-sm text-slate-600">GI procedures, patient register, clinical decision support</p>
            </div>
          </div>
          <button
            onClick={() => activeTab === 'register' ? loadRegister() : loadEndoscopy()}
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
          <div className="text-2xl font-bold text-amber-600">{registerData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Active</div>
          <div className="text-2xl font-bold text-orange-600">{registerData.filter(r => r.status === 'active').length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">Endoscopy Records</div>
          <div className="text-2xl font-bold text-blue-600">{endoscopyData.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-sm text-slate-600 font-medium">CDSS Tools</div>
          <div className="text-2xl font-bold text-purple-600">2</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['register', 'endoscopy', 'cdss'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab
                ? 'text-amber-600 border-b-2 border-amber-600'
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
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Diagnosis</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Enrollment</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {registerData.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{record.patientName}</td>
                  <td className="px-4 py-3">{record.diagnosis}</td>
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

      {/* Endoscopy Tab */}
      {activeTab === 'endoscopy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Record New Endoscopy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Patient ID"
                value={endoscopyForm.patientId}
                onChange={(e) => setEndoscopyForm({ ...endoscopyForm, patientId: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Procedure Type"
                value={endoscopyForm.procedureType}
                onChange={(e) => setEndoscopyForm({ ...endoscopyForm, procedureType: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <textarea
                placeholder="Findings"
                value={endoscopyForm.findings}
                onChange={(e) => setEndoscopyForm({ ...endoscopyForm, findings: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent col-span-1 md:col-span-2"
                rows={2}
              />
              <textarea
                placeholder="Complications (if any)"
                value={endoscopyForm.complications}
                onChange={(e) => setEndoscopyForm({ ...endoscopyForm, complications: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent col-span-1 md:col-span-2"
                rows={2}
              />
              <button
                onClick={saveEndoscopyRecord}
                disabled={saving}
                className="md:col-span-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Save Endoscopy Record
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Procedure Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Findings</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {endoscopyData.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{record.patientName}</td>
                    <td className="px-4 py-3">{record.procedureType}</td>
                    <td className="px-4 py-3 text-slate-600">{record.findings}</td>
                    <td className="px-4 py-3">{fmt(record.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {endoscopyData.length === 0 && (
              <div className="text-center py-8 text-slate-500">No endoscopy records</div>
            )}
          </div>
        </div>
      )}

      {/* CDSS Tab */}
      {activeTab === 'cdss' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rockall Score */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Rockall Score (Upper GI Bleed Risk)</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Age"
                value={rockallForm.age}
                onChange={(e) => setRockallForm({ ...rockallForm, age: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rockallForm.shockPresent}
                  onChange={(e) => setRockallForm({ ...rockallForm, shockPresent: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">Shock present</span>
              </label>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Comorbidities</p>
                {(['chf', 'renalFailure', 'liverDisease', 'malignancy'] as const).map((comorb) => (
                  <label key={comorb} className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={rockallForm.comorbidities[comorb]}
                      onChange={(e) => setRockallForm({
                        ...rockallForm,
                        comorbidities: { ...rockallForm.comorbidities, [comorb]: e.target.checked }
                      })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 capitalize">{comorb === 'chf' ? 'CHF' : comorb === 'renalFailure' ? 'Renal Failure' : comorb === 'liverDisease' ? 'Liver Disease' : 'Malignancy'}</span>
                  </label>
                ))}
              </div>
              <select
                value={rockallForm.endoscopicStigmata}
                onChange={(e) => setRockallForm({ ...rockallForm, endoscopicStigmata: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="none">Endoscopic Stigmata: None</option>
                <option value="dark spot">Dark spot</option>
                <option value="adherent clot">Adherent clot</option>
                <option value="vessel">Visible vessel</option>
                <option value="active">Active bleeding</option>
              </select>
              <button
                onClick={calculateRockall}
                className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold"
              >
                Calculate Rockall Score
              </button>
              {rockallResult && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">Score: <span className="text-amber-600">{rockallResult.score}</span></p>
                  <p className="text-sm text-slate-700">Mortality Risk: <span className="font-semibold">{rockallResult.mortalityRisk}</span></p>
                  <p className="text-sm text-slate-700 mt-2">{rockallResult.recommendation}</p>
                </div>
              )}
            </div>
          </div>

          {/* Child-Pugh Score */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Child-Pugh Score (Cirrhosis)</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Bilirubin (µmol/L)"
                value={childPughForm.bilirubin}
                onChange={(e) => setChildPughForm({ ...childPughForm, bilirubin: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Albumin (g/L)"
                value={childPughForm.albumin}
                onChange={(e) => setChildPughForm({ ...childPughForm, albumin: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="PT seconds"
                value={childPughForm.ptSeconds}
                onChange={(e) => setChildPughForm({ ...childPughForm, ptSeconds: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <select
                value={childPughForm.ascites}
                onChange={(e) => setChildPughForm({ ...childPughForm, ascites: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="none">Ascites: None</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
              </select>
              <select
                value={childPughForm.encephalopathy}
                onChange={(e) => setChildPughForm({ ...childPughForm, encephalopathy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="none">Encephalopathy: None</option>
                <option value="grade1-2">Grade 1-2</option>
                <option value="grade3-4">Grade 3-4</option>
              </select>
              <button
                onClick={calculateChildPugh}
                className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold"
              >
                Calculate Child-Pugh Score
              </button>
              {childPughResult && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">Score: <span className="text-amber-600">{childPughResult.score}</span></p>
                  <p className="text-sm text-slate-700">Class: <span className="font-semibold text-lg text-amber-600">{childPughResult.cirrhosisClass}</span></p>
                  <p className="text-sm text-slate-700 mt-2">1-Year Survival: <span className="font-semibold">{childPughResult.yearSurvival}</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GastroenterologyDashboard;
