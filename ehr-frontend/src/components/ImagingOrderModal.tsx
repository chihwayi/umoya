import React, { useState, useEffect } from 'react';
import { X, Search, Camera, AlertCircle, Calendar } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

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
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [suspectedDiagnosis, setSuspectedDiagnosis] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadModalities();
  }, []);

  useEffect(() => {
    if (selectedModality) {
      loadStudyTypes(selectedModality);
    }
  }, [selectedModality]);

  const loadModalities = async () => {
    try {
      const response = await ehrApi.getImagingModalities(tenantSlug, token);
      setModalities(response.data.modalities || []);
    } catch (error) {
      console.error('Failed to load modalities:', error);
      showError('Failed to load imaging modalities');
    }
  };

  const loadStudyTypes = async (modalityCode: string) => {
    try {
      const response = await ehrApi.getImagingStudyTypes(tenantSlug, token, modalityCode);
      setStudyTypes(response.data.studyTypes || []);
    } catch (error) {
      console.error('Failed to load study types:', error);
      showError('Failed to load study types');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudyType) {
      showError('Please select an imaging study');
      return;
    }

    if (!clinicalIndication.trim()) {
      showError('Please provide clinical indication');
      return;
    }

    try {
      setLoading(true);

      await ehrApi.createImagingOrder(tenantSlug, token, {
        patient_id: patientId,
        study_type_id: selectedStudyType.id,
        ordering_provider: orderingProviderId,
        clinical_indication: clinicalIndication,
        clinical_history: clinicalHistory,
        suspected_diagnosis: suspectedDiagnosis,
        priority,
      });

      showSuccess(`${selectedStudyType.study_name} ordered successfully`);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to create imaging order:', error);
      showError('Failed to create imaging order');
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {/* Modality Selection */}
          <div className="mb-6">
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
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {studyTypes.map((study) => (
                  <button
                    key={study.id}
                    type="button"
                    onClick={() => setSelectedStudyType(study)}
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
              </div>
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
            <textarea
              value={clinicalIndication}
              onChange={(e) => setClinicalIndication(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={2}
              placeholder="Reason for imaging (e.g., 'R/O pneumonia', 'Follow-up fracture', 'Pre-operative')"
              required
            />
          </div>

          {/* Clinical History */}
          <div className="mb-6">
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

          {/* Suspected Diagnosis */}
          <div className="mb-6">
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
                disabled={!selectedStudyType || !clinicalIndication.trim() || loading}
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

