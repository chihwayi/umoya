import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Activity, Clock, TrendingUp, Loader2, ArrowLeft, Brain, BookOpen, Search } from 'lucide-react';
import axios from 'axios';
import { cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

const SepsisDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [guidelineResults, setGuidelineResults] = useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      const response = await cdssApi.searchGuidelines(guidelineQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [alertsRes, complianceRes] = await Promise.all([
        ehrAxios.get('/sepsis/alerts', {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }),
        ehrAxios.get('/sepsis/compliance', {
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }),
      ]);
      setAlerts(alertsRes.data || []);
      setCompliance(complianceRes.data);
    } catch (error) {
      showError('Error', 'Failed to load sepsis data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8" />
                  Sepsis Management & SEP-1 Bundle
                </h1>
                <p className="text-orange-100 mt-1">Early detection & bundle compliance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {compliance && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-600 mb-1">Total Bundles</p>
            <p className="text-4xl font-bold text-red-600">{compliance.total_bundles || 0}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-600 mb-1">3-Hour Compliance</p>
            <p className="text-4xl font-bold text-orange-600">
              {compliance.total_bundles > 0 ? Math.round((compliance.three_hour_compliant / compliance.total_bundles) * 100) : 0}%
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-600 mb-1">Overall Compliance</p>
            <p className="text-4xl font-bold text-green-600">
              {compliance.total_bundles > 0 ? Math.round((compliance.overall_compliant / compliance.total_bundles) * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* AI Guideline Search Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Brain className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Sepsis Protocols & Guidelines</h3>
              <p className="text-sm text-slate-500">AI-powered search for SEP-1 and resuscitation standards</p>
            </div>
          </div>
          <button
            onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
            className="text-sm text-red-600 font-medium hover:text-red-700"
          >
            {showGuidelineSearch ? 'Hide Search' : 'Search Protocols'}
          </button>
        </div>

        {showGuidelineSearch && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={guidelineQuery}
                  onChange={(e) => setGuidelineQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                  placeholder="Search e.g. '3-hour bundle', 'Fluid resuscitation', 'Antibiotic timing'..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines || !guidelineQuery.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loadingGuidelines ? 'Searching...' : 'Search'}
              </button>
            </div>

            {guidelineResults.length > 0 && (
              <div className="grid gap-3">
                {guidelineResults.slice(0, 2).map((result, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start gap-3">
                      <BookOpen className="w-5 h-5 text-red-600 mt-1 shrink-0" />
                      <div>
                        <h4 className="font-medium text-slate-900">{result.source}</h4>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{result.text}</p>
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-2 text-xs text-red-600 hover:underline"
                          >
                            View Source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-3">Sepsis Alerts (Last 24h)</h2>
      {alerts.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center">
          <Activity className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Sepsis Alerts</h3>
          <p className="text-slate-600">All patients screened negative</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-red-300 shadow-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900">{alert.first_name} {alert.last_name}</h3>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold animate-pulse">
                  SEPSIS SUSPECTED
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><strong>Location:</strong> {alert.ward_name} - Bed {alert.bed_number}</div>
                <div><strong>qSOFA:</strong> {alert.qsofa_score}/3</div>
                <div><strong>SIRS:</strong> {alert.sirs_score}/4</div>
                <div><strong>Lactate:</strong> {alert.lactate} mmol/L</div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};

export default SepsisDashboard;

