import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Stethoscope, Shield, ArrowLeft } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const EHRLogin: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess, showInfo } = useNotification();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const tenantName = location.state?.tenantName || tenantSlug?.replace('-', ' ');

  useEffect(() => {
    if (tenantName) {
      showInfo('Clinic Selected', `Accessing ${tenantName} EHR system`);
    }
  }, [tenantName, showInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug) return;

    setLoading(true);
    try {
      const response = await ehrApi.login(formData.email, formData.password, tenantSlug);
      
      if (response.data.mustChangePassword) {
        localStorage.setItem('ehr_temp_token', response.data.token);
        localStorage.setItem('ehr_tenant', tenantSlug);
        localStorage.setItem('ehr_tenant_slug', tenantSlug);
        showInfo('Password Change Required', 'Please set a new password to continue');
        navigate(`/ehr/${tenantSlug}/change-password`);
      } else {
        localStorage.setItem('ehr_token', response.data.token);
        localStorage.setItem('ehr_user', JSON.stringify(response.data.user));
        localStorage.setItem('ehr_tenant', tenantSlug);
        localStorage.setItem('ehr_tenant_slug', tenantSlug);
        showSuccess('Login Successful', `Welcome back, ${response.data.user.firstName}!`);
        
        // Redirect based on user role
        if (response.data.user.role === 'doctor') {
          navigate(`/ehr/${tenantSlug}/doctor`);
        } else if (response.data.user.role === 'radiologist') {
          navigate(`/ehr/${tenantSlug}/radiologist`);
        } else if (response.data.user.role === 'lab_tech' || response.data.user.role === 'lab_technician') {
          navigate(`/ehr/${tenantSlug}/lab`);
        } else {
          navigate(`/ehr/${tenantSlug}/dashboard`);
        }
      }
    } catch (error: any) {
      showError('Login Failed', error.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl mb-4">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {tenantName || 'EHR Login'}
            </h1>
            <p className="text-slate-600">Access your electronic health records</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="doctor@clinic.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 text-blue-700">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">Secure Healthcare Login</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Your data is protected with enterprise-grade security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EHRLogin;