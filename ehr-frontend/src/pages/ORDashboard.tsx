import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, Users, TrendingUp, Activity, Plus,
  AlertCircle, CheckCircle, Loader2, ArrowLeft
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';
import ScheduleSurgeryModal from '../components/ScheduleSurgeryModal';
import SurgicalCaseDetailModal from '../components/SurgicalCaseDetailModal';
import ORBoardView from '../components/ORBoardView';

const ORDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [orAvailability, setOrAvailability] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [showCaseDetail, setShowCaseDetail] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('board');

  useEffect(() => {
    loadORData();
  }, [selectedDate]);

  const loadORData = async () => {
    try {
      setLoading(true);
      
      // Load OR availability
      const availabilityResponse = await ehrAxios.get('/operating-room/availability', {
        params: { date: selectedDate },
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
        },
      });
      setOrAvailability(availabilityResponse.data || []);

      // Load metrics (today only)
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        const metricsResponse = await ehrAxios.get('/operating-room/metrics', {
          params: { startDate: today, endDate: today },
          headers: {
            'X-Tenant-ID': tenantSlug,
            'Authorization': `Bearer ${token}`,
          },
        });
        setMetrics(metricsResponse.data);
      }
    } catch (error) {
      showError('Error', 'Failed to load operating room data');
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (surgicalCase: any) => {
    setSelectedCase(surgicalCase);
    setShowCaseDetail(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed': return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'patient_arrived': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'in_progress': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getORStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-blue-500';
      case 'cleaning': return 'bg-yellow-500';
      case 'maintenance': return 'bg-orange-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading operating rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/${currentUser?.role === 'doctor' ? 'doctor' : currentUser?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Activity className="w-8 h-8" />
                  Operating Room Dashboard
                </h1>
                <p className="text-indigo-100 mt-1">Surgical scheduling and management</p>
              </div>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all shadow-lg hover:shadow-xl font-semibold"
            >
              <Plus className="w-5 h-5" />
              Schedule Surgery
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Date Selector & View Toggle */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-200 shadow-sm">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-0 bg-transparent focus:outline-none focus:ring-0 font-medium text-slate-900"
            />
          </div>
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-xl p-1 border border-slate-200 shadow-sm">
            <button
              onClick={() => setViewMode('board')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                viewMode === 'board'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Board View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              List View
            </button>
          </div>
        </div>

        {/* Metrics (Today only) */}
      {metrics && selectedDate === new Date().toISOString().split('T')[0] && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Cases</p>
                <p className="text-3xl font-bold text-slate-900">{metrics.total_cases || 0}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{metrics.completed_cases || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-orange-600">{metrics.in_progress_cases || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Avg Duration</p>
                <p className="text-3xl font-bold text-purple-600">
                  {metrics.avg_case_duration_minutes ? Math.round(metrics.avg_case_duration_minutes) : 0}
                  <span className="text-lg text-slate-600">min</span>
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OR Board */}
      {orAvailability.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Operating Rooms Available</h3>
          <p className="text-slate-600">Contact administrator to configure operating rooms.</p>
        </div>
      ) : viewMode === 'board' ? (
        <ORBoardView
          orAvailability={orAvailability}
          onCaseClick={handleCaseClick}
          selectedDate={selectedDate}
        />
      ) : (
        <div className="space-y-4">
          {orAvailability.map((or) => (
            <div
              key={or.id}
              className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              {/* OR Header */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getORStatusColor(or.status)} shadow-lg`}></div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{or.room_number} - {or.room_name}</h3>
                      <p className="text-indigo-100 text-sm capitalize">{or.room_type.replace('_', ' ')} • {or.status}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg">
                    <span className="text-white font-semibold text-sm">
                      {or.scheduled_cases?.length || 0} Cases
                    </span>
                  </div>
                </div>
              </div>

              {/* Cases */}
              <div className="p-4">
                {!or.scheduled_cases || or.scheduled_cases.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No cases scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {or.scheduled_cases.map((surgicalCase: any) => (
                      <button
                        key={surgicalCase.caseid}
                        onClick={() => handleCaseClick(surgicalCase)}
                        className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-lg p-4 border border-slate-200 transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-slate-900">{surgicalCase.patientname}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(surgicalCase.status)}`}>
                                {surgicalCase.status?.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <p className="text-slate-700 font-medium mb-1">{surgicalCase.procedurename}</p>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {surgicalCase.scheduledstarttime} - {surgicalCase.scheduledendtime}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                Dr. {surgicalCase.surgeonname}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-400 group-hover:text-indigo-600 transition-colors">
                            →
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

        {/* Modals */}
        {showScheduleModal && (
          <ScheduleSurgeryModal
            tenantSlug={tenantSlug || ''}
            token={token}
            onSuccess={() => {
              setShowScheduleModal(false);
              loadORData();
              showSuccess('Success', 'Surgery scheduled successfully');
            }}
            onClose={() => setShowScheduleModal(false)}
          />
        )}

        {showCaseDetail && selectedCase && (
          <SurgicalCaseDetailModal
            caseId={selectedCase.caseid}
            tenantSlug={tenantSlug || ''}
            token={token}
            onUpdate={loadORData}
            onClose={() => setShowCaseDetail(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ORDashboard;

