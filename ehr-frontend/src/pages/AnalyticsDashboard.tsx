import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  DollarSign,
  ClipboardList,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  Settings,
  Play,
  Pause,
  Edit,
  Trash2,
  Eye,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { analyticsApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import ReportTemplateForm from '../components/ReportTemplateForm';
import ScheduleConfigForm from '../components/ScheduleConfigForm';
import OutcomeRecordingForm from '../components/OutcomeRecordingForm';

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

const AnalyticsDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'schedules' | 'outcomes' | 'metrics'>('overview');
  
  // Stats
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalSchedules: 0,
    activeSchedules: 0,
    totalExecutions: 0,
    totalOutcomes: 0,
    totalMetrics: 0,
  });

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateTypeFilter, setTemplateTypeFilter] = useState<string>('all');

  // Schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);

  // Outcomes
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<any>(null);

  // Metrics
  const [metrics, setMetrics] = useState<any[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>('daily_revenue');
  const [metricTrends, setMetricTrends] = useState<any[]>([]);

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
  }, [tenantSlug, token, activeTab]);

  const loadMetricTrends = async (metricName: string) => {
    if (!tenantSlug || !token) return;

    try {
      const trendsRes = await analyticsApi.getMetricTrends(tenantSlug, token, {
        metricName,
        period: '30d',
      });
      setMetricTrends(trendsRes.data || []);
    } catch (error: any) {
      showError('Failed to load metric trends', error.response?.data?.message || 'Failed to load metric trends');
    }
  };

  const loadDashboardData = async () => {
    if (!tenantSlug || !token) return;

    setLoading(true);
    try {
      // Load templates
      const templatesRes = await analyticsApi.getTemplates(tenantSlug, token, { page: 1, limit: 10 });
      setTemplates(templatesRes.data?.templates || []);
      setStats((prev) => ({ ...prev, totalTemplates: templatesRes.data?.total || 0 }));

      // Load schedules
      const schedulesRes = await analyticsApi.getSchedules(tenantSlug, token, { page: 1, limit: 10 });
      setSchedules(schedulesRes.data?.schedules || []);
      setStats((prev) => ({ ...prev, totalSchedules: schedulesRes.data?.total || 0 }));
      setStats((prev) => ({
        ...prev,
        activeSchedules: schedulesRes.data?.schedules?.filter((s: any) => s.is_active).length || 0,
      }));

      // Load outcomes
      const outcomesRes = await analyticsApi.getOutcomes(tenantSlug, token, { page: 1, limit: 10 });
      setOutcomes(outcomesRes.data?.outcomes || []);
      setStats((prev) => ({ ...prev, totalOutcomes: outcomesRes.data?.total || 0 }));

      // Load metrics
      const metricsRes = await analyticsApi.getMetrics(tenantSlug, token, { page: 1, limit: 10 });
      setMetrics(metricsRes.data?.metrics || []);
      setStats((prev) => ({ ...prev, totalMetrics: metricsRes.data?.total || 0 }));

      // Load metric trends
      if (selectedMetric) {
        loadMetricTrends(selectedMetric);
      }
    } catch (error: any) {
      showError('Failed to load dashboard data', error.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTemplate = async (templateId: string, format: string = 'json') => {
    if (!tenantSlug || !token) return;

    try {
      const result = await analyticsApi.executeTemplate(tenantSlug, token, templateId, {
        format,
        page: 1,
        limit: 1000,
      });

      // If format is not JSON, download the file
      if (format !== 'json' && result.data?.fileBuffer) {
        const blob = new Blob([result.data.fileBuffer], {
          type:
            format === 'pdf'
              ? 'application/pdf'
              : format === 'excel'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${templateId}-${Date.now()}.${format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showSuccess('Report exported successfully', `The report has been exported successfully as ${format.toUpperCase()}.`);
      } else {
        showSuccess('Report executed successfully', `The report has been executed successfully. ${result.data?.total || 0} results returned.`);
      }
    } catch (error: any) {
      showError('Failed to execute template', error.response?.data?.message || 'Failed to execute template');
    }
  };

  const handleExecuteSchedule = async (scheduleId: string) => {
    if (!tenantSlug || !token) return;

    try {
      await analyticsApi.executeSchedule(tenantSlug, token, scheduleId);
      showSuccess('Scheduled report executed successfully', 'The scheduled report has been executed successfully.');
      loadDashboardData();
    } catch (error: any) {
      showError('Failed to execute schedule', error.response?.data?.message || 'Failed to execute schedule');
    }
  };

  const handlePauseSchedule = async (scheduleId: string) => {
    if (!tenantSlug || !token) return;

    try {
      await analyticsApi.pauseSchedule(tenantSlug, token, scheduleId);
      showSuccess('Schedule paused successfully', 'The schedule has been paused successfully.');
      loadDashboardData();
    } catch (error: any) {
      showError('Failed to pause schedule', error.response?.data?.message || 'Failed to pause schedule');
    }
  };

  const handleResumeSchedule = async (scheduleId: string) => {
    if (!tenantSlug || !token) return;

    try {
      await analyticsApi.resumeSchedule(tenantSlug, token, scheduleId);
      showSuccess('Schedule resumed successfully', 'The schedule has been resumed successfully.');
      loadDashboardData();
    } catch (error: any) {
      showError('Failed to resume schedule', error.response?.data?.message || 'Failed to resume schedule');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!tenantSlug || !token) return;
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      await analyticsApi.deleteTemplate(tenantSlug, token, templateId);
      showSuccess('Template deleted successfully', 'The template has been deleted successfully.');
      loadDashboardData();
    } catch (error: any) {
      showError('Failed to delete template',  error.response?.data?.message || 'Failed to delete template');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!tenantSlug || !token) return;
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await analyticsApi.deleteSchedule(tenantSlug, token, scheduleId);
      showSuccess('Schedule deleted successfully', 'The schedule has been deleted successfully.');
      loadDashboardData();
    } catch (error: any) {
      showError('Failed to delete schedule', error.response?.data?.message || 'Failed to delete schedule');
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name?.toLowerCase().includes(templateSearch.toLowerCase());
    const matchesType = templateTypeFilter === 'all' || template.report_type === templateTypeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading analytics dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reporting</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Custom reports, scheduled reports, and clinical outcomes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboardData}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Templates"
            value={stats.totalTemplates}
            icon={FileText}
            accent="from-blue-500 to-cyan-500"
          />
          <StatCard
            title="Schedules"
            value={stats.totalSchedules}
            icon={Calendar}
            accent="from-purple-500 to-pink-500"
            subtitle={`${stats.activeSchedules} active`}
          />
          <StatCard
            title="Executions"
            value={stats.totalExecutions}
            icon={Activity}
            accent="from-green-500 to-emerald-500"
          />
          <StatCard
            title="Outcomes"
            value={stats.totalOutcomes}
            icon={ClipboardList}
            accent="from-orange-500 to-red-500"
          />
          <StatCard
            title="Metrics"
            value={stats.totalMetrics}
            icon={BarChart3}
            accent="from-indigo-500 to-purple-500"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'templates', label: 'Templates', icon: FileText },
                { id: 'schedules', label: 'Schedules', icon: Calendar },
                { id: 'outcomes', label: 'Outcomes', icon: ClipboardList },
                { id: 'metrics', label: 'Metrics', icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {templates.slice(0, 5).map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{template.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {template.report_type} • {template.usage_count || 0} uses
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleExecuteTemplate(template.id)}
                          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          Execute
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search templates..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <select
                      value={templateTypeFilter}
                      onChange={(e) => setTemplateTypeFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Types</option>
                      <option value="financial">Financial</option>
                      <option value="clinical">Clinical</option>
                      <option value="operational">Operational</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowTemplateModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Template
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">{template.name}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {template.report_type} • {template.category || 'Uncategorized'}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            template.is_public
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {template.is_public ? 'Public' : 'Private'}
                        </span>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {template.usage_count || 0} uses
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="relative group">
                            <button
                              onClick={() => handleExecuteTemplate(template.id, 'json')}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Execute"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                              <button
                                onClick={() => handleExecuteTemplate(template.id, 'pdf')}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
                              >
                                Export as PDF
                              </button>
                              <button
                                onClick={() => handleExecuteTemplate(template.id, 'excel')}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Export as Excel
                              </button>
                              <button
                                onClick={() => handleExecuteTemplate(template.id, 'csv')}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg"
                              >
                                Export as CSV
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedTemplate(template);
                              setShowTemplateModal(true);
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredTemplates.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No templates found</p>
                    <button
                      onClick={() => {
                        setSelectedTemplate(null);
                        setShowTemplateModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Create Your First Template
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Schedules Tab */}
            {activeTab === 'schedules' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Scheduled Reports</h3>
                  <button
                    onClick={() => {
                      setSelectedSchedule(null);
                      setShowScheduleModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Schedule
                  </button>
                </div>

                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{schedule.name}</h4>
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                schedule.is_active
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {schedule.is_active ? 'Active' : 'Paused'}
                            </span>
                            <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {schedule.schedule_type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Format: {schedule.format} • Runs: {schedule.run_count || 0} • Next: {schedule.next_run ? new Date(schedule.next_run).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {schedule.is_active ? (
                            <button
                              onClick={() => handlePauseSchedule(schedule.id)}
                              className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleResumeSchedule(schedule.id)}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title="Resume"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleExecuteSchedule(schedule.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Execute Now"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              setShowScheduleModal(true);
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {schedules.length === 0 && (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No scheduled reports</p>
                    <button
                      onClick={() => {
                        setSelectedSchedule(null);
                        setShowScheduleModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Create Your First Schedule
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Outcomes Tab */}
            {activeTab === 'outcomes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Outcomes</h3>
                  <button
                    onClick={() => {
                      setSelectedOutcome(null);
                      setShowOutcomeModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Record Outcome
                  </button>
                </div>

                <div className="space-y-3">
                  {outcomes.map((outcome) => (
                    <div
                      key={outcome.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {outcome.condition || outcome.outcome_type}
                            </h4>
                            <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {outcome.outcome_type}
                            </span>
                            {outcome.outcome_status && (
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  outcome.outcome_status === 'improved' || outcome.outcome_status === 'resolved'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : outcome.outcome_status === 'worsened'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {outcome.outcome_status}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Date: {outcome.outcome_date ? new Date(outcome.outcome_date).toLocaleDateString() : 'N/A'}
                            {outcome.outcome_value && ` • Value: ${outcome.outcome_value} ${outcome.outcome_unit || ''}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedOutcome(outcome);
                              setShowOutcomeModal(true);
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to delete this outcome?')) return;
                              try {
                                await analyticsApi.deleteOutcome(tenantSlug!, token, outcome.id);
                                showSuccess('Outcome deleted successfully', 'The outcome has been deleted successfully.');
                                loadDashboardData();
                              } catch (error: any) {
                                showError('Failed to delete outcome', error.response?.data?.message || 'Failed to delete outcome');
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {outcomes.length === 0 && (
                  <div className="text-center py-12">
                    <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No clinical outcomes recorded</p>
                    <button
                      onClick={() => {
                        setSelectedOutcome(null);
                        setShowOutcomeModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Record Your First Outcome
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Metrics Tab */}
            {activeTab === 'metrics' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics Metrics</h3>
                  <select
                    value={selectedMetric}
                    onChange={(e) => {
                      setSelectedMetric(e.target.value);
                      loadMetricTrends(e.target.value);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="daily_revenue">Daily Revenue</option>
                    <option value="patient_satisfaction">Patient Satisfaction</option>
                    <option value="appointment_count">Appointment Count</option>
                    <option value="prescription_count">Prescription Count</option>
                  </select>
                </div>

                {metricTrends.length > 0 && (
                  <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Trends (Last 30 Days)</h4>
                    <div className="space-y-2">
                      {metricTrends.slice(0, 10).map((trend: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(trend.period).toLocaleDateString()}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {trend.avg_value?.toFixed(2) || 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metrics.slice(0, 6).map((metric) => (
                    <div
                      key={metric.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{metric.metric_name}</h4>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                        {metric.metric_value?.toFixed(2) || 'N/A'} {metric.metric_unit || ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(metric.metric_date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && tenantSlug && token && (
        <ReportTemplateForm
          tenantSlug={tenantSlug}
          token={token}
          template={selectedTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}
          onSuccess={loadDashboardData}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && tenantSlug && token && (
        <ScheduleConfigForm
          tenantSlug={tenantSlug}
          token={token}
          schedule={selectedSchedule}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedSchedule(null);
          }}
          onSuccess={loadDashboardData}
        />
      )}

      {/* Outcome Modal */}
      {showOutcomeModal && tenantSlug && token && (
        <OutcomeRecordingForm
          tenantSlug={tenantSlug}
          token={token}
          outcome={selectedOutcome}
          onClose={() => {
            setShowOutcomeModal(false);
            setSelectedOutcome(null);
          }}
          onSuccess={loadDashboardData}
        />
      )}
    </div>
  );
};

export default AnalyticsDashboard;

