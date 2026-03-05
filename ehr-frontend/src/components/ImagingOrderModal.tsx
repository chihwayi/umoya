import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Camera, AlertCircle, CreditCard, Brain, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';
import {
  buildSharedContextTags,
  getImagingOrderDuplicateGuard,
  getImagingOrderPrefill,
} from '../services/doctorContextAdapter';

interface Modality {
  id: string;
  modality_code: string;
  modality_name: string;
  study_type_count: number;
}

interface StudyType {
  id: string;
  study_code: string;
  study_name: string;
  modality_name: string;
  body_part: string;
  cost: number;
  preparation_instructions?: string;
  contrast_required: boolean;
}

interface ImagingOrderModalProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
  orderingProviderId: string;
}

export default function ImagingOrderModal({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
  onSuccess,
  orderingProviderId,
}: ImagingOrderModalProps) {
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [selectedModality, setSelectedModality] = useState<string>('');
  const [studyTypes, setStudyTypes] = useState<StudyType[]>([]);
  const [selectedStudyType, setSelectedStudyType] = useState<StudyType | null>(null);
  const [studySearchTerm, setStudySearchTerm] = useState('');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [suspectedDiagnosis, setSuspectedDiagnosis] = useState('');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [loading, setLoading] = useState(false);
  const [orderConcept, setOrderConcept] = useState<SnomedConcept | null>(null);
  const [cdssInsights, setCdssInsights] = useState<any | null>(null);
  const [selectedPatientContext, setSelectedPatientContext] = useState<any>(null);
  const [loadingPatientContext, setLoadingPatientContext] = useState(false);
  const { showSuccess, showError } = useNotification();

  const applyContextPrefill = useCallback((context: any) => {
    const prefill = getImagingOrderPrefill(context);
    setPriority((prev) => (prev === 'routine' && prefill.priority ? prefill.priority : prev));
    setClinicalIndication((prev) => prev || prefill.clinicalIndication || '');
    setClinicalHistory((prev) => prev || prefill.clinicalHistory || '');
    setSuspectedDiagnosis((prev) => prev || prefill.suspectedDiagnosis || '');
    if (prefill.clinicalHistory || prefill.suspectedDiagnosis) {
      setShowAdvancedDetails(true);
    }
  }, []);

  const loadModalities = useCallback(async () => {
    try {
      const response = await ehrApi.getImagingModalities(tenantSlug, token);
      const nextModalities = response.data.modalities || [];
      setModalities(nextModalities);
    } catch (error) {
      console.error('Failed to load modalities:', error);
      showError('Failed to load imaging modalities', 'An error occurred while loading imaging modalities');
    }
  }, [showError, tenantSlug, token]);

  const loadStudyTypes = useCallback(async (modalityCode: string) => {
    try {
      const response = await ehrApi.getImagingStudyTypes(tenantSlug, token, modalityCode);
      const nextStudies = response.data.studyTypes || [];
      setStudyTypes(nextStudies);
      setStudySearchTerm('');
      const preferredStudyName = String(
        selectedPatientContext?.modules?.imaging?.latestReport?.study_name || '',
      )
        .trim()
        .toLowerCase();
      const preferredStudy = nextStudies.find(
        (study: StudyType) =>
          preferredStudyName &&
          study.study_name.toLowerCase() === preferredStudyName,
      );
      if (preferredStudy) {
        setSelectedStudyType(preferredStudy);
        return;
      }
      if (nextStudies.length === 1) {
        setSelectedStudyType(nextStudies[0]);
      }
    } catch (error) {
      console.error('Failed to load study types:', error);
      showError('Failed to load study types', 'An error occurred while loading study types');
    }
  }, [selectedPatientContext, showError, tenantSlug, token]);

  const loadSelectedPatientContext = useCallback(async () => {
    if (!patientId || !token || !tenantSlug) return;
    try {
      setLoadingPatientContext(true);
      const response = await ehrApi.getPatientContext(patientId, token, tenantSlug);
      const context = response.data || null;
      setSelectedPatientContext(context);
      applyContextPrefill(context);
    } catch (error) {
      console.error('Failed to load shared patient context for imaging order', error);
      setSelectedPatientContext(null);
    } finally {
      setLoadingPatientContext(false);
    }
  }, [applyContextPrefill, patientId, tenantSlug, token]);

  useEffect(() => {
    void loadModalities();
  }, [loadModalities]);

  useEffect(() => {
    if (!selectedModality) return;
    void loadStudyTypes(selectedModality);
  }, [loadStudyTypes, selectedModality]);

  useEffect(() => {
    if (selectedModality || modalities.length === 0) return;

    const preferredModalityName = String(
      selectedPatientContext?.modules?.imaging?.latestReport?.modality_name || '',
    )
      .trim()
      .toLowerCase();
    const preferredModality = modalities.find(
      (modality) =>
        preferredModalityName &&
        modality.modality_name.toLowerCase().includes(preferredModalityName),
    );

    if (preferredModality) {
      setSelectedModality(preferredModality.modality_code);
      return;
    }

    if (modalities.length === 1) {
      setSelectedModality(modalities[0].modality_code);
    }
  }, [modalities, selectedModality, selectedPatientContext]);

  useEffect(() => {
    void loadSelectedPatientContext();
  }, [loadSelectedPatientContext]);

  const selectedPatientContextTags = useMemo(
    () => buildSharedContextTags(selectedPatientContext),
    [selectedPatientContext],
  );

  const filteredStudyTypes = useMemo(() => {
    const term = studySearchTerm.trim().toLowerCase();
    if (!term) return studyTypes;
    return studyTypes.filter((study) => {
      return (
        study.study_name.toLowerCase().includes(term) ||
        study.study_code.toLowerCase().includes(term) ||
        study.body_part.toLowerCase().includes(term)
      );
    });
  }, [studySearchTerm, studyTypes]);

  const indicationSuggestions = useMemo(() => {
    const candidates = [
      selectedPatientContext?.modules?.ed?.latestVisit?.chief_complaint,
      selectedPatientContext?.modules?.cardiology?.latestEncounter?.visit_reason,
      selectedPatientContext?.modules?.imaging?.latestReport?.clinical_indication,
      selectedPatientContext?.modules?.imaging?.latestReport?.impression,
      selectedStudyType?.body_part ? `Focused ${selectedStudyType.body_part} evaluation` : null,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const unique = candidates.filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, 4);
  }, [selectedPatientContext, selectedStudyType]);

  const workflowSteps = useMemo(
    () => [
      { label: 'Modality', done: Boolean(selectedModality) },
      { label: 'Study', done: Boolean(selectedStudyType) },
      { label: 'Indication', done: Boolean(clinicalIndication.trim()) },
      { label: 'SNOMED', done: Boolean(orderConcept) },
    ],
    [clinicalIndication, orderConcept, selectedModality, selectedStudyType],
  );

  const canSubmit =
    Boolean(selectedStudyType) &&
    Boolean(clinicalIndication.trim()) &&
    Boolean(orderConcept) &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudyType) {
      showError('Please select an imaging study', 'An imaging study must be selected to proceed');
      return;
    }

    if (!clinicalIndication.trim()) {
      showError('Please provide clinical indication', 'Clinical indication is required for this imaging order');
      return;
    }

    if (!orderConcept) {
      showError('SNOMED Required', 'Please select the SNOMED CT concept for this imaging order.');
      return;
    }

    const duplicatePrompt = getImagingOrderDuplicateGuard(selectedPatientContext, {
      studyName: selectedStudyType.study_name,
      clinicalIndication,
      suspectedDiagnosis,
    });
    if (duplicatePrompt) {
      const shouldProceed = window.confirm(duplicatePrompt.message);
      if (!shouldProceed) {
        return;
      }
    }

    try {
      setLoading(true);

      const response = await ehrApi.createImagingOrder(tenantSlug, token, {
        patient_id: patientId,
        study_type_id: selectedStudyType.id,
        ordering_provider: orderingProviderId,
        clinical_indication: clinicalIndication,
        clinical_history: clinicalHistory,
        suspected_diagnosis: suspectedDiagnosis,
        priority,
        snomedConceptId: orderConcept.conceptId,
        snomedTerm: orderConcept.preferredTerm || orderConcept.term,
        snomedModuleId: orderConcept.moduleId,
        snomedDefinitionStatus: orderConcept.definitionStatus,
      });
      const insights = response.data?.cdssInsights ?? response.data?.cdss_insights ?? null;

      const costMessage =
        selectedStudyType.cost != null && Number(selectedStudyType.cost) > 0
          ? ` Please send the patient to Accounts to confirm payment of $${Number(selectedStudyType.cost).toFixed(
              2,
            )}.`
          : '';
      showSuccess(`${selectedStudyType.study_name} order placed.${costMessage}`, '');
      onSuccess?.();
      setCdssInsights(insights);
      if (!insights) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to create imaging order:', error);
      showError('Failed to create imaging order', 'An error occurred while processing your request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Order Medical Imaging</h2>
              <p className="text-purple-100 mt-1">Patient: {patientName}</p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-purple-800 rounded-lg p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              {workflowSteps.map((step) => (
                <span
                  key={step.label}
                  className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${
                    step.done
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          {(loadingPatientContext || selectedPatientContextTags.length > 0) && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Shared patient context
              </p>
              {loadingPatientContext ? (
                <p className="mt-2 text-xs text-indigo-600">Loading reusable context...</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedPatientContextTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-[11px] rounded-full bg-white border border-indigo-200 text-indigo-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {cdssInsights && (
            <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">CDSS Guidance</p>
                  <p className="text-xs text-slate-500">
                    Suggested follow-ups based on the selected imaging study.
                  </p>
                </div>
              </div>
              {Array.isArray(cdssInsights?.guidelines?.recommendations) && cdssInsights.guidelines.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Guideline Recommendations</p>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                    {cdssInsights.guidelines.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                      <li key={`img-guideline-${idx}`}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(cdssInsights?.careGaps?.gaps) && cdssInsights.careGaps.gaps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-600 mb-1">Potential Care Gaps</p>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                    {cdssInsights.careGaps.gaps.slice(0, 3).map((gap: any, idx: number) => (
                      <li key={`img-gap-${idx}`}>{gap?.description || gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Modality Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Imaging Modality <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {modalities.map((modality) => (
                <button
                  key={modality.id}
                  type="button"
                  onClick={() => {
                    setSelectedModality(modality.modality_code);
                    setSelectedStudyType(null);
                    setOrderConcept(null);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    selectedModality === modality.modality_code
                      ? 'border-purple-600 bg-purple-50 shadow-md'
                      : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
                  }`}
                >
                  <Camera className={`w-8 h-8 mx-auto mb-2 ${
                    selectedModality === modality.modality_code ? 'text-purple-600' : 'text-gray-600'
                  }`} />
                  <p className="font-semibold text-sm">{modality.modality_code}</p>
                  <p className="text-xs text-gray-600">{modality.modality_name.split('(')[0]}</p>
                  <p className="text-xs text-gray-500 mt-1">{modality.study_type_count} studies</p>
                </button>
              ))}
            </div>
          </div>

          {/* Study Type Selection */}
          {selectedModality && studyTypes.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Study <span className="text-red-500">*</span>
              </label>
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studySearchTerm}
                  onChange={(e) => setStudySearchTerm(e.target.value)}
                  placeholder="Search by study, code, or body part..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {filteredStudyTypes.map((study) => (
                  <button
                    key={study.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudyType(study);
                      setOrderConcept(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedStudyType?.id === study.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{study.study_name}</p>
                        <p className="text-sm text-gray-600">
                          {study.study_code} • {study.body_part}
                          {study.contrast_required && ' • Contrast may be required'}
                        </p>
                      </div>
                      {study.cost != null && (
                        <span className="ml-3 px-3 py-1 bg-gray-100 rounded-full text-sm font-medium">
                          ${Number(study.cost).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {study.preparation_instructions && (
                      <p className="mt-2 text-xs text-gray-600 italic">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {study.preparation_instructions}
                      </p>
                    )}
                  </button>
                ))}
                {filteredStudyTypes.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-500 text-center">
                    No studies match your search.
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedStudyType && Number(selectedStudyType.cost ?? 0) > 0 && (
            <div className="mb-6 p-4 border border-amber-200 bg-amber-50 text-amber-800 rounded-lg flex items-start gap-3">
              <CreditCard className="w-5 h-5 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Payment required before imaging</p>
                <p className="text-sm">
                  Please direct the patient to the Accounts desk to settle the imaging fee prior to scheduling.
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Estimated fee: ${Number(selectedStudyType.cost).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {selectedStudyType && (
            <div className="mb-6">
              <SnomedConceptPicker
                value={orderConcept}
                onChange={setOrderConcept}
                token={token}
                tenantSlug={tenantSlug}
                label="SNOMED CT Imaging Concept"
                placeholder={`Search SNOMED CT (e.g., ${selectedStudyType.study_name})`}
                helperText="Select the standardized SNOMED CT concept that represents this imaging order."
                required
                context="procedure"
              />
            </div>
          )}

          {/* Priority */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-3">
              {[
                { value: 'routine', label: 'Routine', color: 'bg-green-100 text-green-800' },
                { value: 'urgent', label: 'Urgent', color: 'bg-yellow-100 text-yellow-800' },
                { value: 'stat', label: 'STAT', color: 'bg-red-100 text-red-800' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as any)}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    priority === p.value
                      ? `${p.color} border-current font-bold`
                      : 'bg-gray-50 text-gray-600 border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Indication */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Indication <span className="text-red-500">*</span>
            </label>
            {indicationSuggestions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {indicationSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setClinicalIndication((prev) =>
                        prev ? `${prev}${prev.endsWith('.') ? ' ' : '; '}${suggestion}` : suggestion,
                      )
                    }
                    className="px-2.5 py-1 text-xs rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={clinicalIndication}
              onChange={(e) => setClinicalIndication(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={2}
              placeholder="Reason for imaging (e.g., 'R/O pneumonia', 'Follow-up fracture', 'Pre-operative')"
              required
            />
          </div>

          <div className="mb-6 border border-slate-200 rounded-lg bg-slate-50">
            <button
              type="button"
              onClick={() => setShowAdvancedDetails((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-slate-700"
            >
              <span>Advanced Clinical Details (optional)</span>
              {showAdvancedDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAdvancedDetails && (
              <div className="px-4 pb-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clinical History
                  </label>
                  <textarea
                    value={clinicalHistory}
                    onChange={(e) => setClinicalHistory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                    placeholder="Relevant clinical history (e.g., 'Cough x 2 weeks, fever', 'Fall on outstretched hand')"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Suspected Diagnosis
                  </label>
                  <input
                    type="text"
                    value={suspectedDiagnosis}
                    onChange={(e) => setSuspectedDiagnosis(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="What are you looking for? (e.g., 'Pneumonia', 'Fracture', 'Mass')"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          {selectedStudyType && (
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2">Order Summary</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Study:</span>
                  <p className="font-medium">{selectedStudyType.study_name}</p>
                </div>
                <div>
                  <span className="text-gray-600">Modality:</span>
                  <p className="font-medium">{selectedStudyType.modality_name}</p>
                </div>
                <div>
                  <span className="text-gray-600">Body Part:</span>
                  <p className="font-medium">{selectedStudyType.body_part}</p>
                </div>
                      <div>
                        <span className="text-gray-600">Estimated Cost:</span>
                        <p className="font-medium">${selectedStudyType.cost != null ? Number(selectedStudyType.cost).toFixed(2) : '0.00'}</p>
                      </div>
                <div>
                  <span className="text-gray-600">Priority:</span>
                  <p className="font-medium capitalize">{priority}</p>
                </div>
                {selectedStudyType.contrast_required && (
                  <div className="col-span-2">
                    <span className="text-orange-600 font-medium">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      Contrast may be required
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedStudyType && `Selected: ${selectedStudyType.study_name}`}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Ordering...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    <span>Place Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
