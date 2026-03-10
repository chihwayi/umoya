import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { Shield, Sparkles, Workflow, ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const logoSrc = '/medicore.png';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.login(email, password);
      onLogin();
    } catch (err) {
      setError('Invalid credentials');
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

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,41,0.94),rgba(8,14,26,0.98))] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00C896]/30 bg-[#00C896]/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7DE8CA]">
            <Sparkles className="h-4 w-4" />
            Super admin
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="rounded-[24px] border border-[#253A58] bg-white/95 p-2 shadow-[0_0_40px_rgba(0,200,150,0.14)]">
              <img src={logoSrc} alt="MediCore logo" className="h-14 w-auto rounded-xl" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">MediCore</div>
              <h1 style={{ fontFamily: '"Fraunces", serif' }} className="mt-1 text-4xl text-white">
                Control the platform, not just a dashboard.
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#AFC1DF]">
            Access the command layer for tenant provisioning, trial approvals, subscription lifecycle control, billing posture,
            integrations, and platform-wide operational visibility.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: 'Tenant control', body: 'Provision demo and paid clinics with module-aware subscriptions.', icon: Workflow },
              { title: 'Platform signals', body: 'Review requests, lifecycle warnings, and deployment posture.', icon: Sparkles },
              { title: 'Protected access', body: 'Restricted super-admin entry for sensitive platform operations.', icon: Shield },
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
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[#7A92B8]">Admin login</div>
            <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-2 text-3xl text-white">
              Sign in to the MediCore control plane.
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#AFC1DF]">
              The same visual language as the public site, tuned for platform administration instead of marketing.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {['Tenant provisioning', 'Demo requests', 'Subscription lifecycle', 'DHIS2-ready'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B6C9E6]"
              >
                {tag}
              </span>
            ))}
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#D8E5F8]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5D789B]" />
                <input
                  type="email"
                  required
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                  placeholder="admin@medicore.co.zw"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7A92B8] transition hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[#FF4D6A]/30 bg-[#FF4D6A]/10 px-4 py-3 text-sm text-[#FFD2DA]">
                {error}
              </div>
            )}

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
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-[#7DE8CA]">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Platform-secure access</span>
            </div>
            <p className="mt-2 text-xs leading-6 text-[#8EA7CD]">
              Restricted super-admin authentication for provisioning, billing posture, and tenant lifecycle operations.
            </p>
          </div>

          <div className="mt-6 text-center text-sm text-[#7A92B8]">
            © {new Date().getFullYear()} MediCore Solutions.
          </div>
        </section>
      </div>
    </div>
  );
};
