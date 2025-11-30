import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { Calendar, FileText, Pill, CreditCard, MessageSquare, Activity, LogOut, ArrowRight, TrendingUp, Clock, Bell } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { patientPortalApi } from '../services/api';
import { format } from 'date-fns';

const PatientDashboard: React.FC = () => {
  const { patient, logout, token } = usePatientAuth();
  const navigate = useNavigate();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
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
    navigate('/login');
  };

  const menuItems = [
    { icon: Calendar, label: 'Appointments', path: '/appointments', color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { icon: FileText, label: 'Medical Records', path: '/records', color: 'from-green-500 to-green-600', bgColor: 'bg-green-50', textColor: 'text-green-600' },
    { icon: Pill, label: 'Prescriptions', path: '/prescriptions', color: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
    { icon: CreditCard, label: 'Bills & Payments', path: '/bills', color: 'from-yellow-500 to-yellow-600', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' },
    { icon: MessageSquare, label: 'Messages', path: '/messages', color: 'from-indigo-500 to-indigo-600', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
    { icon: Activity, label: 'Vitals Monitoring', path: '/vitals', color: 'from-red-500 to-red-600', bgColor: 'bg-red-50', textColor: 'text-red-600' },
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
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 opacity-90" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-blue-100 text-sm mb-1">Appointments</p>
            <p className="text-3xl font-bold">{stats.upcomingAppointments}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <CreditCard className="w-8 h-8 opacity-90" />
              <Clock className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-yellow-100 text-sm mb-1">Pending Bills</p>
            <p className="text-3xl font-bold">{stats.pendingBills}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <MessageSquare className="w-8 h-8 opacity-90" />
              <Bell className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-indigo-100 text-sm mb-1">Messages</p>
            <p className="text-3xl font-bold">{stats.unreadMessages}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <Pill className="w-8 h-8 opacity-90" />
              <Activity className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-purple-100 text-sm mb-1">Prescriptions</p>
            <p className="text-3xl font-bold">{stats.activePrescriptions}</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 opacity-90" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-green-100 text-sm mb-1">Records</p>
            <p className="text-3xl font-bold">{stats.medicalRecords}</p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 opacity-90" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <p className="text-red-100 text-sm mb-1">Vitals</p>
            <p className="text-3xl font-bold">{stats.vitalsRecords}</p>
          </div>
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
                  to="/appointments"
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
                  to="/vitals"
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
                to={item.path}
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

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/appointments"
              className="bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-colors"
            >
              <Calendar className="w-6 h-6 mb-2" />
              <p className="font-semibold">Book Appointment</p>
              <p className="text-sm text-white/80">Schedule a visit</p>
            </Link>
            <Link
              to="/bills"
              className="bg-white/20 backdrop-blur-sm rounded-xl p-4 hover:bg-white/30 transition-colors"
            >
              <CreditCard className="w-6 h-6 mb-2" />
              <p className="font-semibold">Pay Bill</p>
              <p className="text-sm text-white/80">View and pay bills</p>
            </Link>
            <Link
              to="/messages"
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
