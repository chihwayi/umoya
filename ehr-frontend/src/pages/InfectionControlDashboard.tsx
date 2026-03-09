import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Shield, AlertTriangle, Activity, TrendingUp, Users, 
  Loader2, Calendar, BarChart3, ArrowLeft
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';

const InfectionControlDashboard: React.FC = () => {
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

  const [infections, setInfections] = useState<any[]>([]);
  const [isolations, setIsolations] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hhCompliance, setHhCompliance] = useState<any>(null);
  const [deviceRates, setDeviceRates] = useState<any>(null);
  const [hhDepartment, setHhDepartment] = useState('');
  const [hhOpportunity, setHhOpportunity] = useState('before_patient_contact');
  const [hhPerformed, setHhPerformed] = useState(true);
  const [hhMethod, setHhMethod] = useState('alcohol_rub');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load infections
      const infectionsResponse = await ehrAxios.get('/infection-control/infections', {
        params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setInfections(infectionsResponse.data || []);

      // Load HAI metrics
      const metricsResponse = await ehrAxios.get('/infection-control/metrics/hai', {
        params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setMetrics(metricsResponse.data);

      // Load active isolations
      const isolationsResponse = await ehrAxios.get('/infection-control/isolation/active', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setIsolations(isolationsResponse.data || []);

      const [hhRes, deviceRes] = await Promise.all([
        ehrAxios.get('/infection-control/hand-hygiene/compliance', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: null })),
        ehrAxios.get('/infection-control/device-days/rates', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
          headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: null })),
      ]);
      setHhCompliance(hhRes.data);
      setDeviceRates(deviceRes.data);
    } catch (error) {
      showError('Error', 'Failed to load infection control data');
    } finally {
      setLoading(false);
    }
  };

  const getInfectionColor = (type: string) => {
    switch (type) {
      case 'CAUTI': return 'from-yellow-500 to-amber-600';
      case 'CLABSI': return 'from-red-500 to-rose-600';
      case 'SSI': return 'from-orange-500 to-amber-600';
      case 'VAP': return 'from-purple-500 to-violet-600';
      case 'CDI': return 'from-pink-500 to-rose-600';
      case 'MRSA': return 'from-red-600 to-rose-700';
      case 'VRE': return 'from-orange-600 to-red-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getIsolationColor = (type: string) => {
    switch (type) {
      case 'contact': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'droplet': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'airborne': return 'bg-red-100 text-red-800 border-red-300';
      case 'protective': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading infection control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg">
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
                  <Shield className="w-8 h-8" />
                  Infection Control & Epidemiology
                </h1>
                <p className="text-green-100 mt-1">HAI surveillance & antimicrobial stewardship</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Date Range */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-200 shadow-sm">
            <Calendar className="w-5 h-5 text-green-600" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="border-0 bg-transparent focus:outline-none focus:ring-0 font-medium text-slate-900 text-sm"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="border-0 bg-transparent focus:outline-none focus:ring-0 font-medium text-slate-900 text-sm"
            />
          </div>
        </div>

        {/* HAI Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total HAI Cases</p>
                <p className="text-4xl font-bold text-red-600">{metrics.totalHAI || 0}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Device-Associated</p>
                <p className="text-4xl font-bold text-orange-600">{metrics.deviceAssociated || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Isolations</p>
                <p className="text-4xl font-bold text-yellow-600">{isolations.length}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Isolations */}
      {isolations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-600" />
            Active Isolation Precautions ({isolations.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isolations.map((isolation) => (
              <div key={isolation.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-yellow-300 shadow-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {isolation.patient?.firstName} {isolation.patient?.lastName}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {isolation.roomNumber} - {isolation.bedNumber}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getIsolationColor(isolation.isolationType)}`}>
                    {isolation.isolationType.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>Reason:</strong> {isolation.reason}
                </p>
                {isolation.organism && (
                  <p className="text-sm text-slate-700">
                    <strong>Organism:</strong> {isolation.organism}
                  </p>
                )}
                {isolation.ppeRequired && isolation.ppeRequired.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {isolation.ppeRequired.map((ppe: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-medium">
                        {ppe}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Infections */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-green-600" />
          Infection Surveillance
        </h2>
        {infections.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <Shield className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Infections Reported</h3>
            <p className="text-slate-600">No infections in selected date range</p>
          </div>
        ) : (
          <div className="space-y-3">
            {infections.map((infection) => (
              <div
                key={infection.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getInfectionColor(infection.infectionType)} rounded-xl flex items-center justify-center shadow-lg`}>
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{infection.infectionType}</h3>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-bold">
                          {infection.onsetType?.replace('_', ' ').toUpperCase()}
                        </span>
                        {infection.deviceAssociated && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-bold">
                            DEVICE-ASSOCIATED
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 mb-1">
                        <strong>Patient:</strong> {infection.patient?.firstName} {infection.patient?.lastName}
                      </p>
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>Date:</strong> {new Date(infection.infectionDate).toLocaleDateString()} 
                        {infection.daysSinceAdmission && ` (Day ${infection.daysSinceAdmission} of admission)`}
                      </p>
                      {infection.organism && (
                        <p className="text-sm text-slate-600">
                          <strong>Organism:</strong> {infection.organism}
                          {infection.cultureSource && ` (${infection.cultureSource})`}
                        </p>
                      )}
                      {infection.severity && (
                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                          infection.severity === 'septic_shock' || infection.severity === 'severe' 
                            ? 'bg-red-100 text-red-800'
                            : infection.severity === 'sepsis' || infection.severity === 'moderate'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {infection.severity.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {infection.resolved ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                      RESOLVED
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold animate-pulse">
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Hand Hygiene Compliance Panel (K4) */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-teal-600" />
            Hand Hygiene Compliance (WHO 5 Moments)
          </h2>
          {hhCompliance && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-center">
                <p className="text-2xl font-bold text-teal-700">{hhCompliance.overallRate ?? '—'}%</p>
                <p className="text-xs text-teal-600">Overall compliance</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-2xl font-bold text-slate-700">{hhCompliance.totalObservations ?? 0}</p>
                <p className="text-xs text-slate-600">Observations</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-2xl font-bold text-green-700">{hhCompliance.performedCount ?? 0}</p>
                <p className="text-xs text-green-600">Performed</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                <p className="text-2xl font-bold text-red-700">{hhCompliance.missedCount ?? 0}</p>
                <p className="text-xs text-red-600">Missed</p>
              </div>
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Record Observation</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input value={hhDepartment} onChange={(e) => setHhDepartment(e.target.value)} placeholder="Department" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
              <select value={hhOpportunity} onChange={(e) => setHhOpportunity(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <option value="before_patient_contact">Before patient contact</option>
                <option value="before_aseptic_task">Before aseptic task</option>
                <option value="after_body_fluid_exposure">After body fluid exposure</option>
                <option value="after_patient_contact">After patient contact</option>
                <option value="after_surroundings_contact">After surroundings contact</option>
              </select>
              <select value={hhMethod} onChange={(e) => setHhMethod(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <option value="alcohol_rub">Alcohol rub</option>
                <option value="soap_and_water">Soap and water</option>
                <option value="none">None</option>
              </select>
              <button
                onClick={async () => {
                  try {
                    await ehrAxios.post('/infection-control/hand-hygiene', {
                      department: hhDepartment,
                      opportunityType: hhOpportunity,
                      handHygienePerformed: hhPerformed,
                      method: hhMethod,
                    }, { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } });
                    loadData();
                  } catch { /* ignore */ }
                }}
                className="bg-teal-600 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-teal-700"
              >
                Record
              </button>
            </div>
          </div>
        </div>

        {/* Device Day Tracking Panel (K4) */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-purple-600" />
            Device-Day HAI Rates
          </h2>
          {deviceRates ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">CAUTI Rate</p>
                <p className="text-3xl font-bold text-purple-800 mt-1">{deviceRates.cautiRate ?? '—'}</p>
                <p className="text-xs text-purple-600 mt-1">per 1,000 catheter-days</p>
                <p className="text-xs text-slate-500">{deviceRates.urinaryCatheterDays ?? 0} device-days</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">CLABSI Rate</p>
                <p className="text-3xl font-bold text-red-800 mt-1">{deviceRates.clabsiRate ?? '—'}</p>
                <p className="text-xs text-red-600 mt-1">per 1,000 line-days</p>
                <p className="text-xs text-slate-500">{deviceRates.centralLineDays ?? 0} device-days</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">VAP Rate</p>
                <p className="text-3xl font-bold text-indigo-800 mt-1">{deviceRates.vapRate ?? '—'}</p>
                <p className="text-xs text-indigo-600 mt-1">per 1,000 ventilator-days</p>
                <p className="text-xs text-slate-500">{deviceRates.ventilatorDays ?? 0} device-days</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No device-day rate data available for this period.</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default InfectionControlDashboard;

