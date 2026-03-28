import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight, Shield, Sparkles, Smartphone } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { patientPortalApi } from '../services/api';

const PatientPortalLogin: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const brandLogoSrc = `${process.env.PUBLIC_URL || ''}/medicore.png`;
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
    <div className="min-h-screen overflow-hidden bg-[#080E1A] px-4 py-8 text-[#E8F0FF]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-10rem] mx-auto h-[32rem] w-[32rem] rounded-full bg-[#00C896]/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[16rem] h-[24rem] w-[24rem] rounded-full bg-[#2B7FFF]/16 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-[#FF7A40]/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,41,0.94),rgba(8,14,26,0.98))] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00C896]/30 bg-[#00C896]/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7DE8CA]">
            <Smartphone className="h-4 w-4" />
            Patient access
          </div>
          <div className="mt-6 flex items-center gap-4">
            <div className="rounded-[24px] border border-[#253A58] bg-white/95 p-2 shadow-[0_0_40px_rgba(0,200,150,0.14)]">
              <img src={brandLogoSrc} alt="MediCore logo" className="h-14 w-auto rounded-xl" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">MediCore</div>
              <h1 style={{ fontFamily: '"Fraunces", serif' }} className="mt-1 text-4xl text-white">
                Patient portal access for {tenantSlug}.
              </h1>
            </div>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-7 text-[#AFC1DF]">
            Continue into visit summaries, PostVisit AI follow-up, reminders, and patient communication under the same
            design language as the rest of MediCore.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: 'PostVisit AI', body: 'Patient-friendly visit summaries and next-step guidance.', icon: Sparkles },
              { title: 'Protected access', body: 'Tenant-aware authentication for the right clinic portal.', icon: Shield },
              { title: 'Mobile-ready', body: 'Consistent patient experience across web and future mobile.', icon: Smartphone },
            ].map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.title} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#102139] text-[#7DE8CA]">
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#97ADCF]">{item.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[36px] border border-[#253A58] bg-[linear-gradient(180deg,rgba(14,24,41,0.98),rgba(8,14,26,0.99))] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-[20px] border border-white/10 bg-white/5 p-2">
              <img src={brandLogoSrc} alt="MediCore logo" className="h-10 w-auto rounded-lg" />
            </div>
            <div>
              <h2 style={{ fontFamily: '"Fraunces", serif' }} className="text-2xl text-white">Patient Portal</h2>
              <p className="text-xs text-[#7A92B8]">Tenant: {tenantSlug}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#D8E5F8]">
                <Mail className="h-4 w-4" />
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#D8E5F8]">
                <Lock className="h-4 w-4" />
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full rounded-2xl border border-[#253A58] bg-[#091320] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              onClick={login}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00C896] px-6 py-3.5 text-sm font-semibold text-[#051119] shadow-[0_20px_80px_rgba(0,200,150,0.22)] transition hover:bg-[#24D9A8] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              Sign in
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PatientPortalLogin;
