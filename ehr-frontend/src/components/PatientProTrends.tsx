import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface PatientProTrendsProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  questionnaireCode?: string;
}

const PatientProTrends: React.FC<PatientProTrendsProps> = ({ patientId, tenantSlug, token, questionnaireCode }) => {
  const { showError } = useNotification();
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrends();
  }, [patientId, questionnaireCode]);

  const loadTrends = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getProTrends(patientId, token, tenantSlug, {
        questionnaireCode,
        limit: 20,
      });
      setTrends(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error('Error loading PRO trends:', err);
      showError('Failed to load PRO trends', err.message || 'Please try again later');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading PRO trends...</p>
          </div>
        </div>
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          PRO Score Trends
        </h3>
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No PRO data available for this patient</p>
        </div>
      </div>
    );
  }

  const chartData = trends.map((t) => ({
    date: format(new Date(t.completedAt), 'MMM dd'),
    score: t.totalScore,
    questionnaire: t.questionnaireName,
    fullDate: t.completedAt,
  }));

  // Group by questionnaire if multiple
  const questionnaires = Array.from(new Set(trends.map((t) => t.questionnaireCode)));

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        PRO Score Trends
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: any, name: string, props: any) => [
              `${value} (${props.payload.questionnaire})`,
              'Score'
            ]}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            dot={{ fill: '#8b5cf6', r: 4 }}
            activeDot={{ r: 6 }}
            name="PRO Score"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-600 font-semibold mb-1">Total Completed</p>
          <p className="text-2xl font-bold text-purple-900">{trends.length}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-600 font-semibold mb-1">Average Score</p>
          <p className="text-2xl font-bold text-blue-900">
            {trends.length > 0
              ? (trends.reduce((sum, t) => sum + (t.totalScore || 0), 0) / trends.length).toFixed(1)
              : '0'}
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-600 font-semibold mb-1">Latest Score</p>
          <p className="text-2xl font-bold text-green-900">
            {trends.length > 0 ? trends[0].totalScore || 'N/A' : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientProTrends;

