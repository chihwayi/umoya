import React, { useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { LogIn, Mail, Lock, AlertCircle, Eye, EyeOff, Shield, Sparkles, Smartphone, HeartPulse } from 'lucide-react';

const LoginPage: React.FC = () => {
  const logoSrc = `${process.env.PUBLIC_URL || ''}/medicore.png`;
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { login } = usePatientAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Use fallback tenant if not in URL
  const effectiveTenantSlug = tenantSlug || 'demo-clinic';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);

    try {
      await login(formData.email, formData.password, effectiveTenantSlug);
      navigate(`/${effectiveTenantSlug}/dashboard`);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#080E1A] px-4 py-8 text-[#E8F0FF] sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-10rem] mx-auto h-[32rem] w-[32rem] rounded-full bg-[#00C896]/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[16rem] h-[24rem] w-[24rem] rounded-full bg-[#2B7FFF]/16 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-[#FF7A40]/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,41,0.94),rgba(8,14,26,0.98))] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00C896]/30 bg-[#00C896]/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7DE8CA]">
            <Smartphone className="h-4 w-4" />
            Patient portal
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="rounded-[24px] border border-[#253A58] bg-white/95 p-2 shadow-[0_0_40px_rgba(0,200,150,0.14)]">
              <img src={logoSrc} alt="MediCore logo" className="h-14 w-auto rounded-xl" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">MediCore</div>
              <h1 style={{ fontFamily: '"Fraunces", serif' }} className="mt-1 text-4xl text-white">
                Your records, follow-up, and guidance in one place.
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#AFC1DF]">
            The patient side of MediCore connects signed visit summaries, reminders, medications, secure messages, bills,
            and future mobile workflows without feeling disconnected from the clinical system.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: 'PostVisit AI', body: 'Patient-friendly follow-up from signed clinical notes.', icon: Sparkles },
              { title: 'Health access', body: 'Records, reminders, and secure communication in one portal.', icon: HeartPulse },
              { title: 'Protected entry', body: 'Private, tenant-aware access to your clinic account.', icon: Shield },
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

        <section className="rounded-[36px] border border-[#253A58] bg-[linear-gradient(180deg,rgba(14,24,41,0.98),rgba(8,14,26,0.99))] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,200,150,0.18),rgba(43,127,255,0.18))]">
              <LogIn className="h-8 w-8 text-[#7DE8CA]" />
            </div>
            <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-5 text-3xl text-white">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-[#AFC1DF]">Sign in to your patient portal account.</p>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-[#FF4D6A]/30 bg-[#FF4D6A]/10 px-4 py-3 text-sm text-[#FFD2DA]">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#D8E5F8]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5D789B]" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#D8E5F8]">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5D789B]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7A92B8] transition hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-[#9FB3D3]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#253A58] bg-[#091320] text-[#00C896] focus:ring-[#00C896]"
                />
                <span>Remember me</span>
              </label>
              <Link to={`/${effectiveTenantSlug}/reset-password`} className="text-sm font-medium text-[#7DE8CA] transition hover:text-white">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#00C896] px-6 py-3.5 text-sm font-semibold text-[#051119] shadow-[0_20px_80px_rgba(0,200,150,0.22)] transition hover:bg-[#24D9A8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#051119]/30 border-t-[#051119]"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <LogIn className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#9FB3D3]">
              Don&apos;t have an account?{' '}
              <Link to={`/${effectiveTenantSlug}/register`} className="font-semibold text-[#7DE8CA] transition hover:text-white">
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-6 border-t border-white/10 pt-6 text-center text-xs text-[#6F87AB]">
            By signing in, you agree to the MediCore patient portal terms and privacy controls.
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
