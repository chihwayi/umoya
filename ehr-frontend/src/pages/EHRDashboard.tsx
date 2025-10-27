import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Users, Calendar, FileText, Pill, TestTube, CreditCard, 
  BarChart3, Settings, LogOut, Bell, Search, Plus,
  Stethoscope, Heart, Activity, Clock, User, Menu, X
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  specialization?: string;
}

const EHRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showInfo } = useNotification();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      showSuccess('Welcome Back!', `Hello ${parsedUser.firstName}, ready to help patients today?`);
    } else {
      navigate(`/ehr/${tenantSlug}`);
    }
  }, [navigate, showSuccess]);

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    showInfo('Logged Out', 'See you next time!');
    navigate(`/ehr/${tenantSlug}`);
  };

  const getRoleActions = (role: string) => {
    const baseActions = [
      { icon: Users, label: 'Patients', desc: 'Manage patient records', color: 'from-blue-500 to-cyan-500', route: 'patients' },
      { icon: Calendar, label: 'Appointments', desc: 'Schedule & manage', color: 'from-emerald-500 to-teal-500' },
    ];

    switch (role) {
      case 'doctor':
        return [
          ...baseActions,
          { icon: FileText, label: 'Medical Records', desc: 'Patient history & notes', color: 'from-purple-500 to-indigo-500' },
          { icon: Pill, label: 'Prescriptions', desc: 'Medication management', color: 'from-orange-500 to-red-500' },
          { icon: TestTube, label: 'Lab Orders', desc: 'Request & review tests', color: 'from-pink-500 to-rose-500' },
          { icon: BarChart3, label: 'Analytics', desc: 'Patient insights', color: 'from-violet-500 to-purple-500' },
        ];
      case 'nurse':
        return [
          ...baseActions,
          { icon: Activity, label: 'Vitals', desc: 'Record patient vitals', color: 'from-red-500 to-pink-500' },
          { icon: Pill, label: 'Medications', desc: 'Administer & track', color: 'from-orange-500 to-amber-500' },
          { icon: FileText, label: 'Care Plans', desc: 'Nursing care plans', color: 'from-green-500 to-emerald-500' },
        ];
      case 'receptionist':
        return [
          ...baseActions,
          { icon: CreditCard, label: 'Billing', desc: 'Payments & invoices', color: 'from-yellow-500 to-orange-500' },
          { icon: Bell, label: 'Notifications', desc: 'Patient alerts', color: 'from-indigo-500 to-blue-500' },
        ];
      case 'pharmacist':
        return [
          { icon: Pill, label: 'Prescriptions', desc: 'Dispense medications', color: 'from-green-500 to-teal-500' },
          { icon: TestTube, label: 'Drug Interactions', desc: 'Safety checks', color: 'from-red-500 to-orange-500' },
          { icon: BarChart3, label: 'Inventory', desc: 'Stock management', color: 'from-blue-500 to-indigo-500' },
        ];
      case 'admin':
        return [
          ...baseActions,
          { icon: Users, label: 'Staff Management', desc: 'Manage clinic staff', color: 'from-slate-500 to-gray-500', route: 'users' },
          { icon: Settings, label: 'System Settings', desc: 'Configure system', color: 'from-purple-500 to-violet-500' },
          { icon: BarChart3, label: 'Reports', desc: 'Clinic analytics', color: 'from-emerald-500 to-green-500' },
        ];
      default:
        return baseActions;
    }
  };

  const quickStats = [
    { label: 'Today\'s Appointments', value: '12', icon: Calendar, color: 'text-blue-600' },
    { label: 'Active Patients', value: '248', icon: Users, color: 'text-emerald-600' },
    { label: 'Pending Results', value: '5', icon: TestTube, color: 'text-orange-600' },
    { label: 'Messages', value: '3', icon: Bell, color: 'text-purple-600' },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-slate-800 via-slate-900 to-gray-900 border-r border-slate-700/50 z-50 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">MediCore</h2>
                <p className="text-xs text-slate-300">EHR System</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5 text-slate-300" />
            </button>
          </div>

          {/* User Profile */}
          <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{user.firstName} {user.lastName}</h3>
                <p className="text-sm text-blue-200 capitalize">{user.role}</p>
                {user.specialization && (
                  <p className="text-xs text-slate-300">{user.specialization}</p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <button 
              onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)}
              className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Heart className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
            
            <button 
              onClick={() => navigate(`/ehr/${tenantSlug}/patients`)}
              className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Users className="w-5 h-5" />
              <span>Patients</span>
            </button>
            
            {user?.role === 'admin' && (
              <button 
                onClick={() => navigate(`/ehr/${tenantSlug}/users`)}
                className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Users className="w-5 h-5" />
                <span>User Management</span>
              </button>
            )}
            
            <button 
              onClick={() => navigate(`/ehr/${tenantSlug}/settings`)}
              className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span>Profile Settings</span>
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-lg border-b border-blue-500/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user.firstName}
                </h1>
                <p className="text-blue-100">Ready to provide excellent patient care?</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  className="pl-9 pr-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 text-white placeholder-blue-200 w-64"
                />
              </div>
              <button className="p-2 hover:bg-white/20 rounded-lg relative transition-colors">
                <Bell className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {quickStats.map((stat, index) => (
              <div key={index} className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">Quick Actions</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Patient</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {getRoleActions(user.role).map((action, index) => (
                <button
                  key={index}
                  onClick={() => (action as any).route && navigate(`/ehr/${tenantSlug}/${(action as any).route}`)}
                  className="group bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 text-left hover:-translate-y-1"
                >
                  <div className={`inline-flex p-3 bg-gradient-to-r ${action.color} rounded-xl mb-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-2">{action.label}</h3>
                  <p className="text-slate-600 text-sm">{action.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {[
                { time: '10 minutes ago', action: 'Patient consultation completed', patient: 'John Doe' },
                { time: '25 minutes ago', action: 'Lab results reviewed', patient: 'Sarah Smith' },
                { time: '1 hour ago', action: 'Prescription issued', patient: 'Mike Johnson' },
              ].map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-slate-800 font-medium">{activity.action}</p>
                    <p className="text-slate-600 text-sm">Patient: {activity.patient}</p>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EHRDashboard;