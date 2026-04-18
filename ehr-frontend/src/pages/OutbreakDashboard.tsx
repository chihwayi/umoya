import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Activity,
  Users,
  BarChart3,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  ChevronDown,
  Bell,
  Globe,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';
import OutbreakProtocolDashboard from '../components/outbreak/OutbreakDashboard';

// ── Helpers ────────────────────────────────────────────────────────────────────

const authHeaders = (token: string, tenantSlug: string) => ({
  'X-Tenant-ID': tenantSlug,
  Authorization: `Bearer ${token}`,
});

const getToken = () => localStorage.getItem('token') || '';

// ── Sub-components ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    suspected: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
    probable: 'bg-orange-900/40 text-orange-300 border border-orange-700/50',
    confirmed: 'bg-red-900/40 text-red-300 border border-red-700/50',
    discarded: 'bg-slate-800 text-slate-400 border border-slate-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
      {status}
    </span>
  );
};

const FollowUpBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-900/40 text-yellow-300',
    in_progress: 'bg-blue-900/40 text-blue-300',
    completed: 'bg-green-900/40 text-green-300',
    lost: 'bg-slate-800 text-slate-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-slate-800 text-slate-300'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const Stat: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({
  label, value, icon, color,
}) => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
    <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
);

// ── Types ──────────────────────────────────────────────────────────────────────

interface NotifiableDisease {
  id: string;
  diseaseName: string;
  countryCode: string;
  alertThreshold: number;
  alertWindowDays: number;
  reportWithinHours: number;
}

interface OutbreakCase {
  id: string;
  patientId: string;
  notifiableDiseaseId: string;
  diagnosisDate: string;
  onsetDate?: string;
  status: string;
  exposureLocation?: string;
  reportedToMoh: boolean;
  sormasCaseUuid?: string;
  createdAt: string;
}

interface ContactTrace {
  id: string;
  contactName: string;
  contactPhone?: string;
  contactRelationship?: string;
  exposureDate?: string;
  followUpStatus: string;
}

interface MohAlert {
  id: string;
  alertType: string;
  caseCount: number;
  windowStart: string;
  windowEnd: string;
  acknowledged: boolean;
  createdAt: string;
}

interface DashboardData {
  epidemicCurve: { day: string; count: number }[];
  activeAlerts: MohAlert[];
  casesByStatus: Record<string, number>;
}

// ── Main Component ─────────────────────────────────────────────────────────────

const OutbreakDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<'dashboard' | 'cases' | 'contacts' | 'diseases' | 'protocols'>('dashboard');
  const [loading, setLoading] = useState(false);

  // Dashboard
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Diseases
  const [diseases, setDiseases] = useState<NotifiableDisease[]>([]);
  const [showDiseaseForm, setShowDiseaseForm] = useState(false);
  const [diseaseForm, setDiseaseForm] = useState({
    diseaseName: '',
    countryCode: '',
    alertThreshold: 5,
    alertWindowDays: 7,
    reportWithinHours: 24,
  });

  // Cases
  const [cases, setCases] = useState<OutbreakCase[]>([]);
  const [caseFilter, setCaseFilter] = useState({ status: '', diseaseId: '' });
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseForm, setCaseForm] = useState({
    notifiableDiseaseId: '',
    patientId: '',
    diagnosisDate: '',
    onsetDate: '',
    status: 'suspected',
    exposureLocation: '',
    patientFirstName: '',
    patientLastName: '',
  });

  // Contacts
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [contacts, setContacts] = useState<ContactTrace[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    contactName: '',
    contactPhone: '',
    contactRelationship: '',
    exposureDate: '',
    exposureType: 'direct',
  });

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const res = await ehrAxios.get('/outbreak/dashboard', {
        headers: authHeaders(getToken(), tenantSlug),
      });
      setDashboard(res.data);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, showError]);

  const fetchDiseases = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const res = await ehrAxios.get('/outbreak/notifiable-diseases', {
        headers: authHeaders(getToken(), tenantSlug),
      });
      setDiseases(res.data);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load diseases');
    }
  }, [tenantSlug, showError]);

  const fetchCases = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (caseFilter.status) params.status = caseFilter.status;
      if (caseFilter.diseaseId) params.diseaseId = caseFilter.diseaseId;
      const res = await ehrAxios.get('/outbreak/cases', {
        headers: authHeaders(getToken(), tenantSlug),
        params,
      });
      const body = res.data;
      setCases(body.data ?? body);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, caseFilter, showError]);

  const fetchContacts = useCallback(async () => {
    if (!tenantSlug || !selectedCaseId) return;
    try {
      const res = await ehrAxios.get(`/outbreak/cases/${selectedCaseId}/contacts`, {
        headers: authHeaders(getToken(), tenantSlug),
      });
      setContacts(res.data);
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to load contacts');
    }
  }, [tenantSlug, selectedCaseId, showError]);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchDashboard();
    fetchDiseases();
  }, [fetchDashboard, fetchDiseases]);

  useEffect(() => {
    if (tab === 'cases') fetchCases();
  }, [tab, fetchCases]);

  useEffect(() => {
    if (tab === 'contacts' && selectedCaseId) fetchContacts();
  }, [tab, selectedCaseId, fetchContacts]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAcknowledge = async (alertId: string) => {
    if (!tenantSlug) return;
    try {
      await ehrAxios.post(`/outbreak/alerts/${alertId}/acknowledge`, {}, {
        headers: authHeaders(getToken(), tenantSlug),
      });
      showSuccess('Alert Acknowledged', 'MOH alert has been acknowledged');
      fetchDashboard();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to acknowledge alert');
    }
  };

  const handleSaveDisease = async () => {
    if (!tenantSlug) return;
    if (!diseaseForm.diseaseName || !diseaseForm.countryCode) {
      showError('Validation', 'Disease name and country code are required');
      return;
    }
    try {
      await ehrAxios.post('/outbreak/notifiable-diseases', diseaseForm, {
        headers: authHeaders(getToken(), tenantSlug),
      });
      showSuccess('Disease Saved', `${diseaseForm.diseaseName} added to notifiable list`);
      setShowDiseaseForm(false);
      setDiseaseForm({ diseaseName: '', countryCode: '', alertThreshold: 5, alertWindowDays: 7, reportWithinHours: 24 });
      fetchDiseases();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to save disease');
    }
  };

  const handleRegisterCase = async () => {
    if (!tenantSlug) return;
    if (!caseForm.notifiableDiseaseId || !caseForm.patientId || !caseForm.diagnosisDate) {
      showError('Validation', 'Disease, patient ID, and diagnosis date are required');
      return;
    }
    try {
      await ehrAxios.post('/outbreak/cases', caseForm, {
        headers: authHeaders(getToken(), tenantSlug),
      });
      showSuccess('Case Registered', 'Outbreak case registered and threshold check queued');
      setShowCaseForm(false);
      setCaseForm({ notifiableDiseaseId: '', patientId: '', diagnosisDate: '', onsetDate: '', status: 'suspected', exposureLocation: '', patientFirstName: '', patientLastName: '' });
      fetchCases();
      fetchDashboard();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to register case');
    }
  };

  const handleAddContact = async () => {
    if (!tenantSlug || !selectedCaseId) return;
    if (!contactForm.contactName) {
      showError('Validation', 'Contact name is required');
      return;
    }
    try {
      await ehrAxios.post(`/outbreak/cases/${selectedCaseId}/contacts`, contactForm, {
        headers: authHeaders(getToken(), tenantSlug),
      });
      showSuccess('Contact Added', 'Contact added to tracing list');
      setShowContactForm(false);
      setContactForm({ contactName: '', contactPhone: '', contactRelationship: '', exposureDate: '', exposureType: 'direct' });
      fetchContacts();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to add contact');
    }
  };

  const handleFollowUpUpdate = async (contactId: string, followUpStatus: string) => {
    if (!tenantSlug) return;
    try {
      await ehrAxios.patch(`/outbreak/contacts/${contactId}/follow-up`, { followUpStatus, lastFollowUpDate: new Date().toISOString().slice(0, 10) }, {
        headers: authHeaders(getToken(), tenantSlug),
      });
      showSuccess('Follow-up Updated', 'Contact follow-up status updated');
      fetchContacts();
    } catch (e: any) {
      showError('Error', e?.response?.data?.message || 'Failed to update follow-up');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const totalCases = dashboard
    ? Object.values(dashboard.casesByStatus).reduce((a, b) => a + b, 0)
    : 0;
  const confirmedCases = dashboard?.casesByStatus?.confirmed ?? 0;
  const activeAlerts = dashboard?.activeAlerts?.length ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Outbreak Surveillance</h1>
              <p className="text-xs text-slate-400">Notifiable Disease Monitoring & SORMAS Integration</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => { fetchDashboard(); fetchDiseases(); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit">
          {(['dashboard', 'cases', 'contacts', 'diseases', 'protocols'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-red-500/20 text-red-300 border border-red-700/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'diseases' ? 'Notifiable Diseases' : (t === 'protocols' ? 'Protocols (S151)' : t.charAt(0).toUpperCase() + t.slice(1))}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── DASHBOARD TAB ── */}
        {tab === 'dashboard' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Total Cases" value={totalCases} icon={<Users className="w-5 h-5 text-blue-400" />} color="bg-blue-500/10" />
              <Stat label="Confirmed" value={confirmedCases} icon={<AlertTriangle className="w-5 h-5 text-red-400" />} color="bg-red-500/10" />
              <Stat label="Active Alerts" value={activeAlerts} icon={<Bell className="w-5 h-5 text-orange-400" />} color="bg-orange-500/10" />
              <Stat label="Diseases Tracked" value={diseases.length} icon={<Globe className="w-5 h-5 text-green-400" />} color="bg-green-500/10" />
            </div>

            {/* Epidemic Curve */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-red-400" />
                Epidemic Curve — Last 30 Days
              </h2>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                </div>
              ) : dashboard && dashboard.epidemicCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dashboard.epidemicCurve} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                      labelStyle={{ color: '#94a3b8' }}
                      itemStyle={{ color: '#f87171' }}
                    />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-500 py-12 text-sm">No cases reported in the last 30 days</p>
              )}
            </div>

            {/* Active Alerts */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-400" />
                Active MOH Alerts
              </h2>
              {dashboard?.activeAlerts && dashboard.activeAlerts.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.activeAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between bg-orange-900/10 border border-orange-800/30 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm text-orange-200 font-medium">
                          {alert.alertType === 'threshold' ? 'Threshold Exceeded' : alert.alertType}
                          {alert.caseCount ? ` — ${alert.caseCount} cases` : ''}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Window: {alert.windowStart} → {alert.windowEnd}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        Acknowledge
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-6">No active alerts</p>
              )}
            </div>

            {/* Status breakdown */}
            {dashboard && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['suspected', 'probable', 'confirmed', 'discarded'] as const).map((s) => (
                  <div key={s} className="bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-white">{dashboard.casesByStatus[s] ?? 0}</p>
                    <p className="text-xs text-slate-400 capitalize mt-1">{s}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CASES TAB ── */}
        {tab === 'cases' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <select
                  value={caseFilter.status}
                  onChange={(e) => setCaseFilter({ ...caseFilter, status: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="">All statuses</option>
                  <option value="suspected">Suspected</option>
                  <option value="probable">Probable</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="discarded">Discarded</option>
                </select>
                <select
                  value={caseFilter.diseaseId}
                  onChange={(e) => setCaseFilter({ ...caseFilter, diseaseId: e.target.value })}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="">All diseases</option>
                  {diseases.map((d) => (
                    <option key={d.id} value={d.id}>{d.diseaseName}</option>
                  ))}
                </select>
                <button
                  onClick={fetchCases}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" /> Filter
                </button>
              </div>
              <button
                onClick={() => setShowCaseForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-700/40 rounded-lg text-sm text-red-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Register Case
              </button>
            </div>

            {/* Register case form */}
            {showCaseForm && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200">Register Outbreak Case</h3>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={caseForm.notifiableDiseaseId}
                    onChange={(e) => setCaseForm({ ...caseForm, notifiableDiseaseId: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 col-span-2"
                  >
                    <option value="">Select notifiable disease *</option>
                    {diseases.map((d) => <option key={d.id} value={d.id}>{d.diseaseName}</option>)}
                  </select>
                  <input
                    placeholder="Patient ID *"
                    value={caseForm.patientId}
                    onChange={(e) => setCaseForm({ ...caseForm, patientId: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <input
                    placeholder="Patient First Name"
                    value={caseForm.patientFirstName}
                    onChange={(e) => setCaseForm({ ...caseForm, patientFirstName: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <input
                    placeholder="Patient Last Name"
                    value={caseForm.patientLastName}
                    onChange={(e) => setCaseForm({ ...caseForm, patientLastName: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Diagnosis Date *</label>
                    <input
                      type="date"
                      value={caseForm.diagnosisDate}
                      onChange={(e) => setCaseForm({ ...caseForm, diagnosisDate: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Onset Date</label>
                    <input
                      type="date"
                      value={caseForm.onsetDate}
                      onChange={(e) => setCaseForm({ ...caseForm, onsetDate: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                  <select
                    value={caseForm.status}
                    onChange={(e) => setCaseForm({ ...caseForm, status: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="suspected">Suspected</option>
                    <option value="probable">Probable</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="discarded">Discarded</option>
                  </select>
                  <input
                    placeholder="Exposure location"
                    value={caseForm.exposureLocation}
                    onChange={(e) => setCaseForm({ ...caseForm, exposureLocation: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleRegisterCase} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-700/40 rounded-lg text-sm text-red-300 transition-colors">
                    Register
                  </button>
                  <button onClick={() => setShowCaseForm(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Case list */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Patient ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Diagnosis Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Reported to MOH</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">SORMAS UUID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10">
                        <Loader2 className="w-5 h-5 text-slate-500 animate-spin inline-block" />
                      </td>
                    </tr>
                  ) : cases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">No cases found</td>
                    </tr>
                  ) : cases.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-200 font-mono text-xs">{c.patientId}</td>
                      <td className="px-4 py-3 text-slate-300">{c.diagnosisDate}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3">
                        {c.reportedToMoh
                          ? <CheckCircle className="w-4 h-4 text-green-400" />
                          : <Clock className="w-4 h-4 text-slate-600" />}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[120px]">
                        {c.sormasCaseUuid ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setSelectedCaseId(c.id); setTab('contacts'); }}
                          className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                          Trace contacts
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── CONTACTS TAB ── */}
        {tab === 'contacts' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400">Index Case ID:</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                  <option value="">Select a case</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.patientId} — {c.diagnosisDate}</option>
                  ))}
                </select>
                {selectedCaseId && (
                  <button onClick={fetchContacts} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                    Load
                  </button>
                )}
              </div>
              {selectedCaseId && (
                <button
                  onClick={() => setShowContactForm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-700/40 rounded-lg text-sm text-blue-300 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
              )}
            </div>

            {/* Add contact form */}
            {showContactForm && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200">Add Contact</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Contact Name *"
                    value={contactForm.contactName}
                    onChange={(e) => setContactForm({ ...contactForm, contactName: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <input
                    placeholder="Phone"
                    value={contactForm.contactPhone}
                    onChange={(e) => setContactForm({ ...contactForm, contactPhone: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <input
                    placeholder="Relationship"
                    value={contactForm.contactRelationship}
                    onChange={(e) => setContactForm({ ...contactForm, contactRelationship: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Exposure Date</label>
                    <input
                      type="date"
                      value={contactForm.exposureDate}
                      onChange={(e) => setContactForm({ ...contactForm, exposureDate: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                  <select
                    value={contactForm.exposureType}
                    onChange={(e) => setContactForm({ ...contactForm, exposureType: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="direct">Direct contact</option>
                    <option value="indirect">Indirect contact</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddContact} className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-700/40 rounded-lg text-sm text-blue-300 transition-colors">
                    Add
                  </button>
                  <button onClick={() => setShowContactForm(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Contact list */}
            {selectedCaseId ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Phone</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Relationship</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Exposure Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Follow-up</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500">No contacts traced yet</td>
                      </tr>
                    ) : contacts.map((ct) => (
                      <tr key={ct.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-slate-200">{ct.contactName}</td>
                        <td className="px-4 py-3 text-slate-400">{ct.contactPhone ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{ct.contactRelationship ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{ct.exposureDate ?? '—'}</td>
                        <td className="px-4 py-3"><FollowUpBadge status={ct.followUpStatus} /></td>
                        <td className="px-4 py-3">
                          <select
                            value={ct.followUpStatus}
                            onChange={(e) => handleFollowUpUpdate(ct.id, e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="lost">Lost to follow-up</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">Select an index case to view contacts</p>
            )}
          </>
        )}

        {/* ── DISEASES TAB ── */}
        {tab === 'diseases' && (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowDiseaseForm(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-700/40 rounded-lg text-sm text-green-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Disease
              </button>
            </div>

            {showDiseaseForm && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200">Add Notifiable Disease</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Disease name *"
                    value={diseaseForm.diseaseName}
                    onChange={(e) => setDiseaseForm({ ...diseaseForm, diseaseName: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <input
                    placeholder="Country code (e.g. KE) *"
                    maxLength={3}
                    value={diseaseForm.countryCode}
                    onChange={(e) => setDiseaseForm({ ...diseaseForm, countryCode: e.target.value.toUpperCase() })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Alert threshold (cases)</label>
                    <input
                      type="number"
                      min={1}
                      value={diseaseForm.alertThreshold}
                      onChange={(e) => setDiseaseForm({ ...diseaseForm, alertThreshold: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Alert window (days)</label>
                    <input
                      type="number"
                      min={1}
                      value={diseaseForm.alertWindowDays}
                      onChange={(e) => setDiseaseForm({ ...diseaseForm, alertWindowDays: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Report within (hours)</label>
                    <input
                      type="number"
                      min={1}
                      value={diseaseForm.reportWithinHours}
                      onChange={(e) => setDiseaseForm({ ...diseaseForm, reportWithinHours: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveDisease} className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-700/40 rounded-lg text-sm text-green-300 transition-colors">
                    Save
                  </button>
                  <button onClick={() => setShowDiseaseForm(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Disease</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Country</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Threshold</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Window (days)</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Report within</th>
                  </tr>
                </thead>
                <tbody>
                  {diseases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-500">No notifiable diseases configured</td>
                    </tr>
                  ) : diseases.map((d) => (
                    <tr key={d.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-200 font-medium">{d.diseaseName}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300">{d.countryCode}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{d.alertThreshold} cases</td>
                      <td className="px-4 py-3 text-slate-300">{d.alertWindowDays}d</td>
                      <td className="px-4 py-3 text-slate-300">{d.reportWithinHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── PROTOCOLS TAB (S151) ── */}
        {tab === 'protocols' && (
          <OutbreakProtocolDashboard />
        )}
      </div>
    </div>
  );
};

export default OutbreakDashboard;
