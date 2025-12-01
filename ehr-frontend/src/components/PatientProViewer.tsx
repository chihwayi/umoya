import React, { useState, useEffect } from 'react';
import { FileText, TrendingUp, Calendar, BarChart3, Eye, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface QuestionnaireHistory {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  completed_at: string;
  total_score: number;
  completion_percentage: number;
  response_count: number;
}

interface ProTrend {
  id: string;
  code?: string;
  questionnaireCode?: string;
  name?: string;
  questionnaireName?: string;
  completed_at?: string;
  completedAt?: string;
  total_score?: number;
  totalScore?: number;
  completion_percentage?: number;
  completionPercentage?: number;
}

interface PatientProViewerProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onClose?: () => void;
  className?: string;
}

const PatientProViewer: React.FC<PatientProViewerProps> = ({
  patientId,
  tenantSlug,
  token,
  onClose,
  className = '',
}) => {
  const [history, setHistory] = useState<QuestionnaireHistory[]>([]);
  const [trends, setTrends] = useState<ProTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'trends'>('history');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string>('');

  useEffect(() => {
    if (patientId) {
      loadData();
    }
  }, [patientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [historyResponse, trendsResponse] = await Promise.all([
        ehrApi.getPatientQuestionnaireHistory(patientId, token, tenantSlug, { limit: 20 }),
        ehrApi.getProTrends(patientId, token, tenantSlug, { limit: 20 }),
      ]);
      console.log('📊 PatientProViewer - History response:', historyResponse);
      console.log('📊 PatientProViewer - Trends response:', trendsResponse);
      setHistory(historyResponse.data || []);
      // Handle both camelCase and snake_case response formats
      const trendsData = trendsResponse.data || trendsResponse || [];
      console.log('📊 PatientProViewer - Processed trends data:', trendsData);
      setTrends(trendsData);
    } catch (error) {
      console.error('Failed to load PRO data:', error);
      setHistory([]);
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      mental_health: 'bg-purple-100 text-purple-800 border-purple-300',
      quality_of_life: 'bg-blue-100 text-blue-800 border-blue-300',
      symptom_tracking: 'bg-orange-100 text-orange-800 border-orange-300',
      disease_specific: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getScoreInterpretation = (code: string, score: number) => {
    if (code === 'PHQ9') {
      if (score >= 20) return { label: 'Severe Depression', color: 'text-red-600' };
      if (score >= 15) return { label: 'Moderately Severe', color: 'text-orange-600' };
      if (score >= 10) return { label: 'Moderate', color: 'text-yellow-600' };
      if (score >= 5) return { label: 'Mild', color: 'text-blue-600' };
      return { label: 'Minimal', color: 'text-green-600' };
    }
    if (code === 'GAD7') {
      if (score >= 15) return { label: 'Severe Anxiety', color: 'text-red-600' };
      if (score >= 10) return { label: 'Moderate', color: 'text-yellow-600' };
      if (score >= 5) return { label: 'Mild', color: 'text-blue-600' };
      return { label: 'Minimal', color: 'text-green-600' };
    }
    return null;
  };

  // Helper function to format date consistently
  const formatDateForChart = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return 'Invalid Date';
      }
      // Format as MM/DD/YYYY for consistent display
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Calculate unique questionnaires BEFORE chartData (needed by chartData)
  const uniqueQuestionnaires = React.useMemo(() => {
    const codes = trends.map(t => t.code || t.questionnaireCode).filter(Boolean);
    const unique = Array.from(new Set(codes));
    console.log('📊 PatientProViewer - uniqueQuestionnaires calculated:', unique, 'from trends:', trends.map(t => ({ code: t.code || t.questionnaireCode, score: t.totalScore || t.total_score })));
    return unique;
  }, [trends]);

  // Group trends by questionnaire code for charting
  const chartData = React.useMemo(() => {
    console.log('📊 PatientProViewer - Processing chartData, trends:', trends);
    console.log('📊 PatientProViewer - selectedQuestionnaire:', selectedQuestionnaire);
    
    if (trends.length === 0) {
      console.log('📊 PatientProViewer - No trends data available');
      return [];
    }
    
    if (!selectedQuestionnaire) {
      // Show all questionnaires
      const grouped: Record<string, ProTrend[]> = {};
      trends.forEach(trend => {
        const code = trend.code || trend.questionnaireCode;
        if (code) {
          if (!grouped[code]) grouped[code] = [];
          grouped[code].push(trend);
        }
      });

      // Collect ALL unique dates from ALL questionnaires
      const allDates = new Set<string>();
      trends.forEach(t => {
        const completedAt = t.completedAt || t.completed_at;
        if (completedAt) {
          const date = new Date(completedAt);
          if (!isNaN(date.getTime())) {
            // Use date-only string (YYYY-MM-DD) as key
            const dateKey = date.toISOString().split('T')[0];
            allDates.add(dateKey);
          }
        }
      });

      // Sort dates chronologically
      const sortedDateKeys = Array.from(allDates).sort();

      // Create chart data: one row per date, with scores for each questionnaire
      const result = sortedDateKeys.map(dateKey => {
        const date = new Date(dateKey + 'T00:00:00Z'); // Parse date key back to Date
        const data: any = { 
          date: formatDateForChart(date.toISOString()),
          dateKey // Keep for comparison
        };
        
        // For each questionnaire, find the score for this date
        Object.keys(grouped).forEach(code => {
          const trend = grouped[code].find(t => {
            const completedAt = t.completedAt || t.completed_at;
            if (!completedAt) return false;
            const trendDate = new Date(completedAt);
            if (isNaN(trendDate.getTime())) return false;
            const trendDateKey = trendDate.toISOString().split('T')[0];
            return trendDateKey === dateKey;
          });
          // Set score or null if no data for this date
          data[code] = trend ? (trend.totalScore || trend.total_score || null) : null;
        });
        
        return data;
      });
      
      console.log('📊 PatientProViewer - Chart data (all questionnaires):', result);
      console.log('📊 PatientProViewer - uniqueQuestionnaires:', uniqueQuestionnaires);
      console.log('📊 PatientProViewer - grouped codes:', Object.keys(grouped));
      console.log('📊 PatientProViewer - All dates:', sortedDateKeys);
      return result;
    } else {
      // Show only selected questionnaire
      const filtered = trends
        .filter(t => {
          const code = t.code || t.questionnaireCode;
          const completedAt = t.completedAt || t.completed_at;
          return code === selectedQuestionnaire && completedAt;
        })
        .map(t => {
          const completedAt = t.completedAt || t.completed_at;
          const date = new Date(completedAt);
          return {
            ...t,
            completed_at: completedAt,
            dateObj: isNaN(date.getTime()) ? null : date
          };
        })
        .filter(t => t.dateObj !== null)
        .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime())
        .map(t => ({
          date: formatDateForChart(t.completed_at),
          score: t.totalScore || t.total_score,
        }));
      console.log('📊 PatientProViewer - Chart data (selected questionnaire):', filtered);
      return filtered;
    }
  }, [trends, selectedQuestionnaire]);

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 ${className}`}>
        <p className="text-sm text-slate-500">Loading PRO data...</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-slate-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-slate-900">Patient-Reported Outcomes</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-semibold text-sm transition-colors ${
              activeTab === 'history'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            History ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 font-semibold text-sm transition-colors ${
              activeTab === 'trends'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Trends
          </button>
        </div>

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500">No completed questionnaires found</p>
              </div>
            ) : (
              history.map((item) => {
                const interpretation = getScoreInterpretation(item.code, item.total_score);
                return (
                  <div
                    key={item.id}
                    className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-900">{item.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(item.category)}`}>
                            {item.category.replace('_', ' ')}
                          </span>
                        </div>
                        {item.completed_at && (
                          <div className="flex items-center gap-1 text-sm text-slate-600 mb-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(item.completed_at).toLocaleDateString()}</span>
                          </div>
                        )}
                        {item.total_score !== null && item.total_score !== undefined && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-purple-600" />
                              <span className="font-bold text-lg text-slate-900">
                                Score: {item.total_score}
                              </span>
                            </div>
                            {interpretation && (
                              <span className={`text-sm font-semibold ${interpretation.color}`}>
                                ({interpretation.label})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-4">
            {trends.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500">No trend data available</p>
              </div>
            ) : (
              <>
                {/* Questionnaire Filter */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Filter by Questionnaire:
                  </label>
                  <select
                    value={selectedQuestionnaire}
                    onChange={(e) => setSelectedQuestionnaire(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  >
                    <option value="">All Questionnaires</option>
                    {uniqueQuestionnaires.map(code => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>

                {/* Chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {selectedQuestionnaire ? (
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#9333ea"
                          strokeWidth={2}
                          name={selectedQuestionnaire}
                        />
                      ) : (
                        uniqueQuestionnaires.map((code, idx) => {
                          const colors = ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
                          return (
                            <Line
                              key={code}
                              type="monotone"
                              dataKey={code}
                              stroke={colors[idx % colors.length]}
                              strokeWidth={2}
                              name={code}
                            />
                          );
                        })
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientProViewer;

