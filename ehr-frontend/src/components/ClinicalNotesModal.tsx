import React, { useEffect, useState } from 'react';
import { FileText, X, Save, Calendar, Clock, User, Stethoscope, Brain } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface Appointment {
  id: string;
  patient: { 
    id: string; 
    firstName: string; 
    lastName: string; 
    patientNumber: string;
    dateOfBirth?: string;
    gender?: string;
  };
  appointmentDate: string;
  appointmentType: string;
  notes: string;
}

interface ClinicalNotesModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: Appointment;
  tenantSlug: string;
  token: string;
}

const ClinicalNotesModal: React.FC<ClinicalNotesModalProps> = ({ open, onClose, onSaved, appointment, tenantSlug, token }) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [assessment, setAssessment] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<any>(null);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [clinicalGuidelines, setClinicalGuidelines] = useState<any>(null);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      if (appointment.notes) {
        try {
          const parsed = JSON.parse(appointment.notes);
          const cd = parsed?.clinicalDocumentation || {};
          setChiefComplaint(cd.chiefComplaint || '');
          setHistoryOfPresentIllness(cd.historyOfPresentIllness || '');
          setPhysicalExam(cd.physicalExamination || '');
          setAssessment(cd.clinicalAssessment || '');
          setAdditionalNotes(cd.additionalNotes || parsed?.notes || '');
        } catch {
          setAdditionalNotes(appointment.notes || '');
        }
      } else {
        setChiefComplaint('');
        setHistoryOfPresentIllness('');
        setPhysicalExam('');
        setAssessment('');
        setAdditionalNotes('');
      }
    } catch (e) {
      // ignore load errors
    }
  }, [open, appointment.id]);

  const handleSave = async () => {
    try {
      setLoading(true);
      let payload: any = {};
      try {
        payload = appointment.notes ? JSON.parse(appointment.notes) : {};
      } catch {
        payload = {};
      }
      payload.notes = additionalNotes;
      payload.clinicalDocumentation = {
        chiefComplaint,
        historyOfPresentIllness,
        physicalExamination: physicalExam,
        clinicalAssessment: assessment,
        additionalNotes,
      };

      await ehrApi.updateAppointment(appointment.id, { notes: JSON.stringify(payload) }, token, tenantSlug);
      showSuccess('Saved', 'Clinical notes saved');
      onSaved();
    } catch (error: any) {
      const raw = error?.response?.data;
      const msg = (raw && (raw.message || raw.error || raw.errors)) ? (raw.message || raw.error || raw.errors) : raw;
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg || 'Failed to save clinical notes');
      showError('Error', text);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 animate-in fade-in duration-300">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
          <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200/50 px-6 py-5 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Clinical Notes</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                    <div className="flex items-center gap-2"><User className="w-4 h-4" /><span>{appointment.patient.firstName} {appointment.patient.lastName}</span></div>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>{formatDateToDDMMYYYY(appointment.appointmentDate)}</span></div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>{new Date(appointment.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">Chief Complaint</label>
                {chiefComplaint && chiefComplaint.length > 10 && (
                  <button
                    onClick={async () => {
                      setLoadingDiagnosis(true);
                      try {
                        const patientAge = appointment.patient.dateOfBirth
                          ? Math.floor((new Date().getTime() - new Date(appointment.patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                          : undefined;
                        
                        const result = await ehrApi.getDiagnosisSuggestions({
                          symptoms: [chiefComplaint, historyOfPresentIllness].filter(Boolean),
                          age: patientAge,
                          gender: appointment.patient.gender,
                        }, token, tenantSlug);
                        
                        const suggestionsData = result.data || result;
                        if (suggestionsData.suggested_diagnoses && suggestionsData.suggested_diagnoses.length > 0) {
                          setDiagnosisSuggestions(suggestionsData);
                        } else if (suggestionsData.differentialDiagnoses && suggestionsData.differentialDiagnoses.length > 0) {
                          setDiagnosisSuggestions({
                            suggested_diagnoses: suggestionsData.differentialDiagnoses.map((d: any) => ({
                              diagnosis: d.condition || d.diagnosis || 'Unknown',
                              probability: d.probability || 0.5,
                              confidence: d.confidence || 'moderate',
                              matching_symptoms: d.matching_symptoms || []
                            }))
                          });
                        }
                      } catch (error) {
                        console.error('Failed to get diagnosis suggestions:', error);
                        showError('Error', 'Failed to get diagnostic suggestions');
                      } finally {
                        setLoadingDiagnosis(false);
                      }
                    }}
                    disabled={loadingDiagnosis}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                  >
                    <Brain className="w-3 h-3" />
                    {loadingDiagnosis ? 'Analyzing...' : 'Diagnostic Assistant'}
                  </button>
                )}
              </div>
              <textarea 
                value={chiefComplaint} 
                onChange={(e) => {
                  setChiefComplaint(e.target.value);
                  setDiagnosisSuggestions(null);
                }} 
                rows={2} 
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none" 
                placeholder="Patient's main concern or reason for visit..."
              />
              {diagnosisSuggestions && diagnosisSuggestions.suggested_diagnoses && diagnosisSuggestions.suggested_diagnoses.length > 0 && (
                <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2 text-sm">
                    <Stethoscope className="w-4 h-4" />
                    Differential Diagnosis Suggestions
                  </h4>
                  <div className="space-y-2">
                    {diagnosisSuggestions.suggested_diagnoses.slice(0, 5).map((diag: any, idx: number) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-900 text-sm">{diag.diagnosis || diag.condition || 'Unknown'}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            diag.confidence === 'high' ? 'bg-green-100 text-green-700' :
                            diag.confidence === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {((diag.probability || 0) * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">History of Present Illness</label>
              <textarea value={historyOfPresentIllness} onChange={(e) => setHistoryOfPresentIllness(e.target.value)} rows={4} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Physical Examination</label>
              <textarea value={physicalExam} onChange={(e) => setPhysicalExam(e.target.value)} rows={4} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">Clinical Assessment / Diagnosis</label>
                {assessment && assessment.length > 3 && (
                  <button
                    onClick={async () => {
                      setLoadingGuidelines(true);
                      try {
                        const patientAge = appointment.patient.dateOfBirth
                          ? Math.floor((new Date().getTime() - new Date(appointment.patient.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                          : undefined;
                        
                        const result = await ehrApi.getClinicalGuidelines(
                          assessment,
                          {
                            age: patientAge,
                            gender: appointment.patient.gender,
                          },
                          token,
                          tenantSlug
                        );
                        setClinicalGuidelines(result.data);
                      } catch (error) {
                        console.error('Failed to fetch guidelines:', error);
                        showError('Error', 'Failed to fetch clinical guidelines');
                      } finally {
                        setLoadingGuidelines(false);
                      }
                    }}
                    disabled={loadingGuidelines}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    {loadingGuidelines ? 'Loading...' : 'Get Guidelines'}
                  </button>
                )}
              </div>
              <textarea 
                value={assessment} 
                onChange={(e) => {
                  setAssessment(e.target.value);
                  setClinicalGuidelines(null);
                }} 
                rows={3} 
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
                placeholder="Enter diagnosis or clinical assessment..."
              />
              {clinicalGuidelines && (
                <div className="mt-3 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                  <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4" />
                    Clinical Guidelines ({clinicalGuidelines.evidence_level || 'standard'} evidence)
                  </h4>
                  <div className="space-y-2 mt-2">
                    <p className="text-sm font-medium text-slate-900">Recommendations:</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {clinicalGuidelines.recommendations?.slice(0, 5).map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-600 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Notes</label>
              <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={4} className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none" />
            </div>
          </div>

          <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-2xl">
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium">Cancel</button>
              <button onClick={handleSave} disabled={loading} className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-medium shadow-lg disabled:opacity-50 flex items-center gap-2">
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Clinical Notes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ClinicalNotesModal;


