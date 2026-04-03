import React, { useState, useEffect } from 'react';
import { X, Heart, Wind, AlertTriangle, Activity, FileText, BookOpen, Search, Loader2, Sparkles } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import ICD10Picker from './ICD10Picker';
import { cdssApi, ehrAxios } from '../services/api';
import { GuidelineSearchPanel } from './GuidelineSearchPanel';

interface PreAnesthesiaAssessmentModalProps {
  surgicalCase: any;
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PreAnesthesiaAssessmentModal: React.FC<PreAnesthesiaAssessmentModalProps> = ({
  surgicalCase,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [comorbidities, setComorbidities] = useState<Array<{ code: string; description: string }>>([]);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

  const [formData, setFormData] = useState({
    surgicalCaseId: surgicalCase.id || surgicalCase.caseid,
    patientId: surgicalCase.patient_id || surgicalCase.patientid,
    asaStatus: '',
    asaModifier: '',
    mallampatiScore: null as number | null,
    mouthOpening: '',
    neckMobility: '',
    airwayRisk: 'low',
    cardiacHistory: '',
    cardiacExamFindings: '',
    respiratoryHistory: '',
    respiratoryExamFindings: '',
    hemoglobin: '',
    plateletCount: '',
    inr: '',
    creatinine: '',
    glucose: '',
    drugAllergies: [] as any[],
    currentMedications: [] as any[],
    lastOralIntake: '',
    npoStatus: false,
    plannedAnesthesiaType: 'general',
    plannedAirway: 'ETT',
    specialConsiderations: '',
    anesthesiaRisk: 'low',
    riskFactors: '',
    notes: '',
  });

  const handleAddComorbidity = (code: string, description: string) => {
    if (!comorbidities.find(c => c.code === code)) {
      setComorbidities([...comorbidities, { code, description }]);
    }
  };

  const handleRemoveComorbidity = (code: string) => {
    setComorbidities(comorbidities.filter(c => c.code !== code));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.asaStatus) {
      showError('Error', 'Please select ASA Physical Status');
      return;
    }

    try {
      setLoading(true);

      const assessmentData = {
        ...formData,
        comorbidities,
        hemoglobin: formData.hemoglobin ? parseFloat(formData.hemoglobin) : null,
        plateletCount: formData.plateletCount ? parseInt(formData.plateletCount) : null,
        inr: formData.inr ? parseFloat(formData.inr) : null,
        creatinine: formData.creatinine ? parseFloat(formData.creatinine) : null,
        glucose: formData.glucose ? parseInt(formData.glucose) : null,
      };

      await ehrAxios.post('/anesthesia/pre-assessment', assessmentData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Pre-anesthesia assessment saved');
      onSuccess();
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to save assessment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Pre-Anesthesia Assessment
              </h2>
              <p className="text-purple-100 mt-1">
                {surgicalCase.patient_first_name} {surgicalCase.patient_last_name} - {surgicalCase.procedure_name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* AI Guideline Search */}
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    AI Clinical Guidelines & Protocols
                  </h3>
                <button
                  onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {showGuidelineSearch ? 'Hide Search' : 'Search Guidelines'}
                </button>
              </div>

              {showGuidelineSearch && (
                <GuidelineSearchPanel
                  searchFn={(q) => cdssApi.searchGuidelines(q, token, tenantSlug)}
                  contextLabel="Anesthesia"
                />
              )}
            </div>

            {/* ASA Physical Status */}
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <h3 className="font-bold text-slate-900 mb-3">ASA Physical Status Classification</h3>
              <div className="space-y-2">
                {[
                  { value: 'I', label: 'ASA I - Normal healthy patient' },
                  { value: 'II', label: 'ASA II - Mild systemic disease' },
                  { value: 'III', label: 'ASA III - Severe systemic disease' },
                  { value: 'IV', label: 'ASA IV - Constant threat to life' },
                  { value: 'V', label: 'ASA V - Moribund patient' },
                  { value: 'VI', label: 'ASA VI - Brain dead (organ donor)' },
                ].map((asa) => (
                  <label key={asa.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="asaStatus"
                      value={asa.value}
                      checked={formData.asaStatus === asa.value}
                      onChange={(e) => setFormData({ ...formData, asaStatus: e.target.value })}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-slate-700">{asa.label}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={formData.asaModifier === 'E'}
                    onChange={(e) => setFormData({ ...formData, asaModifier: e.target.checked ? 'E' : '' })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-slate-700 font-semibold">E - Emergency Modifier</span>
                </label>
              </div>
            </div>

            {/* Airway Assessment */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Wind className="w-5 h-5 text-purple-600" />
                Airway Assessment
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mallampati Score
                  </label>
                  <select
                    value={formData.mallampatiScore || ''}
                    onChange={(e) => setFormData({ ...formData, mallampatiScore: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select...</option>
                    <option value="1">Class I</option>
                    <option value="2">Class II</option>
                    <option value="3">Class III</option>
                    <option value="4">Class IV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mouth Opening
                  </label>
                  <input
                    type="text"
                    value={formData.mouthOpening}
                    onChange={(e) => setFormData({ ...formData, mouthOpening: e.target.value })}
                    placeholder="e.g., >3 finger breadths"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Airway Risk
                  </label>
                  <select
                    value={formData.airwayRisk}
                    onChange={(e) => setFormData({ ...formData, airwayRisk: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="low">🟢 Low</option>
                    <option value="moderate">🟡 Moderate</option>
                    <option value="high">🔴 High</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Comorbidities (ICD-10) */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3">Comorbidities (ICD-10)</h3>
              <ICD10Picker
                value=""
                onChange={handleAddComorbidity}
                token={token}
                tenantSlug={tenantSlug}
                label="Add Comorbidity"
                placeholder="Search: hypertension, diabetes, COPD..."
              />
              <div className="mt-3 space-y-2">
                {comorbidities.map((comorbidity) => (
                  <div key={comorbidity.code} className="flex items-center justify-between bg-slate-100 rounded-lg p-3">
                    <div>
                      <span className="font-semibold text-slate-900">{comorbidity.description}</span>
                      <span className="ml-2 text-sm text-slate-600">({comorbidity.code})</span>
                    </div>
                    <button
                      onClick={() => handleRemoveComorbidity(comorbidity.code)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cardiovascular */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-600" />
                Cardiovascular Review
              </h3>
              <div className="space-y-3">
                <textarea
                  value={formData.cardiacHistory}
                  onChange={(e) => setFormData({ ...formData, cardiacHistory: e.target.value })}
                  placeholder="Cardiac history..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
                <textarea
                  value={formData.cardiacExamFindings}
                  onChange={(e) => setFormData({ ...formData, cardiacExamFindings: e.target.value })}
                  placeholder="Cardiac exam findings..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Respiratory */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Wind className="w-5 h-5 text-blue-600" />
                Respiratory Review
              </h3>
              <div className="space-y-3">
                <textarea
                  value={formData.respiratoryHistory}
                  onChange={(e) => setFormData({ ...formData, respiratoryHistory: e.target.value })}
                  placeholder="Respiratory history..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
                <textarea
                  value={formData.respiratoryExamFindings}
                  onChange={(e) => setFormData({ ...formData, respiratoryExamFindings: e.target.value })}
                  placeholder="Respiratory exam findings..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Lab Values */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3">Recent Lab Values</h3>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hgb (g/dL)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.hemoglobin}
                    onChange={(e) => setFormData({ ...formData, hemoglobin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Platelets
                  </label>
                  <input
                    type="number"
                    value={formData.plateletCount}
                    onChange={(e) => setFormData({ ...formData, plateletCount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    INR
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.inr}
                    onChange={(e) => setFormData({ ...formData, inr: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Creatinine
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.creatinine}
                    onChange={(e) => setFormData({ ...formData, creatinine: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Glucose
                  </label>
                  <input
                    type="number"
                    value={formData.glucose}
                    onChange={(e) => setFormData({ ...formData, glucose: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Anesthesia Plan */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3">Anesthesia Plan</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Planned Anesthesia Type
                  </label>
                  <select
                    value={formData.plannedAnesthesiaType}
                    onChange={(e) => setFormData({ ...formData, plannedAnesthesiaType: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="general">General</option>
                    <option value="regional">Regional</option>
                    <option value="spinal">Spinal</option>
                    <option value="epidural">Epidural</option>
                    <option value="MAC">MAC (Monitored Anesthesia Care)</option>
                    <option value="local">Local</option>
                    <option value="combined">Combined</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Planned Airway
                  </label>
                  <select
                    value={formData.plannedAirway}
                    onChange={(e) => setFormData({ ...formData, plannedAirway: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ETT">ETT (Endotracheal Tube)</option>
                    <option value="LMA">LMA (Laryngeal Mask Airway)</option>
                    <option value="spontaneous">Spontaneous</option>
                    <option value="mask">Mask</option>
                    <option value="nasal_cannula">Nasal Cannula</option>
                  </select>
                </div>
              </div>
            </div>

            {/* NPO Status */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.npoStatus}
                  onChange={(e) => setFormData({ ...formData, npoStatus: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <div>
                  <span className="font-semibold text-slate-900">NPO Status Confirmed</span>
                  <p className="text-sm text-slate-600">Patient is NPO (nothing by mouth) per protocol</p>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional assessment notes..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Save Assessment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreAnesthesiaAssessmentModal;

