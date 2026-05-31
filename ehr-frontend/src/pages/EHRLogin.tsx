import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Shield, Sparkles, Workflow, ArrowRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ehrApi, tenantApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { cacheTenantBranding, formatTenantDisplayName, applyTenantTheme, getBrandInitials } from '../utils/tenantBranding';

const EHRLogin: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showInfo } = useNotification();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [tenantInfo, setTenantInfo] = useState<{ name: string; logoUrl?: string } | null>(null);
  const [tenantInfoResolved, setTenantInfoResolved] = useState(false);
  const [tenantLogoReady, setTenantLogoReady] = useState(false);
  const [imgError, setImgError] = useState(false);
  const logoSrc = `${process.env.PUBLIC_URL || ''}/umoya-dark.png`;

  useEffect(() => {
    const fetchTenantDetails = async () => {
      if (!tenantSlug) return;
      
      try {
        const response = await tenantApi.getTenantBySlug(tenantSlug);
        const tenant = response.data;
        
        if (tenant) {
          setTenantInfo({
            name: tenant.clinicName,
            logoUrl: tenant.logoUrl
          });
          cacheTenantBranding(tenantSlug, {
            clinicName: tenant.clinicName,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.brandPrimaryColor || undefined,
          });
          applyTenantTheme(tenant.brandPrimaryColor || undefined);
        } else {
          const fallbackName = location.state?.tenantName || formatTenantDisplayName(tenantSlug);
          setTenantInfo({
            name: fallbackName
          });
          cacheTenantBranding(tenantSlug, { clinicName: fallbackName });
        }
      } catch (error) {
        console.error('Failed to fetch tenant details', error);
        // Fallback on error
        const fallbackName = location.state?.tenantName || formatTenantDisplayName(tenantSlug);
        setTenantInfo({
          name: fallbackName
        });
        cacheTenantBranding(tenantSlug, { clinicName: fallbackName });
      } finally {
        setTenantInfoResolved(true);
      }
    };

    fetchTenantDetails();
  }, [tenantSlug, location.state]);

  useEffect(() => {
    setImgError(false);

    if (!tenantInfo?.logoUrl) {
      setTenantLogoReady(true);
      return;
    }

    setTenantLogoReady(false);
    const preloadedImage = new Image();
    preloadedImage.onload = () => setTenantLogoReady(true);
    preloadedImage.onerror = () => {
      setImgError(true);
      setTenantLogoReady(true);
    };
    preloadedImage.src = tenantInfo.logoUrl;
  }, [tenantInfo?.logoUrl]);

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
      } else if (response.data.requiresTwoFactor) {
        localStorage.setItem('ehr_temp_token', response.data.tempToken);
        localStorage.setItem('ehr_tenant', tenantSlug);
        localStorage.setItem('ehr_tenant_slug', tenantSlug);
        navigate(`/ehr/${tenantSlug}/mfa`);
      } else if (response.data.mfaRequired && !response.data.mfaVerified) {
        localStorage.setItem('ehr_token', response.data.token);
        localStorage.setItem('ehr_user', JSON.stringify(response.data.user));
        localStorage.setItem('ehr_tenant', tenantSlug);
        localStorage.setItem('ehr_tenant_slug', tenantSlug);
        localStorage.setItem('ehr_session_timeout_minutes', String(response.data.user?.sessionTimeoutMinutes || response.data.sessionTimeoutMinutes || 60));
        navigate(`/ehr/${tenantSlug}/mfa`);
      } else {
        localStorage.setItem('ehr_token', response.data.token);
        localStorage.setItem('ehr_user', JSON.stringify(response.data.user));
        localStorage.setItem('ehr_tenant', tenantSlug);
        localStorage.setItem('ehr_tenant_slug', tenantSlug);
        localStorage.setItem('ehr_session_timeout_minutes', String(response.data.user?.sessionTimeoutMinutes || response.data.sessionTimeoutMinutes || 60));
        
        // Generate and store session ID for audit logging
        const sessionId = uuidv4();
        localStorage.setItem('ehr_session_id', sessionId);
        
        // Reset welcome message flag
        sessionStorage.removeItem('ehr_welcome_shown');

        // Redirect based on user role
        const role = response.data.user.role;
        switch (role) {
          case 'doctor':
            navigate(`/ehr/${tenantSlug}/doctor`);
            break;
          case 'radiologist':
            navigate(`/ehr/${tenantSlug}/radiologist`);
            break;
          case 'lab_tech':
          case 'lab_technician':
            navigate(`/ehr/${tenantSlug}/lab`);
            break;
          case 'nurse':
          case 'nurse_accounts':
            navigate(`/ehr/${tenantSlug}/nurse`);
            break;
          case 'accounts':
            navigate(`/ehr/${tenantSlug}/dashboard`);
            break;
          default:
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
    <div className="min-h-screen overflow-hidden bg-[#080E1A] px-4 py-8 text-[#E8F0FF] sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-10rem] mx-auto h-[30rem] w-[30rem] rounded-full bg-[#0AA98A]/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[16rem] h-[22rem] w-[22rem] rounded-full bg-[#3B9EFF]/16 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-[20rem] w-[20rem] rounded-full bg-[#E8614D]/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,41,0.94),rgba(8,14,26,0.98))] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0AA98A]/30 bg-[#0AA98A]/12 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5DDBB8]">
            <Sparkles className="h-4 w-4" />
            Staff workspace
          </div>

          <div className="mt-6 flex items-center gap-4">
            <img src={logoSrc} alt="Umoya logo" className="h-14 w-auto" style={{ mixBlendMode: 'screen' }} />
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Umoya</div>
              <h1 style={{ fontFamily: '"Fraunces", serif' }} className="mt-1 text-4xl text-white">
                Clinical intelligence for live care teams.
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#AFC1DF]">
            Sign into the real EHR workspace used for doctor-nurse coordination, CDSS-led execution, PostVisit AI workflows,
            diagnostics, claims readiness, and specialty care operations.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: 'CDSS + AI', body: 'Visible clinical decision support, not hidden add-ons.', icon: Sparkles },
              { title: 'Care coordination', body: 'Triage, abnormal vitals, critical results, and handoffs.', icon: Workflow },
              { title: 'Protected access', body: 'Tenant-aware security, auditability, and controlled entry.', icon: Shield },
            ].map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.title} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#102139] text-[#5DDBB8]">
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
            <div className="text-xs uppercase tracking-[0.24em] text-[#7A92B8]">Clinic access</div>
            <div className="mt-5 flex justify-center">
              <div className="h-28 w-28 rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,169,138,0.14),rgba(43,127,255,0.14))] p-[1px] shadow-[0_0_50px_rgba(10,169,138,0.14)]">
                <div className="h-full w-full overflow-hidden rounded-[29px] bg-[#08111E]">
                  {!tenantInfoResolved || (tenantInfo?.logoUrl && !tenantLogoReady) ? (
                    <div className="h-full w-full animate-pulse bg-[linear-gradient(135deg,rgba(14,24,41,0.98),rgba(16,33,57,0.98))]" />
                  ) : tenantInfo?.logoUrl && !imgError ? (
                    <img
                      src={tenantInfo.logoUrl}
                      alt={`${tenantInfo.name} Logo`}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, var(--ehr-accent, #0AA98A), color-mix(in srgb, var(--ehr-accent, #0AA98A) 55%, #08111E))' }}
                    >
                      <span style={{ fontFamily: '"Fraunces", serif' }} className="text-4xl font-bold tracking-wide text-white">
                        {getBrandInitials(tenantInfo?.name || tenantSlug)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-5 text-3xl text-white">
              {tenantInfo?.name || location.state?.tenantName || tenantSlug?.replace('-', ' ') || 'EHR Login'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#AFC1DF]">
              Access your clinic workspace with the same security and workflow depth shown on the public Umoya site.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {['CDSS', 'PostVisit AI', 'FHIR-ready', 'SNOMED CT', 'Secure clinic routing'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B6C9E6]"
              >
                {tag}
              </span>
            ))}
          </div>

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
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#3B9EFF] focus:ring-2 focus:ring-[#3B9EFF]/20"
                  placeholder="name@example.com"
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
                  className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#3B9EFF] focus:ring-2 focus:ring-[#3B9EFF]/20"
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

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0AA98A] px-6 py-3.5 text-sm font-semibold text-[#040A10] shadow-[0_20px_80px_rgba(10,169,138,0.22)] transition hover:bg-[#12BFAB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#040A10]/30 border-t-[#040A10]"></div>
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
            <div className="flex items-center gap-2 text-[#5DDBB8]">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Secure healthcare login</span>
            </div>
            <p className="mt-2 text-xs leading-6 text-[#8EA7CD]">
              Tenant-aware authentication, session tracking, and protected access into your live Umoya environment.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EHRLogin;
