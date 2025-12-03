import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { Calendar, FileText, Pill, CreditCard, MessageSquare, Activity, LogOut, ArrowRight, TrendingUp, Clock, Bell, X, Droplet, Heart, AlarmClock, CheckCircle2, Download, Video, ClipboardList, Users, Shield, Route, Syringe, Bed, AlertCircle } from 'lucide-react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { patientPortalApi } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { format } from 'date-fns';

const PatientDashboard: React.FC = () => {
  const { patient, logout, token } = usePatientAuth();
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications(30000); // Poll every 30 seconds
  const [showNotifications, setShowNotifications] = useState(false);
  const [stats, setStats] = useState({
    upcomingAppointments: 0,
    pendingBills: 0,
    unreadMessages: 0,
    activePrescriptions: 0,
    medicalRecords: 0,
    vitalsRecords: 0,
  });
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Use dashboard summary endpoint for better performance
      const summary = await patientPortalApi.getDashboardSummary(token!, tenantSlug).catch(() => null);
      
      if (summary) {
        setDashboardData(summary);
        setStats({
          upcomingAppointments: summary.summary?.appointments || summary.appointmentCount || 0,
          pendingBills: summary.summary?.pendingBills || summary.pendingBillCount || 0,
          unreadMessages: 0, // TODO: Implement messaging
          activePrescriptions: summary.summary?.activePrescriptions || summary.activePrescriptionCount || 0,
          medicalRecords: summary.summary?.medicalRecords || summary.medicalRecordCount || 0,
          vitalsRecords: summary.summary?.vitalsRecords || summary.vitalsCount || 0,
        });
      } else {
        // Fallback to individual API calls
        const [appointments, bills, prescriptions] = await Promise.all([
          patientPortalApi.getAppointments(token!, tenantSlug, { status: 'scheduled' }).catch(() => []),
          patientPortalApi.getBills(token!, tenantSlug, { status: 'pending' }).catch(() => []),
          patientPortalApi.getPrescriptions(token!, tenantSlug, true).catch(() => []),
        ]);

        setStats({
          upcomingAppointments: appointments.length || 0,
          pendingBills: bills.length || 0,
          unreadMessages: 0,
          activePrescriptions: prescriptions.length || 0,
          medicalRecords: 0,
          vitalsRecords: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate(`/${tenantSlug}/login`);
  };

  const menuItems = [
    { icon: Calendar, label: 'Appointments', path: '/appointments', color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { icon: Shield, label: 'My Consents', path: '/consents', color: 'from-indigo-500 to-indigo-600', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
    { icon: FileText, label: 'Medical Records', path: '/records', color: 'from-green-500 to-green-600', bgColor: 'bg-green-50', textColor: 'text-green-600' },
    { icon: Route, label: 'My Care Pathways', path: '/pathways', color: 'from-cyan-500 to-cyan-600', bgColor: 'bg-cyan-50', textColor: 'text-cyan-600' },
    { icon: Pill, label: 'Prescriptions', path: '/prescriptions', color: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
    { icon: Syringe, label: 'Immunizations', path: '/immunizations', color: 'from-emerald-500 to-emerald-600', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { icon: AlarmClock, label: 'Medication Reminders', path: '/medication-reminders', color: 'from-orange-500 to-orange-600', bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
    { icon: CheckCircle2, label: 'Adherence Tracking', path: '/medication-adherence', color: 'from-teal-500 to-teal-600', bgColor: 'bg-teal-50', textColor: 'text-teal-600' },
    { icon: CreditCard, label: 'Bills & Payments', path: '/bills', color: 'from-yellow-500 to-yellow-600', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
    { icon: MessageSquare, label: 'Messages', path: '/messages', color: 'from-indigo-500 to-indigo-600', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
    { icon: Activity, label: 'Vitals Monitoring', path: '/vitals', color: 'from-red-500 to-red-600', bgColor: 'bg-red-50', textColor: 'text-red-600' },
    { icon: ClipboardList, label: 'Questionnaires', path: '/questionnaires', color: 'from-pink-500 to-pink-600', bgColor: 'bg-pink-50', textColor: 'text-pink-600' },
    { icon: AlertCircle, label: 'ED Visits', path: '/ed-visits', color: 'from-rose-500 to-rose-600', bgColor: 'bg-rose-50', textColor: 'text-rose-600' },
    { icon: Download, label: 'Export Records', path: '/export', color: 'from-gray-500 to-gray-600', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
  ];

  const chronicDiseaseItems = [
    { icon: Droplet, label: 'Diabetes Management', path: '/diabetes', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { icon: Heart, label: 'Heart Health', path: '/cardiology', color: 'from-red-500 to-pink-500', bgColor: 'bg-red-50', textColor: 'text-red-600' },
  ];

  const advancedFeatures = [
    { icon: Activity, label: 'Symptom Checker', path: '/symptom-checker', color: 'from-orange-500 to-red-500', bgColor: 'bg-orange-50', textColor: 'text-orange-600' },
    { icon: Users, label: 'Family Access', path: '/family-access', color: 'from-pink-500 to-rose-500', bgColor: 'bg-pink-50', textColor: 'text-pink-600' },
    { icon: Activity, label: 'Fitness Apps', path: '/fitness-integration', color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-50', textColor: 'text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold text-white">
                  {patient?.firstName?.charAt(0)}
                  {patient?.lastName?.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Welcome back, {patient?.firstName}</h1>
                <p className="text-sm text-gray-600">Patient Number: {patient?.patientNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-700" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              await markAllAsRead();
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotifications(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-600 text-sm">No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                            onClick={async () => {
                              if (!notification.read) {
                                await markAsRead(notification.id);
                              }
                              if (notification.actionUrl) {
                                // Ensure actionUrl includes tenant slug
                                let url = notification.actionUrl;
                                if (!url.startsWith(`/${tenantSlug}/`) && !url.startsWith('/select-tenant')) {
                                  // If URL doesn't have tenant slug, add it
                                  if (url.startsWith('/')) {
                                    url = `/${tenantSlug}${url}`;
                                  } else {
                                    url = `/${tenantSlug}/${url}`;
                                  }
                                }
                                navigate(url);
                                setShowNotifications(false);
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                !notification.read ? 'bg-indigo-600' : 'bg-transparent'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold mb-1 ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{notification.message}</p>
                                <p className="text-xs text-gray-400">
                                  {format(new Date(notification.sentAt), 'MMM d, h:mm a')}
                                </p>
                                {notification.actionLabel && (
                                  <button className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-semibold">
                                    {notification.actionLabel} →
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await deleteNotification(notification.id);
                                }}
                                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <Link
            to={`/${tenantSlug}/appointments`}
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 opacity-90" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-blue-100 text-sm mb-1">Appointments</p>
            <p className="text-3xl font-bold">{stats.upcomingAppointments}</p>
          </Link>

          <Link
            to={`/${tenantSlug}/bills`}
            className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <CreditCard className="w-8 h-8 opacity-90" />
              <Clock className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-yellow-100 text-sm mb-1">Pending Bills</p>
            <p className="text-3xl font-bold">{stats.pendingBills}</p>
          </Link>

          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <Bell className="w-8 h-8 opacity-90" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-indigo-100 text-sm mb-1">Notifications</p>
            <p className="text-3xl font-bold">{unreadCount}</p>
          </div>

          <Link
            to={`/${tenantSlug}/prescriptions`}
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <Pill className="w-8 h-8 opacity-90" />
              <Activity className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-purple-100 text-sm mb-1">Prescriptions</p>
            <p className="text-3xl font-bold">{stats.activePrescriptions}</p>
          </Link>

          <Link
            to={`/${tenantSlug}/records`}
            className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 opacity-90" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-green-100 text-sm mb-1">Medical Records</p>
            <p className="text-3xl font-bold">{stats.medicalRecords}</p>
          </Link>

          <Link
            to={`/${tenantSlug}/vitals`}
            className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 opacity-90" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-red-100 text-sm mb-1">Vitals</p>
            <p className="text-3xl font-bold">{stats.vitalsRecords}</p>
          </Link>
        </div>

        {/* Upcoming Appointment & Latest Vitals */}
        {(dashboardData?.upcomingAppointment || dashboardData?.latestVitals) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {dashboardData.upcomingAppointment && (
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Upcoming Appointment
                </h3>
                <p className="text-blue-100 mb-2">
                  {format(new Date(dashboardData.upcomingAppointment.appointmentDate), 'EEEE, MMMM dd, yyyy')}
                </p>
                <p className="text-blue-100 mb-2">
                  {format(new Date(dashboardData.upcomingAppointment.appointmentDate), 'h:mm a')}
                </p>
                {dashboardData.upcomingAppointment.reason && (
                  <p className="text-blue-200 text-sm mt-2">Reason: {dashboardData.upcomingAppointment.reason}</p>
                )}
                <Link
                  to={`/${tenantSlug}/appointments`}
                  className="inline-block mt-4 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg hover:bg-white/30 transition-colors text-sm font-semibold"
                >
                  View All Appointments →
                </Link>
              </div>
            )}

            {dashboardData.latestVitals && (
              <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Latest Vitals
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {dashboardData.latestVitals.bloodPressure && (
                    <div>
                      <p className="text-red-100 text-xs mb-1">Blood Pressure</p>
                      <p className="text-lg font-bold">{dashboardData.latestVitals.bloodPressure}</p>
                    </div>
                  )}
                  {dashboardData.latestVitals.heartRate && (
                    <div>
                      <p className="text-red-100 text-xs mb-1">Heart Rate</p>
                      <p className="text-lg font-bold">{dashboardData.latestVitals.heartRate} bpm</p>
                    </div>
                  )}
                  {dashboardData.latestVitals.temperature && (
                    <div>
                      <p className="text-red-100 text-xs mb-1">Temperature</p>
                      <p className="text-lg font-bold">{dashboardData.latestVitals.temperature}°C</p>
                    </div>
                  )}
                </div>
                <p className="text-red-200 text-xs mt-3">
                  {format(new Date(dashboardData.latestVitals.recordedAt), 'MMM dd, yyyy')}
                </p>
                <Link
                  to={`/${tenantSlug}/vitals`}
                  className="inline-block mt-4 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg hover:bg-white/30 transition-colors text-sm font-semibold"
                >
                  View All Vitals →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={`/${tenantSlug}${item.path}`}
                className="group bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">{item.label}</h3>
                    <p className="text-sm text-gray-600">View and manage</p>
                  </div>
                  <ArrowRight className={`w-5 h-5 ${item.textColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Advanced Features */}
        {advancedFeatures.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Advanced Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {advancedFeatures.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={`/${tenantSlug}${item.path}`}
                    className="group bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">AI-powered health insights</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Advanced Features */}
        {advancedFeatures.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Advanced Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {advancedFeatures.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={`/${tenantSlug}${item.path}`}
                    className="group bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">AI-powered health insights</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Chronic Disease Management */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Chronic Disease Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {chronicDiseaseItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={`/${tenantSlug}${item.path}`}
                  className="group bg-white rounded-2xl shadow-sm p-6 border border-gray-200 hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg mb-1">{item.label}</h3>
                      <p className="text-sm text-gray-600">Monitor your health</p>
                    </div>
                    <ArrowRight className={`w-5 h-5 ${item.textColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to={`/${tenantSlug}/appointments/request`}
              className="bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-colors"
            >
              <Calendar className="w-6 h-6 mb-2" />
              <p className="font-semibold">Book Appointment</p>
              <p className="text-sm text-white/80">Schedule a visit</p>
            </Link>
            <Link
              to={`/${tenantSlug}/bills`}
              className="bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-colors"
            >
              <CreditCard className="w-6 h-6 mb-2" />
              <p className="font-semibold">Pay Bill</p>
              <p className="text-sm text-white/80">View and pay bills</p>
            </Link>
            <Link
              to={`/${tenantSlug}/messages`}
              className="bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-colors"
            >
              <MessageSquare className="w-6 h-6 mb-2" />
              <p className="font-semibold">Send Message</p>
              <p className="text-sm text-white/80">Contact your clinic</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
