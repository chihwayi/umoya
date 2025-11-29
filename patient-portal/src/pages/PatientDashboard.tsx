import React from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { Calendar, FileText, Pill, CreditCard, MessageSquare, Activity, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PatientDashboard: React.FC = () => {
  const { patient, logout } = usePatientAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: Calendar, label: 'Appointments', path: '/appointments', color: 'bg-blue-500' },
    { icon: FileText, label: 'Medical Records', path: '/records', color: 'bg-green-500' },
    { icon: Pill, label: 'Prescriptions', path: '/prescriptions', color: 'bg-purple-500' },
    { icon: CreditCard, label: 'Bills & Payments', path: '/bills', color: 'bg-yellow-500' },
    { icon: MessageSquare, label: 'Messages', path: '/messages', color: 'bg-indigo-500' },
    { icon: Activity, label: 'Vitals Monitoring', path: '/vitals', color: 'bg-red-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MediCore Patient Portal</h1>
              <p className="text-sm text-gray-600">Welcome back, {patient?.firstName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-indigo-600">
                {patient?.firstName?.charAt(0)}
                {patient?.lastName?.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {patient?.firstName} {patient?.lastName}
              </h2>
              <p className="text-sm text-gray-600">Patient Number: {patient?.patientNumber}</p>
              {patient?.email && <p className="text-sm text-gray-600">{patient.email}</p>}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming Appointments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Bills</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <CreditCard className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unread Messages</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <MessageSquare className="w-8 h-8 text-indigo-500" />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className={`${item.color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.label}</h3>
                    <p className="text-sm text-gray-600 mt-1">View and manage</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Some features are still under development. Full functionality will be available soon.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;

