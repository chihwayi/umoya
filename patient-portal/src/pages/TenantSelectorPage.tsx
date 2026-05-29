import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, ArrowRight, AlertCircle, Shield, Sparkles } from 'lucide-react';
import { runtimeUrls } from '../config/runtime';

const API_BASE_URL = runtimeUrls.ehrApi;

interface Tenant {
  id: string;
  subdomain: string;
  name?: string;
}

const TenantSelectorPage: React.FC = () => {
  const navigate = useNavigate();
  const logoSrc = `${process.env.PUBLIC_URL || ''}/umoya.png`;
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      // Fetch active tenants from master database
      const response = await fetch(`${API_BASE_URL}/tenants/active`);
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || data || []);
        setError('');
      } else {
        setError('Unable to load the live clinic directory. Showing fallback access.');
        // Fallback: Use known tenants if API fails
        setTenants([
          { id: '1', subdomain: 'demo-clinic', name: 'Demo Clinic' },
        ]);
      }
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      setError('Unable to load the live clinic directory. Showing fallback access.');
      // Fallback: Use known tenants
      setTenants([
        { id: '1', subdomain: 'demo-clinic', name: 'Demo Clinic' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter((tenant) =>
    tenant.subdomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tenant.name && tenant.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleTenantSelect = (tenantSlug: string) => {
    navigate(`/${tenantSlug}/login`);
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
            <Sparkles className="h-4 w-4" />
            Choose your clinic
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="rounded-[24px] border border-[#253A58] bg-white/95 p-2 shadow-[0_0_40px_rgba(0,200,150,0.14)]">
              <img src={logoSrc} alt="Umoya logo" className="h-14 w-auto rounded-xl" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Umoya</div>
              <h1 style={{ fontFamily: '"Fraunces", serif' }} className="mt-1 text-4xl text-white">
                Patient access should feel as polished as care delivery.
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-7 text-[#AFC1DF]">
            Pick the clinic you belong to, then continue into the patient portal for visit summaries, reminders,
            bills, secure follow-up, and future mobile-linked workflows.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: 'Private by default', body: 'Tenant-aware routing into the correct clinic environment.', icon: Shield },
              { title: 'Simple discovery', body: 'Search by clinic name or subdomain in one step.', icon: Search },
              { title: 'Connected experience', body: 'Portal, reminders, and mobile direction under one brand.', icon: Sparkles },
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
              <Building2 className="h-8 w-8 text-[#7DE8CA]" />
            </div>
            <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-5 text-3xl text-white">
              Select your clinic
            </h2>
            <p className="mt-2 text-sm text-[#AFC1DF]">Choose your healthcare provider to continue into the patient portal.</p>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-[#FF4D6A]/30 bg-[#FF4D6A]/10 px-4 py-3 text-sm text-[#FFD2DA]">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-5 w-5 text-[#5D789B]" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-[#253A58] bg-[#091320] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:ring-2 focus:ring-[#2B7FFF]/20"
                placeholder="Search for your clinic..."
              />
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#00C896] border-t-transparent" />
              <p className="text-[#AFC1DF]">Loading clinics...</p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-10 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-[#7A92B8]" />
              <p className="text-white">No clinics found</p>
              <p className="mt-2 text-sm text-[#8EA7CD]">
                {searchTerm ? 'Try a different search term.' : 'Please contact your clinic for access.'}
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantSelect(tenant.subdomain)}
                  className="group flex w-full items-center justify-between rounded-[22px] border border-white/10 bg-white/5 p-4 text-left transition hover:border-[#00C896]/40 hover:bg-white/8"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#102139] text-[#7DE8CA]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-white group-hover:text-[#7DE8CA]">
                        {tenant.name || tenant.subdomain.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      <p className="text-sm text-[#8EA7CD]">{tenant.subdomain}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-[#7A92B8] transition group-hover:translate-x-1 group-hover:text-[#7DE8CA]" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-[#6F87AB]">
            Can&apos;t find your clinic?{' '}
            <a href="mailto:support@umoya.health" className="text-[#7DE8CA] transition hover:text-white">
              Contact Support
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TenantSelectorPage;
