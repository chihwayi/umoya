import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';

type Banner = {
  type: 'success' | 'error';
  message: string;
};

const ResetPasswordPage: React.FC = () => {
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const isSetPasswordMode = !!token;

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const strength = useMemo(() => {
    if (!newPassword) return { label: '', bars: 0, color: 'bg-gray-200' };
    if (newPassword.length < 8) return { label: 'Weak', bars: 1, color: 'bg-red-500' };
    const mixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (newPassword.length >= 10 && hasNumber && hasSpecial) return { label: 'Strong', bars: 3, color: 'bg-green-500' };
    if (mixedCase || hasNumber || hasSpecial) return { label: 'Medium', bars: 2, color: 'bg-yellow-500' };
    return { label: 'Weak', bars: 1, color: 'bg-red-500' };
  }, [newPassword]);

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setBanner(null);
    setLoading(true);
    try {
      await patientPortalApi.forgotPassword(email, tenantSlug);
      setBanner({
        type: 'success',
        message: "Check your email. If an account exists, you'll receive a reset link shortly.",
      });
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to send reset email' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBanner(null);
    if (newPassword !== confirmPassword) {
      setBanner({ type: 'error', message: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setBanner({ type: 'error', message: 'Password must be at least 8 characters' });
      return;
    }

    setLoading(true);
    try {
      await patientPortalApi.resetPassword(token, newPassword, tenantSlug);
      setBanner({ type: 'success', message: 'Password reset successfully. Redirecting to login...' });
      window.setTimeout(() => navigate(`/${tenantSlug}/login`), 2000);
    } catch {
      setBanner({
        type: 'error',
        message: 'This reset link has expired or is invalid. Please request a new one.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <main className="max-w-md mx-auto px-4 py-20">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-6">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            {isSetPasswordMode ? 'Set New Password' : 'Reset Password'}
          </h1>
          <p className="text-sm text-gray-500 text-center mt-2">
            {isSetPasswordMode
              ? 'Choose a strong password for your account'
              : "Enter your email and we'll send you a reset link"}
          </p>

          {banner && (
            <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm border ${
                banner.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <p>{banner.message}</p>
              {banner.type === 'error' && isSetPasswordMode && (
                <Link to={`/${tenantSlug}/reset-password`} className="inline-block mt-2 font-semibold underline">
                  Request a new reset link
                </Link>
              )}
            </div>
          )}

          {isSetPasswordMode ? (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-10 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {[1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className={`h-2 flex-1 rounded-full ${bar <= strength.bars ? strength.color : 'bg-gray-200'}`}
                    />
                  ))}
                  {strength.label && <span className="text-xs font-semibold text-gray-500">{strength.label}</span>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
              >
                {loading ? 'Saving...' : 'Set new password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <Link to={`/${tenantSlug}/login`} className="block text-center text-sm text-indigo-600 hover:text-indigo-700 font-semibold mt-6">
            ← Back to login
          </Link>
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
