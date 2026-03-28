import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import {
  FileText, CheckCircle, Clock, AlertCircle, ArrowRight, Calendar, TrendingUp, ArrowLeft, BarChart3, Repeat
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Questionnaire {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  status: string;
  assigned_at: string;
  due_date?: string;
  completed_at?: string;
  completion_percentage: number;
  questions?: any[];
}

const QuestionnairesPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showInfo, showError } = useNotification();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedQuestionnaireCode, setSelectedQuestionnaireCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'available' | 'history' | 'trends' | 'schedules'>('pending');

  const location = useLocation();

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload data when navigating back to this page (e.g., after submitting a questionnaire)
  useEffect(() => {
    if (location.pathname.includes('/questionnaires') && !location.pathname.includes('/questionnaires/')) {
      loadData();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'trends') {
      loadTrends(selectedQuestionnaireCode);
    } else if (activeTab === 'schedules') {
      loadSchedules();
    }
  }, [activeTab, selectedQuestionnaireCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrends = async (questionnaireCode?: string) => {
    try {
      const trendsData = await patientPortalApi.getProTrends(token!, tenantSlug, {
        questionnaireCode: questionnaireCode || undefined,
        limit: 50,
      });
      setTrends(Array.isArray(trendsData) ? trendsData : []);
    } catch (err: any) {
      console.error('Error loading trends:', err);
      showError('Failed to load trends', err.message || 'Please try again later');
    }
  };

  const loadSchedules = async () => {
    try {
      const schedulesData = await patientPortalApi.getQuestionnaireSchedules(token!, tenantSlug);
      setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
    } catch (err: any) {
      console.error('Error loading schedules:', err);
      showError('Failed to load schedules', err.message || 'Please try again later');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load pending questionnaires
      const pendingData = await patientPortalApi.getPendingQuestionnaires(token!, tenantSlug);
      setQuestionnaires(Array.isArray(pendingData) ? pendingData : (pendingData?.questionnaires || []));

      // Load available templates
      const availableData = await patientPortalApi.getAvailableQuestionnaires(token!, tenantSlug);
      setAvailableTemplates(Array.isArray(availableData?.templates) ? availableData.templates : []);

      // Load history
      const historyData = await patientPortalApi.getQuestionnaireHistory(token!, tenantSlug, { limit: 50 });
      setHistory(Array.isArray(historyData) ? historyData : []);

      // Load trends (will be loaded when trends tab is selected)
    } catch (err: any) {
      console.error('Error loading questionnaires:', err);
      setError(err.message || 'Failed to load questionnaires');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'mental_health':
        return 'bg-purple-100 text-purple-800';
      case 'quality_of_life':
        return 'bg-blue-100 text-blue-800';
      case 'disease_specific':
        return 'bg-orange-100 text-orange-800';
      case 'symptom_tracking':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading questionnaires...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Health Questionnaires</h1>
              <p className="text-gray-600 mt-1">Complete assessments to help your care team understand your health</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'pending'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending ({questionnaires.length})
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'available'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Available ({availableTemplates.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'history'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              History ({history.length})
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'trends'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Trends
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'schedules'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Schedules ({schedules.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {questionnaires.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pending Questionnaires</h3>
                <p className="text-gray-600">You're all caught up! Check the "Available" tab to see other questionnaires you can complete.</p>
              </div>
            ) : (
              questionnaires.map((q) => (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{q.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(q.category)}`}>
                          {q.category.replace('_', ' ')}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(q.status)}`}>
                          {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                        </span>
                      </div>
                      {q.description && <p className="text-gray-600 text-sm mb-3">{q.description}</p>}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {q.assigned_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Assigned: {format(new Date(q.assigned_at), 'MMM dd, yyyy')}</span>
                          </div>
                        )}
                        {q.due_date && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Due: {format(new Date(q.due_date), 'MMM dd, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {q.status === 'in_progress' && q.completion_percentage > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-semibold text-gray-900">{q.completion_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${q.completion_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <Link
                    to={`/${tenantSlug}/questionnaires/${q.id}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl"
                  >
                    {q.status === 'completed' ? 'View Results' : q.status === 'in_progress' ? 'Continue' : 'Start'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {/* Available Tab */}
        {activeTab === 'available' && (
          <div className="space-y-4">
            {availableTemplates.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Available Questionnaires</h3>
                <p className="text-gray-600">Check back later for new questionnaires.</p>
              </div>
            ) : (
              availableTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{template.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(template.category)}`}>
                          {template.category.replace('_', ' ')}
                        </span>
                      </div>
                      {template.description && <p className="text-gray-600 text-sm mb-3">{template.description}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          // Request assignment (this would typically be done by doctor, but we can allow patient-initiated)
                          // For now, just navigate to a page where they can request it
                          showInfo('Questionnaire Request', 'Please contact your care team to assign this questionnaire, or it will be automatically assigned when needed.');
                        } catch (err: any) {
                          showError('Error', err.message || 'Failed to request questionnaire');
                        }
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold"
                    >
                      Request
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Questionnaire History</h3>
                <p className="text-gray-600">Your completed questionnaires will appear here.</p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{item.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(item.category)}`}>
                          {item.category.replace('_', ' ')}
                        </span>
                        {item.status === 'completed' && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                            Completed
                          </span>
                        )}
                      </div>
                      {item.completed_at && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <CheckCircle className="w-4 h-4" />
                          <span>Completed: {format(new Date(item.completed_at), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                      )}
                      {item.total_score !== null && item.total_score !== undefined && (
                        <div className="mt-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-semibold text-gray-900">Score: {item.total_score}</span>
                        </div>
                      )}
                    </div>
                    <Link
                      to={`/${tenantSlug}/questionnaires/${item.id}`}
                      className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-sm font-semibold"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {/* Filter */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Questionnaire</label>
              <select
                value={selectedQuestionnaireCode}
                onChange={(e) => {
                  setSelectedQuestionnaireCode(e.target.value);
                  loadTrends(e.target.value);
                }}
                className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="">All Questionnaires</option>
                {Array.from(new Set(trends.map((t) => t.questionnaireCode))).map((code) => {
                  const trend = trends.find((t) => t.questionnaireCode === code);
                  return (
                    <option key={code} value={code}>
                      {trend?.questionnaireName || code}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Trends Chart */}
            {trends.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Trend Data Available</h3>
                <p className="text-gray-600">Complete questionnaires to see your health trends over time.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-6">PRO Score Trends</h3>
                <ResponsiveContainer width="100%" height={400}>
                  {(() => {
                    // Filter trends if a specific questionnaire is selected
                    const filteredTrends = selectedQuestionnaireCode
                      ? trends.filter(t => (t.questionnaireCode || t.code) === selectedQuestionnaireCode)
                      : trends;

                    if (selectedQuestionnaireCode) {
                      // Single questionnaire selected - simple line chart
                      const chartData = filteredTrends
                        .map(t => ({
                          date: format(new Date(t.completedAt || t.completed_at), 'MMM dd'),
                          score: t.totalScore || t.total_score,
                          questionnaire: t.questionnaireName || t.questionnaireCode || t.code,
                        }))
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                      const trend = filteredTrends[0];
                      const name = trend?.questionnaireName || selectedQuestionnaireCode;

                      return (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                            label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb', 
                              borderRadius: '8px',
                              padding: '12px'
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#9333ea"
                            strokeWidth={2}
                            dot={{ fill: '#9333ea', r: 4 }}
                            activeDot={{ r: 6 }}
                            name={name}
                          />
                        </LineChart>
                      );
                    } else {
                      // All questionnaires - multiple lines
                      const grouped: Record<string, typeof trends> = {};
                      filteredTrends.forEach(t => {
                        const code = t.questionnaireCode || t.code;
                        if (code) {
                          if (!grouped[code]) grouped[code] = [];
                          grouped[code].push(t);
                        }
                      });

                      // Collect all unique dates
                      const allDates = new Set<string>();
                      filteredTrends.forEach(t => {
                        const date = t.completedAt || t.completed_at;
                        if (date) {
                          const dateKey = format(new Date(date), 'yyyy-MM-dd');
                          allDates.add(dateKey);
                        }
                      });

                      // Sort dates chronologically
                      const sortedDates = Array.from(allDates).sort();

                      // Create chart data: one row per date, with scores for each questionnaire
                      const chartData = sortedDates.map(dateKey => {
                        const date = new Date(dateKey + 'T00:00:00Z');
                        const data: any = {
                          date: format(date, 'MMM dd'),
                          dateKey
                        };
                        
                        // For each questionnaire, find the score for this date
                        Object.keys(grouped).forEach(code => {
                          const trend = grouped[code].find(t => {
                            const completedAt = t.completedAt || t.completed_at;
                            if (!completedAt) return false;
                            const trendDateKey = format(new Date(completedAt), 'yyyy-MM-dd');
                            return trendDateKey === dateKey;
                          });
                          const score = trend ? (trend.totalScore || trend.total_score || null) : null;
                          data[code] = score;
                        });
                        
                        return data;
                      });

                      const questionnaireCodes = Object.keys(grouped);
                      const colors = ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

                      return (
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                            label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb', 
                              borderRadius: '8px',
                              padding: '12px'
                            }}
                          />
                          <Legend />
                          {questionnaireCodes.map((code, idx) => {
                            const trend = grouped[code][0];
                            const name = trend?.questionnaireName || code;
                            return (
                              <Line
                                key={code}
                                type="monotone"
                                dataKey={code}
                                stroke={colors[idx % colors.length]}
                                strokeWidth={2}
                                dot={{ fill: colors[idx % colors.length], r: 4 }}
                                activeDot={{ r: 6 }}
                                name={name}
                                connectNulls={false}
                              />
                            );
                          })}
                        </LineChart>
                      );
                    }
                  })()}
                </ResponsiveContainer>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 font-semibold mb-1">Total Completed</p>
                    <p className="text-2xl font-bold text-purple-900">{trends.length}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-semibold mb-1">Average Score</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {(() => {
                        const validScores = trends
                          .map(t => t.totalScore || t.total_score)
                          .filter(score => score !== null && score !== undefined && !isNaN(Number(score)))
                          .map(score => Number(score));
                        if (validScores.length === 0) return 'N/A';
                        const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
                        return isNaN(average) ? 'N/A' : average.toFixed(1);
                      })()}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-semibold mb-1">Latest Score</p>
                    <p className="text-2xl font-bold text-green-900">
                      {trends.length > 0 ? (trends[0].totalScore || trends[0].total_score || 'N/A') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schedules Tab */}
        {activeTab === 'schedules' && (
          <div className="space-y-4">
            {schedules.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scheduled Questionnaires</h3>
                <p className="text-gray-600">
                  Your care team hasn't set up any scheduled questionnaires yet. Questionnaires will appear here when they are scheduled.
                </p>
              </div>
            ) : (
              schedules.map((schedule: any) => {
                const getScheduleTypeLabel = (type: string) => {
                  switch (type) {
                    case 'one_time':
                      return 'One Time';
                    case 'daily':
                      return 'Daily';
                    case 'weekly':
                      return 'Weekly';
                    case 'monthly':
                      return 'Monthly';
                    case 'event_triggered':
                      return 'Event Triggered';
                    default:
                      return type;
                  }
                };

                const getScheduleDescription = (sched: any) => {
                  switch (sched.schedule_type) {
                    case 'daily':
                      return `Every ${sched.frequency} day(s)`;
                    case 'weekly':
                      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      return `Every ${sched.frequency} week(s) on ${days[sched.day_of_week || 0]}`;
                    case 'monthly':
                      return `Every ${sched.frequency} month(s) on day ${sched.day_of_month}`;
                    case 'one_time':
                      return `One time on ${format(new Date(sched.start_date), 'MMM dd, yyyy')}`;
                    case 'event_triggered':
                      return `Triggered by: ${sched.trigger_event || 'Event'}`;
                    default:
                      return '';
                  }
                };

                return (
                  <div
                    key={schedule.id}
                    className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{schedule.questionnaire_name}</h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              schedule.is_active
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : 'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}
                          >
                            {schedule.is_active ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              'Inactive'
                            )}
                          </span>
                        </div>
                        {schedule.questionnaire_description && (
                          <p className="text-gray-600 text-sm mb-3">{schedule.questionnaire_description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Repeat className="w-4 h-4" />
                            <span className="font-semibold">{getScheduleTypeLabel(schedule.schedule_type || 'one_time')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{getScheduleDescription(schedule)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Starts: {format(new Date(schedule.start_date), 'MMM dd, yyyy')}
                              {schedule.end_date && ` - Ends: ${format(new Date(schedule.end_date), 'MMM dd, yyyy')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionnairesPage;

