import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight, Stethoscope } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { patientPortalApi } from '../services/api';

const PatientPortalLogin: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!tenantSlug) return;
    if (!email.trim() || !password) {
      showError('Missing info', 'Email and password are required.');
      return;
    }
    try {
      setLoading(true);
      const res = await patientPortalApi.patientLogin(email.trim(), password, tenantSlug);
      const token = res.data?.access_token || res.data?.token;
      if (!token) throw new Error('No token returned');
      localStorage.setItem('patient_portal_token', token);
      localStorage.setItem('patient_portal_user', JSON.stringify(res.data?.patient || res.data?.user || {}));
      showSuccess('Welcome', 'Logged into patient portal.');
      navigate(`/portal/${tenantSlug}`);
    } catch (e: any) {
      showError('Login failed', e?.response?.data?.message || e?.message || 'Unable to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Patient Portal</h1>
            <p className="text-xs text-slate-500">Tenant: {tenantSlug}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            onClick={login}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-semibold"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientPortalLogin;

