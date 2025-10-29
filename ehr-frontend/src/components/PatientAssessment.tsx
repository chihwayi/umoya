import React, { useMemo, useState } from 'react';
import {
  X, Save, ClipboardList, AlertTriangle, Activity, Heart,
  Thermometer, Droplets, Stethoscope, Calendar
} from 'lucide-react';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';
import { useNotification } from '../components/GlobalNotification.tsx';

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface AppointmentLite {
  id: string;
  appointmentDate: string;
  appointmentType: string;
  reason: string;
  status: string;
  patient: Patient;
}

interface PatientAssessmentProps {
  patient?: Patient;
  appointments?: AppointmentLite[];
  onClose?: () => void;
  onSave?: () => void;
}

const PatientAssessment: React.FC<PatientAssessmentProps> = ({ patient, appointments = [], onClose, onSave }) => {
  const { showSuccess, showError } = useNotification();

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [onset, setOnset] = useState('');
  const [painScore, setPainScore] = useState<number>(0);
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [history, setHistory] = useState('');
  const [observations, setObservations] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [loading, setLoading] = useState(false);

  const severityScore = useMemo(() => {
    let score = 0;
    // Simple heuristic: higher pain and urgent priority raise score
    score += painScore;
    score += priority === 'urgent' ? 5 : priority === 'high' ? 3 : priority === 'normal' ? 1 : 0;
    // Onset text heuristic
    if (onset.toLowerCase().includes('sudden')) score += 2;
    return Math.min(10, score);
  }, [painScore, priority, onset]);

  const handleSave = async () => {
    if (!patient) {
      showError('Error', 'No patient selected for triage');
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      
      if (!token || !tenantSlug) {
        showError('Error', 'Authentication required');
        return;
      }

      const triagePayload = {
        patientId: patient.id,
        chiefComplaint,
        onset,
        painScore,
        allergies,
        medications,
        history,
        observations,
        priority,
        severityScore,
        recordedAt: new Date().toISOString(),
        recordedBy: JSON.parse(localStorage.getItem('ehr_user') || '{}').id,
      };

      await ehrApi.recordTriageAssessment(triagePayload, token, tenantSlug);
      showSuccess('Saved', 'Triage assessment recorded');
      onSave?.();
    } catch (e) {
      console.error(e);
      showError('Error', 'Failed to save triage assessment');
    } finally {
      setLoading(false);
    }
  };

  // If used as a full-page panel without a bound patient, show guidance
  if (!patient) {
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200/50 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-xl">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Triage Assessment</h3>
        </div>
        <div className="text-center py-10">
          <ClipboardList className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Select a patient from the queue to start a triage assessment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200/50">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h3>
            <p className="text-slate-600">ID: {patient.patientNumber}</p>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Recent: {appointments[0] ? formatDateTimeToDDMMYYYYHHMM(appointments[0].appointmentDate) : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              <span>{appointments[0]?.appointmentType || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Chief Complaint</label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Patient's primary concern in their own words"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Onset and Course</label>
              <input
                value={onset}
                onChange={(e) => setOnset(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="e.g., Sudden onset 2 hours ago"
              />
            </div>
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Pain Score (0-10)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={painScore}
                onChange={(e) => setPainScore(Number(e.target.value))}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="0 (no pain) to 10 (worst pain)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Allergies</label>
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="List known allergies"
              />
            </div>
            <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Current Medications</label>
              <textarea
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="List active medications"
              />
            </div>
          </div>

          <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Relevant History</label>
            <textarea
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Brief past medical/surgical history relevant to the visit"
            />
          </div>

          <div className="p-6 bg-white/70 rounded-2xl border border-slate-200/60 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nurse Observations</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="General appearance, orientation, distress, etc."
            />
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-yellow-600 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Priority</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['urgent','high','normal','low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    priority === p
                      ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-transparent'
                      : 'border-slate-300 hover:bg-white'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Severity Score</h4>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-indigo-600">{severityScore}</span>
              <span className="text-slate-600">/ 10</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Calculated from pain, priority and onset hints.</p>
          </div>

          {appointments.length > 0 && (
            <div className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-slate-500 to-slate-700 rounded-xl">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Current Appointment</h4>
              </div>
              <div className="text-sm text-slate-700">
                <div className="font-semibold">{appointments[0].appointmentType}</div>
                <div className="text-slate-600">{formatDateTimeToDDMMYYYYHHMM(appointments[0].appointmentDate)}</div>
                <div className="text-slate-500">Reason: {appointments[0].reason || '—'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      {patient && (
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all duration-200 font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Assessment
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientAssessment;
