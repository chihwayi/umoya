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
      {/* Current User Info */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Account Security</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <div className="mt-1 text-sm text-gray-900">
              {currentUser?.firstName} {currentUser?.lastName}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="mt-1 text-sm text-gray-900">{currentUser?.email}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <div className="mt-1">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {currentUser?.role?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Login</label>
            <div className="mt-1 text-sm text-gray-900">
              {securityMetrics.lastLogin.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Change Password
          </button>
        </div>

        {showChangePassword && (
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <input
                type="password"
                value={passwordData.oldPassword}
                onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="mt-1 block w-full border rounded-md px-3 py-2"
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
            {message && (
              <div className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Security Metrics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Security Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{securityMetrics.totalLogins}</div>
            <div className="text-sm text-gray-600">Total Logins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{securityMetrics.failedAttempts}</div>
            <div className="text-sm text-gray-600">Failed Attempts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{securityMetrics.accountsLocked}</div>
            <div className="text-sm text-gray-600">Locked Accounts</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${securityMetrics.twoFactorEnabled ? 'text-green-600' : 'text-gray-400'}`}>
              {securityMetrics.twoFactorEnabled ? 'ON' : 'OFF'}
            </div>
            <div className="text-sm text-gray-600">2FA Status</div>
          </div>
        </div>
      </div>
    </div>
  );
};