import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Users, Calendar, FileText, Pill, TestTube, CreditCard, 
  BarChart3, Settings, LogOut, Bell, Search, Plus,
  Stethoscope, Heart, Activity, Clock, User, Menu, X,
  Shield, Database, Server, Key, Eye, AlertTriangle, 
  Monitor, HardDrive, Wifi, Lock, RefreshCw, Download,
  Upload, Trash2, Edit, Copy, Archive, Globe, Mail,
  Phone, MapPin, Building, Zap, TrendingUp, Users2, Scan, Droplet,
  CheckCircle, Camera, FlaskConical, HeartPulse, Package, Video,
  AlertCircle, Bed, Baby, DollarSign
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrApi, tenantApi } from '../services/api';

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
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Redirect doctors directly to their dashboard
      if (parsedUser.role === 'doctor') {
        navigate(`/ehr/${tenantSlug}/doctor`);
        return;
      }
      // Redirect radiologists directly to their dashboard
      if (parsedUser.role === 'radiologist') {
        navigate(`/ehr/${tenantSlug}/radiologist`);
        return;
      }
      // Redirect nurses directly to nurse dashboard
      if (parsedUser.role === 'nurse') {
        navigate(`/ehr/${tenantSlug}/nurse`);
        return;
      }
      // Redirect lab technicians directly to lab dashboard
      if (parsedUser.role === 'lab_tech' || parsedUser.role === 'lab_technician') {
        navigate(`/ehr/${tenantSlug}/lab`);
        return;
      }
      // Redirect pharmacists directly to pharmacy dashboard
      if (parsedUser.role === 'pharmacist' || parsedUser.role === 'pharmacy_tech' || parsedUser.role === 'pharmacy') {
        navigate(`/ehr/${tenantSlug}/pharmacy`);
        return;
      }
      
      // Only show welcome message once per session
      const welcomeShown = sessionStorage.getItem('ehr_welcome_shown');
      if (!welcomeShown) {
        showSuccess('Welcome Back!', `Hello ${parsedUser.firstName}, ready to help patients today?`);
        sessionStorage.setItem('ehr_welcome_shown', 'true');
      }
    } else {
      navigate(`/ehr/${tenantSlug}`);
    }
  }, [navigate, showSuccess, tenantSlug]);

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    sessionStorage.removeItem('ehr_welcome_shown');
    showInfo('Logged Out', 'See you next time!');
    navigate(`/ehr/${tenantSlug}`);
  };

  const getRoleActions = (role: string) => {
    const baseActions = [
      { icon: Users, label: 'Patients', desc: 'Manage patient records', color: 'from-blue-500 to-cyan-500', route: 'patients' },
      { icon: Calendar, label: 'Appointments', desc: 'Schedule & manage', color: 'from-emerald-500 to-teal-500', route: 'appointments' },
    ];

    switch (role) {
      case 'doctor':
        return [
          { icon: Stethoscope, label: 'Doctor Dashboard', desc: 'Today\'s schedule & patients', color: 'from-blue-500 to-cyan-500', route: 'doctor' },
          { icon: Video, label: 'Telemedicine', desc: 'Video consultations & remote monitoring', color: 'from-purple-500 to-pink-500', route: 'telemedicine' },
          { icon: Settings, label: 'Admin Dashboard', desc: 'System administration', color: 'from-gray-500 to-slate-500', route: 'dashboard' },
          ...baseActions,
          { icon: FileText, label: 'Medical Records', desc: 'Patient history & notes', color: 'from-purple-500 to-indigo-500' },
          { icon: Pill, label: 'Prescriptions', desc: 'Medication management', color: 'from-orange-500 to-red-500' },
          { icon: TestTube, label: 'Lab Orders', desc: 'Request & review tests', color: 'from-pink-500 to-rose-500' },
          { icon: BarChart3, label: 'Analytics', desc: 'Patient insights', color: 'from-violet-500 to-purple-500' },
          { icon: AlertCircle, label: 'Emergency Dept', desc: 'ED tracking board, ESI triage & metrics', color: 'from-red-600 to-orange-600', route: 'emergency' },
          { icon: Bed, label: 'Bed Management', desc: 'Hospital-wide bed status & ADT', color: 'from-blue-600 to-cyan-600', route: 'bed-management' },
          { icon: Activity, label: 'Operating Room', desc: 'OR scheduling, surgical cases & implant tracking', color: 'from-indigo-600 to-purple-600', route: 'operating-room' },
          { icon: Bed, label: 'PACU', desc: 'Post-anesthesia care unit with Aldrete scoring', color: 'from-purple-600 to-violet-600', route: 'pacu' },
          { icon: FlaskConical, label: 'Oncology Center', desc: 'Regimens, tumor board, adverse events', color: 'from-rose-500 to-purple-500', route: 'doctor/oncology' },
          { icon: HeartPulse, label: 'Cardiology Hub', desc: 'Risk stratification & finance locks', color: 'from-red-500 to-rose-500', route: 'doctor/cardiology' },
          { icon: Eye, label: 'Ophthalmology Suite', desc: 'Eye exams, imaging, follow-ups', color: 'from-sky-500 to-cyan-500', route: 'doctor/ophthalmology' },
        ];
      case 'nurse':
        return [
          { icon: Users, label: 'Patients', desc: 'Manage patient records', color: 'from-blue-500 to-cyan-500', route: 'patients' },
          { icon: Calendar, label: 'Nurse Dashboard', desc: 'Today\'s schedule', color: 'from-emerald-500 to-teal-500', route: 'nurse' },
          { icon: AlertCircle, label: 'Emergency Dept', desc: 'ED tracking board & triage', color: 'from-red-600 to-orange-600', route: 'emergency' },
          { icon: Bed, label: 'Bed Management', desc: 'Hospital-wide bed status & ADT', color: 'from-blue-600 to-cyan-600', route: 'bed-management' },
          { icon: Activity, label: 'Operating Room', desc: 'OR scheduling & surgical cases', color: 'from-indigo-600 to-purple-600', route: 'operating-room' },
          { icon: Bed, label: 'PACU', desc: 'Post-anesthesia care unit monitoring', color: 'from-purple-600 to-violet-600', route: 'pacu' },
          { icon: Scan, label: 'MAR (BCMA)', desc: 'Barcode medication administration & 5 Rights', color: 'from-blue-600 to-cyan-600', route: 'mar' },
          { icon: Droplet, label: 'Blood Bank', desc: 'Blood inventory, cross-match & transfusions', color: 'from-red-600 to-rose-600', route: 'blood-bank' },
          { icon: Shield, label: 'Infection Control', desc: 'HAI surveillance, isolation & antimicrobial stewardship', color: 'from-green-600 to-emerald-600', route: 'infection-control' },
          { icon: DollarSign, label: 'Revenue Cycle', desc: 'Charge capture, DRG optimization & billing', color: 'from-green-600 to-emerald-600', route: 'revenue-cycle' },
          { icon: FileText, label: 'CDI Program', desc: 'Physician queries, DRG impact & documentation quality', color: 'from-blue-600 to-indigo-600', route: 'cdi' },
          { icon: AlertTriangle, label: 'Sepsis Management', desc: 'SEP-1 bundle tracking, qSOFA & SIRS screening', color: 'from-red-600 to-orange-600', route: 'sepsis' },
          { icon: Activity, label: 'Vitals', desc: 'Record patient vitals', color: 'from-red-500 to-pink-500', route: 'nurse/vitals' },
          { icon: Pill, label: 'Medications', desc: 'Administer & track', color: 'from-orange-500 to-amber-500', route: 'nurse/medications' },
          { icon: Baby, label: 'Maternity', desc: 'Obstetric care & deliveries', color: 'from-pink-500 to-rose-500', route: 'nurse/maternity' },
          { icon: FileText, label: 'Care Plans', desc: 'Nursing care plans', color: 'from-green-500 to-emerald-500', route: 'nurse/care-plans' },
        ];
      case 'radiologist':
        return [
          { icon: Camera, label: 'Radiologist Worklist', desc: 'View imaging worklist', color: 'from-purple-500 to-indigo-500', route: 'radiologist' },
          { icon: TestTube, label: 'Imaging Orders', desc: 'Review assigned studies', color: 'from-blue-500 to-cyan-500', route: 'radiologist' },
        ];
      case 'receptionist':
        return [
          ...baseActions,
          { icon: CreditCard, label: 'Billing', desc: 'Payments & invoices', color: 'from-yellow-500 to-orange-500' },
          { icon: Bell, label: 'Notifications', desc: 'Patient alerts', color: 'from-indigo-500 to-blue-500' },
        ];
      case 'pharmacist':
      case 'pharmacy_tech':
      case 'pharmacy':
        return [
          { icon: Package, label: 'Pharmacy Dashboard', desc: 'Inventory, orders & dispensing', color: 'from-indigo-500 to-purple-500', route: 'pharmacy' },
          { icon: Pill, label: 'Prescriptions', desc: 'Dispense medications', color: 'from-green-500 to-teal-500' },
          { icon: TestTube, label: 'Drug Interactions', desc: 'Safety checks', color: 'from-red-500 to-orange-500' },
          { icon: BarChart3, label: 'Inventory', desc: 'Stock management', color: 'from-blue-500 to-indigo-500', route: 'pharmacy' },
        ];
      case 'lab_tech':
      case 'lab_technician':
        return [
          { icon: TestTube, label: 'Lab Dashboard', desc: 'Manage lab orders & results', color: 'from-cyan-500 to-blue-500', route: 'lab' },
          { icon: Clock, label: 'Pending Orders', desc: 'New lab orders', color: 'from-orange-500 to-amber-500' },
          { icon: Activity, label: 'In Progress', desc: 'Orders being processed', color: 'from-purple-500 to-indigo-500' },
          { icon: CheckCircle, label: 'Completed', desc: 'Finished orders', color: 'from-green-500 to-emerald-500' },
        ];
      case 'accounts':
        return [
          { icon: CreditCard, label: 'Accounts Dashboard', desc: 'Financial overview & KPIs', color: 'from-amber-500 to-orange-500', route: 'accounts' },
          { icon: CreditCard, label: 'Billing Dashboard', desc: 'Bills, payments & financial overview', color: 'from-purple-500 to-pink-500', route: 'billing' },
          { icon: FileText, label: 'Medical Aid Claims', desc: 'File, track & manage claims', color: 'from-emerald-500 to-teal-500', route: 'claims' },
          { icon: BarChart3, label: 'Revenue Analytics', desc: 'Track income by service line', color: 'from-purple-500 to-pink-500', route: 'accounts/analytics' },
          { icon: FileText, label: 'Billing Queue', desc: 'Manage outstanding invoices', color: 'from-indigo-500 to-slate-500', route: 'accounts' },
        ];
      case 'admin':
        return [
          { icon: Users, label: 'User Management', desc: 'Manage staff accounts, roles & permissions', color: 'from-slate-500 to-gray-500', route: 'users' },
          { icon: Shield, label: 'HIPAA Compliance', desc: 'Audit logs, breach detection & compliance', color: 'from-indigo-500 to-blue-500', route: 'hipaa-compliance' },
          { icon: Eye, label: 'Audit Logs', desc: 'System activity & access logs', color: 'from-purple-500 to-violet-500', route: 'hipaa-compliance' },
          { icon: Database, label: 'Data Management', desc: 'Backup, restore & data migration', color: 'from-blue-500 to-cyan-500', route: 'data' },
          { icon: Server, label: 'System Health', desc: 'Performance monitoring & diagnostics', color: 'from-orange-500 to-amber-500', route: 'health' },
          { icon: Building, label: 'Tenant Settings', desc: 'Clinic configuration & preferences', color: 'from-emerald-500 to-teal-500', route: 'tenant-settings' },
          { icon: Settings, label: 'System Settings', desc: 'Global system configuration', color: 'from-gray-500 to-slate-500', route: 'settings' },
          { icon: BarChart3, label: 'System Analytics', desc: 'Usage statistics & performance metrics', color: 'from-cyan-500 to-blue-500', route: 'analytics' },
        ];
      default:
        return baseActions;
    }
  };

  const [adminStats, setAdminStats] = useState({
    activeUsers: 0,
    totalPatients: 0,
    systemUptime: '99.9%',
    securityAlerts: 0,
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminStats();
    }
  }, [user]);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const response = await tenantApi.getTenantBySlug(tenantSlug!);
        if (response.data) {
          setTenantInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching tenant info:', error);
      }
    };

    if (tenantSlug) {
      fetchTenantInfo();
    }
  }, [tenantSlug]);

  const loadAdminStats = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      // Load users count
      try {
        const usersRes = await ehrApi.getUsers(token, tenantSlug, '');
        const activeUsers = (usersRes.data || []).filter((u: any) => u.isActive !== false).length;
        setAdminStats(prev => ({ ...prev, activeUsers }));
      } catch (err) {
        console.error('Failed to load users:', err);
      }

      // Load patients count
      try {
        const patientsRes = await ehrApi.getPatients(token, tenantSlug, 1, 1);
        setAdminStats(prev => ({ ...prev, totalPatients: patientsRes.data?.total || 0 }));
      } catch (err) {
        console.error('Failed to load patients:', err);
      }

      // Load security alerts (HIPAA breaches)
      try {
        if (ehrApi.detectBreaches && typeof ehrApi.detectBreaches === 'function') {
          const breachesRes = await ehrApi.detectBreaches(token, tenantSlug, 7);
          setAdminStats(prev => ({ ...prev, securityAlerts: breachesRes.data?.breaches?.length || breachesRes.data?.length || 0 }));
        } else {
          console.warn('detectBreaches method not available - frontend may need rebuild');
        }
      } catch (err) {
        console.error('Failed to load breaches:', err);
      }
    } catch (error) {
      console.error('Failed to load admin stats:', error);
    }
  };

  const getQuickStats = (role: string) => {
    if (role === 'admin') {
      return [
        { label: 'Active Users', value: adminStats.activeUsers.toString(), icon: Users2, color: 'text-blue-600' },
        { label: 'Total Patients', value: adminStats.totalPatients.toLocaleString(), icon: Users, color: 'text-emerald-600' },
        { label: 'System Uptime', value: adminStats.systemUptime, icon: Server, color: 'text-green-600' },
        { label: 'Security Alerts', value: adminStats.securityAlerts.toString(), icon: Shield, color: adminStats.securityAlerts > 0 ? 'text-red-600' : 'text-green-600' },
      ];
    }
    if (role === 'radiologist') {
      return [
        { label: 'Unassigned Studies', value: '18', icon: Camera, color: 'text-purple-600' },
        { label: 'My Queue', value: '6', icon: Users, color: 'text-indigo-600' },
        { label: 'Draft Reports', value: '2', icon: FileText, color: 'text-amber-600' },
        { label: 'Critical Findings', value: '1', icon: AlertTriangle, color: 'text-red-600' },
      ];
    }
    if (role === 'accounts') {
      return [
        { label: 'Today\'s Receipts', value: '$7,820', icon: CreditCard, color: 'text-amber-600' },
        { label: 'Outstanding Balance', value: '$18,450', icon: BarChart3, color: 'text-purple-600' },
        { label: 'Medical Aid Pending', value: '$9,120', icon: Shield, color: 'text-emerald-600' },
        { label: 'Refund Requests', value: '3', icon: FileText, color: 'text-blue-600' },
      ];
    }
    return [
      { label: 'Today\'s Appointments', value: '12', icon: Calendar, color: 'text-blue-600' },
      { label: 'Active Patients', value: '248', icon: Users, color: 'text-emerald-600' },
      { label: 'Pending Results', value: '5', icon: TestTube, color: 'text-orange-600' },
      { label: 'Messages', value: '3', icon: Bell, color: 'text-purple-600' },
    ];
  };

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
              {tenantInfo?.logoUrl ? (
                <div className="h-10 w-10 bg-white p-1 rounded-xl flex items-center justify-center overflow-hidden">
                  <img 
                    src={tenantInfo.logoUrl} 
                    alt={`${tenantInfo.clinicName} Logo`} 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-white">
                  {tenantInfo?.clinicName ? tenantInfo.clinicName : 'MediCore'}
                </h2>
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
            
            {user?.role !== 'admin' && user?.role !== 'accounts' && (
              <button 
                onClick={() => navigate(`/ehr/${tenantSlug}/patients`)}
                className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Users className="w-5 h-5" />
                <span>Patients</span>
              </button>
            )}
            
            {['doctor', 'nurse', 'receptionist'].includes(user?.role ?? '') && (
              <button 
                onClick={() => navigate(`/ehr/${tenantSlug}/appointments`)}
                className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Calendar className="w-5 h-5" />
                <span>Appointments</span>
              </button>
            )}

            {/* Finance/Accounts Navigation */}
            {user?.role === 'accounts' && (
              <>
                <button 
                  onClick={() => navigate(`/ehr/${tenantSlug}/accounts`)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Accounts</span>
                </button>
                <button 
                  onClick={() => navigate(`/ehr/${tenantSlug}/billing`)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Billing</span>
                </button>
                <button 
                  onClick={() => navigate(`/ehr/${tenantSlug}/claims`)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  <span>Medical Aid Claims</span>
                </button>
                <button 
                  onClick={() => navigate(`/ehr/${tenantSlug}/accounts/analytics`)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Revenue Analytics</span>
                </button>
              </>
            )}
            
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
                <p className="text-blue-100">
                  {user.role === 'admin'
                    ? 'System operations and configuration'
                    : user.role === 'accounts'
                    ? 'Monitor financial performance and keep revenue flowing'
                    : 'Ready to provide excellent patient care?'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {user.role !== 'admin' && (
                <div className="relative hidden sm:block">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search patients..."
                    className="pl-9 pr-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 text-white placeholder-blue-200 w-64"
                  />
                </div>
              )}
              {user.role === 'admin' && (
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/hipaa-compliance`)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all font-semibold text-sm"
                >
                  <Shield className="w-4 h-4" />
                  HIPAA Compliance
                </button>
              )}
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
            {getQuickStats(user.role).map((stat, index) => (
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
              <h2 className="text-xl font-bold text-slate-800">
                {user.role === 'admin' ? 'System Administration' : 'Quick Actions'}
              </h2>
              {user.role !== 'admin' && (
                <button onClick={() => navigate(`/ehr/${tenantSlug}/patients`)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Patient</span>
                </button>
              )}
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

          {/* System Status - Admin Only */}
          {user.role === 'admin' && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">System Status</h3>
                <button
                  onClick={loadAdminStats}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Server className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">Database</p>
                    <p className="text-sm text-green-600">Online & Healthy</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Wifi className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">API Services</p>
                    <p className="text-sm text-green-600">All Systems Operational</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">HIPAA Compliance</p>
                    <p className="text-sm text-green-600">Audit Logging Active</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity - Admin Only */}
          {user.role === 'admin' && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Recent System Activity</h3>
                <button
                  onClick={() => navigate(`/ehr/${tenantSlug}/hipaa-compliance`)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View All Audit Logs →
                </button>
              </div>
              <div className="space-y-4">
                <div className="text-center py-8 text-slate-500">
                  <Eye className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-sm">Recent activity is tracked in the HIPAA Compliance Dashboard</p>
                  <button
                    onClick={() => navigate(`/ehr/${tenantSlug}/hipaa-compliance`)}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    View Compliance Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default EHRDashboard;