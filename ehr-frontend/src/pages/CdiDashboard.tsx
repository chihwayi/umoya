import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, TrendingUp, MessageSquare, CheckCircle, Clock, Loader2, ArrowLeft } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

const CdiDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [metrics, setMetrics] = useState<any>(null);
  const [openQueries, setOpenQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const metricsResponse = await ehrAxios.get('/cdi/metrics', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setMetrics(metricsResponse.data);

      if (currentUser.role === 'doctor') {
        const queriesResponse = await ehrAxios.get(`/cdi/queries/physician/${currentUser.id}`, {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        });
        setOpenQueries(queriesResponse.data || []);
      }
    } catch (error) {
      showError('Error', 'Failed to load CDI data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading CDI dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
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
                  <FileText className="w-8 h-8" />
                  Clinical Documentation Improvement
                </h1>
                <p className="text-blue-100 mt-1">Physician queries & DRG optimization</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Queries</p>
                <p className="text-4xl font-bold text-blue-600">{metrics.total_queries || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Answered</p>
                <p className="text-4xl font-bold text-green-600">{metrics.answered_queries || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">DRG Changes</p>
                <p className="text-4xl font-bold text-purple-600">{metrics.drg_changes || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Revenue Impact</p>
                <p className="text-3xl font-bold text-green-600">
                  ${((metrics.total_impact || 0) / 1000).toFixed(1)}K
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      )}

      {currentUser.role === 'doctor' && openQueries.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Your Open Queries ({openQueries.length})
          </h2>
          <div className="space-y-3">
            {openQueries.map((query) => (
              <div key={query.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-blue-300 shadow-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {query.patient_first_name} {query.patient_last_name}
                    </h3>
                    <p className="text-sm text-slate-600">Query #{query.query_number}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    query.priority === 'stat' ? 'bg-red-100 text-red-800' :
                    query.priority === 'urgent' ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {query.priority?.toUpperCase()}
                  </span>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 mb-3">
                  <p className="text-sm text-slate-700"><strong>Query:</strong> {query.query_text}</p>
                </div>
                {query.clinical_indicators && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-slate-600"><strong>Clinical Indicators:</strong></p>
                    <p className="text-sm text-slate-700">{query.clinical_indicators}</p>
                  </div>
                )}
                {query.financial_impact && (
                  <p className="text-sm text-green-600 font-semibold">
                    Potential Impact: ${parseFloat(query.financial_impact).toFixed(2)}
                  </p>
                )}
                <button className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition">
                  Answer Query
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentUser.role !== 'doctor' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">CDI Dashboard</h3>
          <p className="text-slate-600">View CDI metrics and physician query workflows</p>
        </div>
        )}
      </div>
    </div>
  );
};

export default CdiDashboard;

