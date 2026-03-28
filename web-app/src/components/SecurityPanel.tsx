import React, { useState } from 'react';
import { authAPI } from '../services/api';

export const SecurityPanel: React.FC = () => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const currentUser = authAPI.getCurrentUser();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(passwordData.oldPassword, passwordData.newPassword);
      setMessage('Password changed successfully');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setShowChangePassword(false);
    } catch (error) {
      setMessage('Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  const securityMetrics = {
    totalLogins: 156,
    failedAttempts: 3,
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    accountsLocked: 0,
    twoFactorEnabled: false
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Security Center</h2>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#7A9AB8]">Total Logins</p>
              <p className="text-2xl font-bold text-white mt-1">{securityMetrics.totalLogins}</p>
            </div>
            <div className="p-3 bg-[#2B7FFF]/10 rounded-xl">
              <svg className="w-6 h-6 text-[#2B7FFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#7A9AB8]">Failed Attempts</p>
              <p className="text-2xl font-bold text-white mt-1">{securityMetrics.failedAttempts}</p>
            </div>
            <div className="p-3 bg-[#FF4D6A]/10 rounded-xl">
              <svg className="w-6 h-6 text-[#FF4D6A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#7A9AB8]">Locked Accounts</p>
              <p className="text-2xl font-bold text-white mt-1">{securityMetrics.accountsLocked}</p>
            </div>
            <div className="p-3 bg-[#FF7A40]/10 rounded-xl">
              <svg className="w-6 h-6 text-[#FF7A40]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-white/[0.07] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#7A9AB8]">2FA Status</p>
              <p className={`text-2xl font-bold mt-1 ${securityMetrics.twoFactorEnabled ? 'text-[#00C896]' : 'text-[#5A78A0]'}`}>
                {securityMetrics.twoFactorEnabled ? 'Active' : 'Disabled'}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${securityMetrics.twoFactorEnabled ? 'bg-[#00C896]/10' : 'bg-[#080E1A]'}`}>
              <svg className={`w-6 h-6 ${securityMetrics.twoFactorEnabled ? 'text-[#00C896]' : 'text-[#5A78A0]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Current User Info */}
      <div className="rounded-2xl border border-white/[0.07] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.07] bg-[#080E1A]">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Account Settings</h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-white mb-4">Profile Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#7A9AB8] uppercase tracking-wide">Full Name</label>
                    <div className="mt-1 text-sm font-medium text-white bg-[#080E1A] px-3 py-2 rounded-xl border border-white/[0.07]">
                      {currentUser?.firstName} {currentUser?.lastName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#7A9AB8] uppercase tracking-wide">Email Address</label>
                    <div className="mt-1 text-sm font-medium text-white bg-[#080E1A] px-3 py-2 rounded-xl border border-white/[0.07]">
                      {currentUser?.email}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#7A9AB8] uppercase tracking-wide">Role</label>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {currentUser?.role?.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#7A9AB8] uppercase tracking-wide">Last Login</label>
                      <div className="mt-1 text-sm text-[#8FA8CC]">
                        {securityMetrics.lastLogin.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-white mb-4">Password Management</h4>
                
                {!showChangePassword ? (
                  <div className="bg-[#080E1A] border border-white/[0.07] rounded-2xl p-6 text-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 border border-white/[0.07] shadow-sm">
                      <svg className="w-6 h-6 text-[#5A78A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 19l-1 1-1-1-1 1-1-1-1 1-1-1-1 1-2-2m19-7a6 6 0 11-12 0 6 6 0 0112 0z" />
                      </svg>
                    </div>
                    <h5 className="text-sm font-medium text-white">Change Password</h5>
                    <p className="text-xs text-[#7A9AB8] mt-1 mb-4">Update your password regularly to keep your account secure.</p>
                    <button
                      onClick={() => setShowChangePassword(true)}
                      className="inline-flex items-center px-4 py-2 border border-white/[0.10] shadow-sm text-sm font-medium rounded-xl text-[#C5D5EE] bg-white hover:bg-[#080E1A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Update Password
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="bg-[#0A1525] border border-white/[0.07] rounded-2xl p-6 space-y-4 shadow-sm">
                    <div>
                      <label className="block text-sm font-medium text-[#C5D5EE]">Current Password</label>
                      <input
                        type="password"
                        value={passwordData.oldPassword}
                        onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})}
                        className="mt-1 block w-full border border-white/[0.10] rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#C5D5EE]">New Password</label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        className="mt-1 block w-full border border-white/[0.10] rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        minLength={8}
                        required
                      />
                      <p className="mt-1 text-xs text-[#7A9AB8]">Must be at least 8 characters long.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#C5D5EE]">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        className="mt-1 block w-full border border-white/[0.10] rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    {message && (
                      <div className={`p-3 rounded-xl text-sm ${message.includes('success') ? 'bg-[#00C896]/10 text-[#6EE7C2]' : 'bg-[#FF4D6A]/10 text-[#FFB3BE]'}`}>
                        {message}
                      </div>
                    )}

                    <div className="flex space-x-3 pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-[#060C16] hover:bg-[#0D1829] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50"
                      >
                        {loading ? 'Updating...' : 'Update Password'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChangePassword(false)}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-white/[0.10] shadow-sm text-sm font-medium rounded-xl text-[#C5D5EE] bg-white hover:bg-[#080E1A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
