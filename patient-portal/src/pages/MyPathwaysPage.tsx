import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { 
  Route, CheckCircle, Clock, AlertCircle, TrendingUp, BarChart3,
  ArrowLeft, Eye, Calendar, Target, Activity, Zap, Award
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientPortalApi } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { format } from 'date-fns';

interface PathwayEnrollment {
  id: string;
  pathway_id: string;
  pathway_name: string;
  condition: string;
  specialty: string;
  description: string;
  enrollment_date: string;
  expected_completion_date?: string;
  actual_completion_date?: string;
  status: 'active' | 'completed' | 'paused' | 'discontinued';
  total_steps: number;
  completed_steps: number;
  adherence_score: number;
  current_step?: string;
}

interface PathwayStep {
  id: string;
  step_number: number;
  description: string;
  timing_from_start_hours: number;
  required_actions: string;
  decision_criteria: string;
  step_type: string;
  is_completed: boolean;
  completed_date?: string;
}

const MyPathwaysPage: React.FC = () => {
  const { patient, token } = usePatientAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotifications();
  const [pathways, setPathways] = useState<PathwayEnrollment[]>([]);
  const [selectedPathway, setSelectedPathway] = useState<PathwayEnrollment | null>(null);
  const [pathwaySteps, setPathwaySteps] = useState<PathwayStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState(false);

  useEffect(() => {
    loadPathways();
  }, []);

  const loadPathways = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getPatientPathways(token!, tenantSlug!);
      setPathways(data);
    } catch (error) {
      console.error('Failed to load pathways:', error);
      showError('Error', 'Failed to load care pathways');
    } finally {
      setLoading(false);
    }
  };

  const loadPathwayProgress = async (enrollmentId: string) => {
    try {
      setLoadingSteps(true);
      const data = await patientPortalApi.getPathwayProgress(enrollmentId, token!, tenantSlug!);
      setPathwaySteps(data.steps || []);
    } catch (error) {
      console.error('Failed to load pathway progress:', error);
      showError('Error', 'Failed to load pathway details');
    } finally {
      setLoadingSteps(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Active
        </span>;
      case 'completed':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>;
      case 'paused':
        return <span className="px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Paused
        </span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-semibold">
          {status}
        </span>;
    }
  };

  const getAdherenceColor = (score: number) => {
    if (score >= 90) return 'from-emerald-500 to-green-600';
    if (score >= 70) return 'from-blue-500 to-cyan-600';
    if (score >= 50) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/${tenantSlug}/dashboard`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Route className="w-6 h-6 text-blue-600" />
                  My Care Pathways
                </h1>
                <p className="text-sm text-gray-600">Track your treatment progress and milestones</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your care pathways...</p>
            </div>
          </div>
        ) : pathways.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Route className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Pathways</h3>
            <p className="text-gray-600">You are not currently enrolled in any clinical care pathways.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pathways.map((pathway) => {
              const progress = pathway.total_steps > 0 ? (pathway.completed_steps / pathway.total_steps) * 100 : 0;
              
              return (
                <div key={pathway.id} className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="inline-block px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg text-xs font-semibold mb-2">
                        {pathway.specialty}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{pathway.pathway_name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{pathway.condition}</p>
                      <p className="text-sm text-gray-700">{pathway.description}</p>
                    </div>
                    <div>
                      {getStatusBadge(pathway.status)}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-semibold text-gray-700">Progress</span>
                      <span className="text-gray-600">{pathway.completed_steps} / {pathway.total_steps} steps</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${progress >= 90 ? 'from-emerald-500 to-green-600' : progress >= 50 ? 'from-blue-500 to-cyan-600' : 'from-amber-500 to-orange-600'} transition-all duration-500 flex items-center justify-end pr-1`}
                        style={{ width: `${progress}%` }}
                      >
                        {progress > 15 && (
                          <span className="text-[10px] text-white font-bold">{Math.round(progress)}%</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-gray-600 font-medium">Adherence</span>
                      </div>
                      <p className={`text-2xl font-bold bg-gradient-to-r ${getAdherenceColor(pathway.adherence_score)} bg-clip-text text-transparent`}>
                        {Math.round(pathway.adherence_score)}%
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <span className="text-xs text-gray-600 font-medium">Enrolled</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {format(new Date(pathway.enrollment_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>

                  {pathway.current_step && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border-2 border-indigo-200 mb-4">
                      <p className="text-xs font-semibold text-indigo-600 mb-1">NEXT STEP</p>
                      <p className="text-sm font-bold text-gray-900">{pathway.current_step}</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedPathway(pathway);
                      loadPathwayProgress(pathway.id);
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Eye className="w-5 h-5" />
                    View Detailed Progress
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Pathway Detail Modal */}
      {selectedPathway && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedPathway.pathway_name}</h2>
                  <p className="text-blue-100 mt-1">{selectedPathway.condition}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedPathway(null);
                    setPathwaySteps([]);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Progress Overview */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Progress</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">
                    {selectedPathway.completed_steps}/{selectedPathway.total_steps}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Steps Completed</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border-2 border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-semibold text-gray-700">Adherence</span>
                  </div>
                  <p className={`text-3xl font-bold bg-gradient-to-r ${getAdherenceColor(selectedPathway.adherence_score)} bg-clip-text text-transparent`}>
                    {Math.round(selectedPathway.adherence_score)}%
                  </p>
                  <p className="text-xs text-gray-600 mt-1">On Track</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-semibold text-gray-700">Status</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 capitalize">{selectedPathway.status}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedPathway.status === 'completed' ? 'Pathway Complete!' : 'In Progress'}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              {loadingSteps ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Route className="w-5 h-5 text-blue-600" />
                    Pathway Steps
                  </h3>
                  {pathwaySteps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`relative pl-8 pb-6 ${index === pathwaySteps.length - 1 ? '' : 'border-l-2 border-gray-200'} ml-4`}
                    >
                      {/* Step Number Badge */}
                      <div className={`absolute -left-5 top-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                        step.is_completed
                          ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                          : 'bg-gradient-to-r from-gray-400 to-gray-500'
                      }`}>
                        {step.is_completed ? <CheckCircle className="w-5 h-5" /> : step.step_number}
                      </div>

                      {/* Step Content */}
                      <div className={`ml-6 ${step.is_completed ? 'bg-emerald-50/50' : 'bg-white'} rounded-xl p-4 border-2 ${
                        step.is_completed ? 'border-emerald-200' : 'border-gray-200'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 mb-1">{step.description}</h4>
                            <p className="text-xs text-gray-600">
                              Timing: Day {Math.round(step.timing_from_start_hours / 24)} ({step.timing_from_start_hours}h from start)
                            </p>
                          </div>
                          {step.is_completed && step.completed_date && (
                            <span className="text-xs text-emerald-600 font-semibold">
                              ✓ {format(new Date(step.completed_date), 'MMM dd')}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <p className="font-semibold text-blue-900 text-xs mb-1">REQUIRED ACTIONS:</p>
                            <p className="text-gray-700">{step.required_actions}</p>
                          </div>
                          {step.decision_criteria && (
                            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                              <p className="font-semibold text-purple-900 text-xs mb-1">DECISION CRITERIA:</p>
                              <p className="text-gray-700">{step.decision_criteria}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPathwaysPage;

