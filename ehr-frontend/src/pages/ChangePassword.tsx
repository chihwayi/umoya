import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Shield, CheckCircle, Sparkles } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess, showWarning } = useNotification();
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);

  const passwordRequirements = [
    { text: 'At least 8 characters', met: formData.newPassword.length >= 8 },
    { text: 'Contains uppercase letter', met: /[A-Z]/.test(formData.newPassword) },
    { text: 'Contains lowercase letter', met: /[a-z]/.test(formData.newPassword) },
    { text: 'Contains number', met: /\d/.test(formData.newPassword) },
    { text: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword) }
  ];

  const isPasswordValid = passwordRequirements.every(req => req.met);
  const passwordsMatch = formData.newPassword === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      showWarning('Invalid Password', 'Please meet all password requirements');
      return;
    }

    if (!passwordsMatch) {
      showWarning('Password Mismatch', 'New passwords do not match');
      return;
    }

    const token = localStorage.getItem('ehr_temp_token');
    const tenant = localStorage.getItem('ehr_tenant');
    
    if (!token || !tenant) {
      showError('Session Error', 'Please login again');
      navigate('/');
      return;
    }

    setLoading(true);
    try {
      await ehrApi.changePassword(
        formData.currentPassword,
        formData.newPassword,
        token,
        tenant
      );

      localStorage.removeItem('ehr_temp_token');
      showSuccess('Password Updated', 'Please login with your new password');
      navigate(`/ehr/${tenant}`);
    } catch (error: any) {
      showError('Update Failed', error.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#080E1A] px-4 py-8 text-[#E8F0FF]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-10rem] mx-auto h-[30rem] w-[30rem] rounded-full bg-[#00C896]/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[16rem] h-[22rem] w-[22rem] rounded-full bg-[#2B7FFF]/16 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-[20rem] w-[20rem] rounded-full bg-[#FF7A40]/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <div className="w-full rounded-[36px] border border-[#253A58] bg-[linear-gradient(180deg,rgba(14,24,41,0.98),rgba(8,14,26,0.99))] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00C896]/30 bg-[#00C896]/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7DE8CA]">
              <Sparkles className="h-4 w-4" />
              Security update
            </div>
            <div className="mt-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(0,200,150,0.14),rgba(43,127,255,0.14))]">
              <Shield className="h-8 w-8 text-[#BCEAD8]" />
            </div>
            <h1 style={{ fontFamily: '"Fraunces", serif' }} className="mt-4 text-3xl text-white">
              Update Password
            </h1>
            <p className="mt-2 text-sm text-[#AFC1DF]">Set a secure password for your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#D8E5F8]">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5D789B]" />
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  required
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6886AC] hover:text-[#C9D9F3] transition-colors"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#D8E5F8]">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5D789B]" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  required
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6886AC] hover:text-[#C9D9F3] transition-colors"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {formData.newPassword && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <h4 className="mb-2 text-sm font-semibold text-[#D8E5F8]">Password Requirements</h4>
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className={`h-4 w-4 ${req.met ? 'text-[#2ED9A4]' : 'text-[#4A6080]'}`} />
                    <span className={`text-sm ${req.met ? 'text-[#A3EFD8]' : 'text-[#8AA2C5]'}`}>
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#D8E5F8]">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5D789B]" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full rounded-2xl py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:ring-2 ${
                    formData.confirmPassword && !passwordsMatch
                      ? 'border border-red-400 bg-[#200F1A] focus:border-red-400 focus:ring-red-400/20'
                      : 'border border-[#253A58] bg-[#091320] focus:border-[#2B7FFF] focus:ring-[#2B7FFF]/20'
                  }`}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6886AC] hover:text-[#C9D9F3] transition-colors"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {formData.confirmPassword && !passwordsMatch && (
                <p className="mt-1 text-sm text-red-300">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || !passwordsMatch}
              className="w-full rounded-2xl bg-gradient-to-r from-[#00C896] to-[#0BBE8A] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(0,200,150,0.3)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#00C896]/35 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Updating...</span>
                </div>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
