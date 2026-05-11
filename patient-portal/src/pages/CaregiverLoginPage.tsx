import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Users } from 'lucide-react';
import { useCaregiverAuth } from '../contexts/CaregiverAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';

const CaregiverLoginPage: React.FC = () => {
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const { login } = useCaregiverAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password, tenantSlug);
      navigate(`/${tenantSlug}/caregiver/dashboard`);
    } catch (err: any) {
      setError(err.message || 'Caregiver login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <main className="max-w-md mx-auto px-4 py-20">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-6">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">Caregiver Portal</h1>
          <p className="text-sm text-gray-500 text-center mt-1">Caring for: {tenantSlug}</p>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  placeholder="caregiver@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign in as Caregiver'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm">
            <Link to={`/${tenantSlug}/caregiver/set-password`} className="block text-pink-600 hover:text-pink-700 font-semibold">
              Need to set up your password?
            </Link>
            <Link to={`/${tenantSlug}/login`} className="block text-gray-600 hover:text-indigo-600">
              Are you a patient?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CaregiverLoginPage;
