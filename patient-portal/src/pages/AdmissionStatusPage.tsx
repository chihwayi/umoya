import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { 
  Bed, Calendar, User, Building, Clock, ArrowLeft, CheckCircle,
  AlertCircle, TrendingUp, Activity
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientPortalApi } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { format, differenceInDays } from 'date-fns';

interface Admission {
  id: string;
  admission_number: string;
  admission_date: string;
  expected_discharge_date?: string;
  actual_discharge_date?: string;
  admission_type: string;
  admission_source: string;
  admission_diagnosis: string;
  admission_diagnosis_icd10?: string;
  admission_reason: string;
  assigned_bed?: {
    bed_number: string;
    room_number: string;
    ward_name: string;
    floor: string;
    bed_type: string;
  };
  attending_doctor_name?: string;
  status: 'admitted' | 'discharged' | 'transferred';
  length_of_stay_days?: number;
}

const AdmissionStatusPage: React.FC = () => {
  const { patient, token } = usePatientAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError } = useNotifications();
  const [currentAdmission, setCurrentAdmission] = useState<Admission | null>(null);
  const [admissionHistory, setAdmissionHistory] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdmissionData();
  }, []);

  const loadAdmissionData = async () => {
    try {
      setLoading(true);
      const [current, history] = await Promise.all([
        patientPortalApi.getCurrentAdmission(token!, tenantSlug!),
        patientPortalApi.getAdmissionHistory(token!, tenantSlug!),
      ]);
      setCurrentAdmission(current);
      setAdmissionHistory(history || []);
    } catch (error) {
      console.error('Failed to load admission data:', error);
      showError('Error', 'Failed to load admission information');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysUntilDischarge = (expectedDate: string) => {
    return differenceInDays(new Date(expectedDate), new Date());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/${tenantSlug}/dashboard`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Bed className="w-6 h-6 text-indigo-600" />
                Admission Status
              </h1>
              <p className="text-sm text-gray-600">Your hospital admission information</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading admission status...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Current Admission */}
            {currentAdmission ? (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-8 text-white mb-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Currently Admitted</h2>
                    <p className="text-indigo-100">Admission #{currentAdmission.admission_number}</p>
                  </div>
                  <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-sm font-bold">
                    {currentAdmission.admission_type}
                  </span>
                </div>

                {/* Bed Information */}
                {currentAdmission.assigned_bed && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Bed className="w-5 h-5" />
                      Your Bed Assignment
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-indigo-200 mb-1">Ward</p>
                        <p className="text-lg font-bold">{currentAdmission.assigned_bed.ward_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-200 mb-1">Room</p>
                        <p className="text-lg font-bold">{currentAdmission.assigned_bed.room_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-200 mb-1">Bed</p>
                        <p className="text-lg font-bold">{currentAdmission.assigned_bed.bed_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-200 mb-1">Floor</p>
                        <p className="text-lg font-bold">{currentAdmission.assigned_bed.floor}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-semibold">Admitted</span>
                    </div>
                    <p className="text-lg font-bold">{format(new Date(currentAdmission.admission_date), 'MMM dd, yyyy')}</p>
                    <p className="text-xs text-indigo-200 mt-1">{differenceInDays(new Date(), new Date(currentAdmission.admission_date))} days ago</p>
                  </div>
                  
                  {currentAdmission.expected_discharge_date && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-semibold">Expected Discharge</span>
                      </div>
                      <p className="text-lg font-bold">{format(new Date(currentAdmission.expected_discharge_date), 'MMM dd, yyyy')}</p>
                      <p className="text-xs text-indigo-200 mt-1">
                        {calculateDaysUntilDischarge(currentAdmission.expected_discharge_date) > 0
                          ? `In ${calculateDaysUntilDischarge(currentAdmission.expected_discharge_date)} days`
                          : 'Today or soon'}
                      </p>
                    </div>
                  )}
                </div>

                {currentAdmission.attending_doctor_name && (
                  <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="text-sm">Attending Doctor:</span>
                      <span className="font-bold">{currentAdmission.attending_doctor_name}</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-sm mb-1"><strong>Diagnosis:</strong> {currentAdmission.admission_diagnosis}</p>
                  <p className="text-sm"><strong>Reason:</strong> {currentAdmission.admission_reason}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center mb-8">
                <Bed className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Not Currently Admitted</h3>
                <p className="text-gray-600">You are not currently admitted to the hospital.</p>
              </div>
            )}

            {/* Admission History */}
            {admissionHistory.length > 0 && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-gray-600" />
                  Previous Admissions
                </h2>
                <div className="space-y-3">
                  {admissionHistory.map((adm) => (
                    <div key={adm.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 mb-1">{adm.admission_diagnosis}</h3>
                          <p className="text-sm text-gray-600">Admission #{adm.admission_number}</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-bold">
                          {adm.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Admitted</p>
                          <p className="font-semibold text-gray-900">{format(new Date(adm.admission_date), 'MMM dd, yyyy')}</p>
                        </div>
                        {adm.actual_discharge_date && (
                          <div>
                            <p className="text-xs text-gray-500">Discharged</p>
                            <p className="font-semibold text-gray-900">{format(new Date(adm.actual_discharge_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                        {adm.length_of_stay_days && (
                          <div>
                            <p className="text-xs text-gray-500">Length of Stay</p>
                            <p className="font-semibold text-gray-900">{adm.length_of_stay_days} days</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdmissionStatusPage;

