import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Video,
  Calendar,
  Users,
  Activity,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Monitor,
  Heart,
  Thermometer,
  Droplet,
  Scale,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import { ehrApi } from '../services/api';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  subtitle?: string;
  accent: string;
  trend?: { value: number; label: string };
}> = ({ title, value, icon: Icon, subtitle, accent, trend }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
    <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
    <div className="relative flex items-center gap-4 p-6">
      <div className="p-3 rounded-2xl bg-black/10 text-white">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value > 0 ? (
              <TrendingUp className="w-3 h-3 text-white/80" />
            ) : (
              <TrendingDown className="w-3 h-3 text-white/80" />
            )}
            <span className="text-xs text-white/80">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const TelemedicineDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalConsultations: 0,
    todayConsultations: 0,
    activeConsultations: 0,
    completedConsultations: 0,
    pendingConsents: 0,
    activeMonitoring: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'consultations' | 'monitoring' | 'consents'>('overview');

  const token = React.useMemo(() => (typeof window === 'undefined' ? '' : localStorage.getItem('ehr_token') || ''), []);

  useEffect(() => {
    const stored = localStorage.getItem('ehr_user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!tenantSlug || !token) {
      return;
    }
    loadDashboardData();
  }, [tenantSlug, token, statusFilter]);

  const loadDashboardData = async () => {
    if (!tenantSlug || !token) return;

    setLoading(true);
    try {
      const query: any = { page: 1, limit: 50 };
      if (statusFilter !== 'all') {
        query.status = statusFilter;
      }

      const consultationsRes = await ehrApi.getTelemedicineConsultations(token, tenantSlug, query);
      const consultationsData = consultationsRes.data?.consultations || consultationsRes.data || [];

      setConsultations(consultationsData);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const todayConsultations = consultationsData.filter((c: any) => {
        const scheduledDate = new Date(c.scheduled_start_time).toISOString().split('T')[0];
        return scheduledDate === today;
      });

      setStats({
        totalConsultations: consultationsData.length,
        todayConsultations: todayConsultations.length,
        activeConsultations: consultationsData.filter((c: any) => c.status === 'in_progress').length,
        completedConsultations: consultationsData.filter((c: any) => c.status === 'completed').length,
        pendingConsents: 0, // TODO: Fetch from consent API
        activeMonitoring: 0, // TODO: Fetch from monitoring API
      });
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      showError(error?.response?.data?.message || 'Failed to load dashboard data', error?.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
      scheduled: { label: 'Scheduled', className: 'bg-blue-500/20 text-blue-300 border-blue-500/50', icon: Clock },
      waiting: { label: 'Waiting', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50', icon: Clock },
      in_progress: { label: 'In Progress', className: 'bg-green-500/20 text-green-300 border-green-500/50', icon: Video },
      completed: { label: 'Completed', className: 'bg-purple-500/20 text-purple-300 border-purple-500/50', icon: CheckCircle },
      cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-300 border-red-500/50', icon: XCircle },
      no_show: { label: 'No Show', className: 'bg-gray-500/20 text-gray-300 border-gray-500/50', icon: XCircle },
      technical_issue: { label: 'Technical Issue', className: 'bg-orange-500/20 text-orange-300 border-orange-500/50', icon: AlertCircle },
    };

    const config = statusConfig[status] || statusConfig.scheduled;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const filteredConsultations = consultations.filter((consultation) => {
    const matchesSearch =
      !searchTerm ||
      consultation.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultation.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}`)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Video className="w-7 h-7 text-purple-400" />
                  Telemedicine Platform
                </h1>
                <p className="text-sm text-white/60 mt-1">Remote consultations & patient monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Total"
            value={stats.totalConsultations}
            icon={Video}
            accent="from-blue-500 to-cyan-500"
            subtitle="Consultations"
          />
          <StatCard
            title="Today"
            value={stats.todayConsultations}
            icon={Calendar}
            accent="from-purple-500 to-pink-500"
            subtitle="Scheduled"
          />
          <StatCard
            title="Active"
            value={stats.activeConsultations}
            icon={Monitor}
            accent="from-green-500 to-emerald-500"
            subtitle="In Progress"
          />
          <StatCard
            title="Completed"
            value={stats.completedConsultations}
            icon={CheckCircle}
            accent="from-indigo-500 to-blue-500"
            subtitle="This Month"
          />
          <StatCard
            title="Consents"
            value={stats.pendingConsents}
            icon={FileText}
            accent="from-yellow-500 to-orange-500"
            subtitle="Pending"
          />
          <StatCard
            title="Monitoring"
            value={stats.activeMonitoring}
            icon={Activity}
            accent="from-red-500 to-rose-500"
            subtitle="Active Patients"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          {[
            { id: 'overview', label: 'Overview', icon: Video },
            { id: 'consultations', label: 'Consultations', icon: Calendar },
            { id: 'monitoring', label: 'Remote Monitoring', icon: Activity },
            { id: 'consents', label: 'Consents', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-purple-400 text-purple-300'
                    : 'border-transparent text-white/60 hover:text-white/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4">Recent Consultations</h2>
              {loading ? (
                <div className="text-center py-12 text-white/60">Loading...</div>
              ) : filteredConsultations.length === 0 ? (
                <div className="text-center py-12 text-white/60">No consultations found</div>
              ) : (
                <div className="space-y-3">
                  {filteredConsultations.slice(0, 5).map((consultation) => (
                    <div
                      key={consultation.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => navigate(`/ehr/${tenantSlug}/telemedicine/consultation/${consultation.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusBadge(consultation.status)}
                            <span className="text-sm text-white/60">
                              {formatDate(consultation.scheduled_start_time)}
                            </span>
                          </div>
                          <p className="font-medium">{consultation.patient_name || 'Unknown Patient'}</p>
                          <p className="text-sm text-white/60">Dr. {consultation.doctor_name || 'Unknown Doctor'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white/60 capitalize">{consultation.consultation_type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'consultations' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search consultations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="waiting">Waiting</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Consultations List */}
            <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
              {loading ? (
                <div className="text-center py-12 text-white/60">Loading...</div>
              ) : filteredConsultations.length === 0 ? (
                <div className="text-center py-12 text-white/60">No consultations found</div>
              ) : (
                <div className="space-y-3">
                  {filteredConsultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => navigate(`/ehr/${tenantSlug}/telemedicine/consultation/${consultation.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusBadge(consultation.status)}
                            <span className="text-sm text-white/60">
                              {formatDate(consultation.scheduled_start_time)}
                            </span>
                          </div>
                          <p className="font-medium">{consultation.patient_name || 'Unknown Patient'}</p>
                          <p className="text-sm text-white/60">Dr. {consultation.doctor_name || 'Unknown Doctor'}</p>
                          {consultation.notes && (
                            <p className="text-sm text-white/50 mt-2 line-clamp-2">{consultation.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white/60 capitalize mb-1">{consultation.consultation_type}</p>
                          {consultation.duration_minutes && (
                            <p className="text-xs text-white/40">{consultation.duration_minutes} min</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold mb-4">Remote Patient Monitoring</h2>
            <p className="text-white/60">Remote monitoring features coming soon...</p>
          </div>
        )}

        {activeTab === 'consents' && (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold mb-4">Consent Management</h2>
            <p className="text-white/60">Consent management features coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelemedicineDashboard;

