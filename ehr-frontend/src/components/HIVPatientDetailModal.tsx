import React, { useState, useEffect } from 'react';
import { X, Calendar, Activity, Heart, TrendingUp, User, FileText, TestTube, Pill, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface HIVPatientDetailModalProps {
  enrollment: any;
  onClose: () => void;
  tenantSlug: string;
}

const HIVPatientDetailModal: React.FC<HIVPatientDetailModalProps> = ({
  enrollment,
  onClose,
  tenantSlug
}) => {
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [patientDetails, setPatientDetails] = useState<any>(null);
  const [artInitiationDetails, setArtInitiationDetails] = useState<any>(null);
  const [clinicalVisits, setClinicalVisits] = useState<any[]>([]);
  const [hivTests, setHivTests] = useState<any[]>([]);
  const [eacEligibility, setEacEligibility] = useState<any>(null);
  const [eacSessions, setEacSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'tests' | 'art-initiation' | 'eac'>('overview');

  useEffect(() => {
    if (enrollment) {
      loadPatientData();
    }
  }, [enrollment]);

  const loadPatientData = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);

      // Load patient details
      const patientResponse = await ehrApi.getPatientById(enrollment.patient_id, token, tenantSlug);
      setPatientDetails(patientResponse.data);

      // Load clinical visits
      try {
        const visitsResponse = await ehrApi.getHivClinicalVisits(enrollment.id, token, tenantSlug);
        setClinicalVisits(visitsResponse.data.visits || []);
      } catch (error) {
        console.error('Failed to load visits:', error);
        setClinicalVisits([]);
      }

      // Load HIV tests
      try {
        const testsResponse = await ehrApi.getPatientHivTests(enrollment.patient_id, token, tenantSlug);
        setHivTests(testsResponse.data.tests || []);
      } catch (error) {
        console.error('Failed to load tests:', error);
        setHivTests([]);
      }

      // Check EAC eligibility
      try {
        const eacResponse = await ehrApi.checkEacEligibility(enrollment.id, token, tenantSlug);
        setEacEligibility(eacResponse.data);
      } catch (error) {
        console.error('Failed to check EAC eligibility:', error);
      }

      // Load EAC sessions
      try {
        const eacSessionsResponse = await ehrApi.getEacSessions(enrollment.id, token, tenantSlug);
        setEacSessions(eacSessionsResponse.data.sessions || []);
      } catch (error) {
        console.error('Failed to load EAC sessions:', error);
        setEacSessions([]);
      }

      // Load ART initiation details (if available)
      // Note: We'll need to add an API endpoint for this, or query it directly
      // For now, we'll skip it

    } catch (error) {
      console.error('Failed to load patient data:', error);
      showError('Error', 'Failed to load patient details');
    } finally {
      setLoading(false);
    }
  };

  const getVisitTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'A': 'Initial Assessment',
      'B': 'Follow-up',
      'C': 'Drug Pickup',
      'D': 'Laboratory Review',
      'E': 'Adherence Counseling',
      'F': 'Clinical Review',
      'G': 'Transfer Out'
    };
    return types[type] || type;
  };

  const getArvStatusLabel = (status: string) => {
    const statuses: { [key: string]: string } = {
      '1': 'Not on ART',
      '2': 'Starting ART',
      '2b': 'Starting ART (Pregnant)',
      '3': 'On ART',
      '4': 'Changed Regimen',
      '5': 'Stopped ART',
      '6': 'Restarted ART',
      '7': 'Transferred Out'
    };
    return statuses[status] || status;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-4">
            <Activity className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-slate-700">Loading patient details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">
              {enrollment.first_name} {enrollment.last_name}
            </h2>
            <p className="text-sm text-emerald-100">HIV Care Patient Summary</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-emerald-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-4">
            {[
              { key: 'overview', label: 'Overview', icon: User },
              { key: 'visits', label: 'Clinical Visits', icon: FileText },
              { key: 'tests', label: 'HIV Tests', icon: TestTube },
              { key: 'art-initiation', label: 'ART Initiation', icon: Pill },
              { key: 'eac', label: 'EAC', icon: Activity }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`px-4 py-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === key
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Patient Information */}
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  Patient Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patientDetails && (
                    <>
                      <div>
                        <p className="text-sm text-slate-600">Patient Number</p>
                        <p className="font-semibold text-slate-900">{patientDetails?.patientNumber || enrollment.patient_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Gender</p>
                        <p className="font-semibold text-slate-900">{patientDetails?.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Date of Birth</p>
                        <p className="font-semibold text-slate-900">
                          {patientDetails?.dateOfBirth ? formatDateToDDMMYYYY(patientDetails.dateOfBirth) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Phone</p>
                        <p className="font-semibold text-slate-900">{patientDetails?.phone || 'N/A'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Enrollment Information */}
              <div className="bg-emerald-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Enrollment Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Enrollment Number</p>
                    <p className="font-semibold text-slate-900">{enrollment.enrollment_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Enrollment Date</p>
                    <p className="font-semibold text-slate-900">
                      {enrollment.enrollment_date ? formatDateToDDMMYYYY(enrollment.enrollment_date) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Date Confirmed Positive</p>
                    <p className="font-semibold text-slate-900">
                      {enrollment.date_confirmed_positive ? formatDateToDDMMYYYY(enrollment.date_confirmed_positive) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      enrollment.enrollment_status === 'active' ? 'bg-green-100 text-green-800' :
                      enrollment.enrollment_status === 'transferred_out' ? 'bg-blue-100 text-blue-800' :
                      enrollment.enrollment_status === 'lost_to_followup' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {enrollment.enrollment_status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Treatment */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-600" />
                  Current Treatment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enrollment.current_regimen && (
                    <div>
                      <p className="text-sm text-slate-600">Current Regimen</p>
                      <p className="font-semibold text-slate-900">{enrollment.current_regimen}</p>
                    </div>
                  )}
                  {enrollment.baseline_clinical_stage && (
                    <div>
                      <p className="text-sm text-slate-600">Clinical Stage</p>
                      <p className="font-semibold text-slate-900">{enrollment.baseline_clinical_stage.toUpperCase()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Baseline Lab Results */}
              <div className="bg-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Baseline Lab Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enrollment.baseline_cd4 && (
                    <div>
                      <p className="text-sm text-slate-600">Baseline CD4 Count</p>
                      <p className="font-semibold text-slate-900">{enrollment.baseline_cd4} cells/mm³</p>
                    </div>
                  )}
                  {enrollment.baseline_viral_load && (
                    <div>
                      <p className="text-sm text-slate-600">Baseline Viral Load</p>
                      <p className="font-semibold text-slate-900">
                        {enrollment.baseline_viral_load} {enrollment.baseline_viral_load_unit || 'copies/mL'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{clinicalVisits.length}</p>
                      <p className="text-sm text-slate-600">Clinical Visits</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <TestTube className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{hivTests.length}</p>
                      <p className="text-sm text-slate-600">HIV Tests</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {enrollment.enrollment_date ? Math.floor((new Date().getTime() - new Date(enrollment.enrollment_date).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                      </p>
                      <p className="text-sm text-slate-600">Days on Care</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Clinical Visit History</h3>
              {clinicalVisits.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">No clinical visits recorded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clinicalVisits.map((visit) => (
                    <div key={visit.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold">
                              {getVisitTypeLabel(visit.visit_type)}
                            </span>
                            <span className="text-sm text-slate-600">
                              Visit #{visit.visit_number}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {visit.visit_date ? formatDateToDDMMYYYY(visit.visit_date) : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {visit.weight_kg && (
                          <div>
                            <p className="text-xs text-slate-600">Weight</p>
                            <p className="font-semibold">{visit.weight_kg} kg</p>
                          </div>
                        )}
                        {visit.arv_status && (
                          <div>
                            <p className="text-xs text-slate-600">ARV Status</p>
                            <p className="font-semibold">{getArvStatusLabel(visit.arv_status)}</p>
                          </div>
                        )}
                        {visit.arv_regimen_name && (
                          <div>
                            <p className="text-xs text-slate-600">Regimen</p>
                            <p className="font-semibold">{visit.arv_regimen_name}</p>
                          </div>
                        )}
                        {visit.cd4_count && (
                          <div>
                            <p className="text-xs text-slate-600">CD4</p>
                            <p className="font-semibold">{visit.cd4_count} cells/mm³</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">HIV Test History</h3>
              {hivTests.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <TestTube className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">No HIV tests recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hivTests.map((test) => (
                    <div key={test.id} className="bg-white border border-slate-200 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-semibold text-slate-900">{test.test_kit_name}</p>
                          <p className="text-sm text-slate-600">
                            {test.test_date ? formatDateToDDMMYYYY(test.test_date) : 'N/A'}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          test.test_result === 'reactive' ? 'bg-red-100 text-red-800' :
                          test.test_result === 'non_reactive' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {test.test_result?.replace('_', ' ').toUpperCase() || 'PENDING'}
                        </span>
                      </div>
                      {test.algorithm_result && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-600">Algorithm Result</p>
                          <p className="font-semibold text-slate-900">
                            {test.algorithm_result.toUpperCase()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'eac' && (
            <div className="space-y-6">
              {/* EAC Eligibility Alert */}
              {eacEligibility?.needsEac && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-900 mb-2">
                        ⚠️ Patient Requires EAC (Enhanced Adherence Counseling)
                      </h3>
                      <p className="text-red-800 mb-2">
                        Patient has 2 consecutive viral loads >1000 copies/mL (WHO Guidelines). Enhanced Adherence Counseling is required.
                      </p>
                      {eacEligibility.recentVisits && eacEligibility.recentVisits.length >= 2 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm font-semibold text-red-900">Recent High Viral Loads:</p>
                          {eacEligibility.recentVisits.map((visit: any, idx: number) => (
                            <div key={idx} className="bg-white rounded p-3 border border-red-200">
                              <p className="text-sm">
                                Visit {idx + 1}: VL = {visit.viral_load} copies/mL on {formatDateToDDMMYYYY(visit.visit_date)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Active EAC Program */}
              {eacEligibility?.activeEac && eacEligibility.eacProgram && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <Activity className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-900 mb-2">
                        Active EAC Program
                      </h3>
                      <p className="text-blue-800">
                        EAC program started on {formatDateToDDMMYYYY(eacEligibility.eacProgram.session_date)}. 
                        Status: <span className="font-semibold">{eacEligibility.eacProgram.eac_program_status}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* EAC Sessions */}
              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    EAC Sessions ({eacSessions.length})
                  </h3>
                  <button
                    onClick={() => {
                      // TODO: Open EAC session modal
                      alert('EAC Session recording will be implemented');
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Record EAC Session
                  </button>
                </div>

                {eacSessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No EAC sessions recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {eacSessions.map((session: any) => (
                      <div key={session.id} className="bg-white rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-900">
                              Session {session.session_number} - {formatDateToDDMMYYYY(session.session_date)}
                            </h4>
                            <p className="text-sm text-slate-600 mt-1">
                              Counselor: {session.counselor_name || 'N/A'}
                            </p>
                            {session.adherence_percentage_self_reported && (
                              <p className="text-sm text-slate-600">
                                Self-reported Adherence: {session.adherence_percentage_self_reported}%
                              </p>
                            )}
                            {session.patient_commitment_level && (
                              <p className="text-sm text-slate-600">
                                Commitment Level: {session.patient_commitment_level}
                              </p>
                            )}
                            <p className="text-sm text-slate-600 mt-2">
                              Status: <span className="font-semibold">{session.eac_program_status}</span>
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            session.session_outcome === 'Completed' ? 'bg-green-100 text-green-800' :
                            session.session_outcome === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                            session.session_outcome === 'Missed' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {session.session_outcome}
                          </span>
                        </div>
                        {session.session_notes && (
                          <p className="text-sm text-slate-700 mt-3 italic">
                            {session.session_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'art-initiation' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">ART Initiation Details</h3>
              <div className="bg-slate-50 rounded-xl p-6">
                <p className="text-slate-600">ART initiation details will be displayed here once the endpoint is available.</p>
                <p className="text-sm text-slate-500 mt-2">This section will show comprehensive registration information including linkage sources, patient profile, and consent details.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HIVPatientDetailModal;

