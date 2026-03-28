import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import {
  AlertCircle, ArrowLeft,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { format } from 'date-fns';

interface EDVisit {
  id: string;
  ed_visit_number: string;
  arrival_date: string;
  arrival_time: string;
  arrival_mode: string;
  chief_complaint: string;
  chief_complaint_snomed?: string;
  ed_status: string;
  triage_level?: number;
  triage_assessment?: string;
  disposition?: string;
  discharge_time?: string;
  discharge_diagnosis?: string;
  discharge_instructions?: string;
  total_ed_time_minutes?: number;
}

const EDVisitsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError } = useNotification();
  const [visits, setVisits] = useState<EDVisit[]>([]);
  const [_selectedVisit, _setSelectedVisit] = useState<EDVisit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEDVisits();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEDVisits = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getPatientEDVisits(token!, tenantSlug!);
      setVisits(data);
    } catch (error) {
      console.error('Failed to load ED visits:', error);
      showError('Error', 'Failed to load emergency department visits');
    } finally {
      setLoading(false);
    }
  };

  const getESIColor = (level: number) => {
    switch (level) {
      case 1: return 'from-red-600 to-red-700';
      case 2: return 'from-orange-500 to-red-500';
      case 3: return 'from-yellow-500 to-orange-500';
      case 4: return 'from-green-500 to-emerald-500';
      case 5: return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getESILabel = (level: number) => {
    switch (level) {
      case 1: return 'Immediate';
      case 2: return 'Emergent';
      case 3: return 'Urgent';
      case 4: return 'Less Urgent';
      case 5: return 'Non-Urgent';
      default: return 'Unknown';
    }
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
                <AlertCircle className="w-6 h-6 text-red-600" />
                Emergency Department Visits
              </h1>
              <p className="text-sm text-gray-600">Your ED visit history and discharge summaries</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your ED visits...</p>
            </div>
          </div>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No ED Visits</h3>
            <p className="text-gray-600">You don't have any emergency department visit records.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visits.map((visit) => (
              <div key={visit.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`px-3 py-1 bg-gradient-to-r ${visit.triage_level ? getESIColor(visit.triage_level) : 'from-gray-500 to-gray-600'} text-white rounded-lg text-xs font-bold`}>
                        ESI {visit.triage_level || '?'} - {visit.triage_level ? getESILabel(visit.triage_level) : 'Not Triaged'}
                      </div>
                      <span className="text-xs text-gray-600">Visit #{visit.ed_visit_number}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{visit.chief_complaint}</h3>
                    <p className="text-sm text-gray-600">Arrival: {visit.arrival_mode}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Arrival Date</p>
                    <p className="font-semibold text-gray-900">{format(new Date(visit.arrival_date), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Arrival Time</p>
                    <p className="font-semibold text-gray-900">{format(new Date(visit.arrival_time), 'h:mm a')}</p>
                  </div>
                  {visit.discharge_time && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Discharged</p>
                      <p className="font-semibold text-gray-900">{format(new Date(visit.discharge_time), 'h:mm a')}</p>
                    </div>
                  )}
                  {visit.total_ed_time_minutes && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Time</p>
                      <p className="font-semibold text-gray-900">{Math.round(visit.total_ed_time_minutes)} min</p>
                    </div>
                  )}
                </div>

                {visit.discharge_diagnosis && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mb-3">
                    <p className="text-xs font-semibold text-blue-900 mb-1">DISCHARGE DIAGNOSIS</p>
                    <p className="text-sm text-gray-900">{visit.discharge_diagnosis}</p>
                  </div>
                )}

                {visit.discharge_instructions && (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-900 mb-1">DISCHARGE INSTRUCTIONS</p>
                    <p className="text-sm text-gray-900">{visit.discharge_instructions}</p>
                  </div>
                )}

                {visit.disposition && (
                  <div className="mt-3">
                    <span className="text-xs text-gray-500">Disposition: </span>
                    <span className="text-sm font-semibold text-gray-900">{visit.disposition}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default EDVisitsPage;

