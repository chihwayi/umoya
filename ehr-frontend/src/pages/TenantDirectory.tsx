import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantApi } from '../services/api';
import { Search, ChevronLeft, ChevronRight, Building2, ArrowRight, QrCode } from 'lucide-react';
import { TenantQRModal } from '../components/TenantQRModal';

interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  status: string;
  logoUrl?: string;
  subscriptionTier?: string;
}

const ITEMS_PER_PAGE = 9;

const TenantDirectory: React.FC = () => {
  const navigate = useNavigate();
  const logoSrc = `${process.env.PUBLIC_URL || ''}/medicore.png`;
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [qrTenant, setQrTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await tenantApi.getActiveTenants();
        setTenants(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to fetch tenants', err);
        setError('Failed to load clinic directory');
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) =>
      tenant.clinicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [tenants, searchQuery]);

  const totalPages = Math.ceil(filteredTenants.length / ITEMS_PER_PAGE);
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleTenantSelect = (subdomain: string) => {
    navigate(`/ehr/${subdomain}`);
  };

  const getTierColor = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case 'enterprise':
        return 'border-[#A66CFF]/40 bg-[#A66CFF]/14 text-[#E4D6FF]';
      case 'professional':
        return 'border-[#2B7FFF]/40 bg-[#2B7FFF]/14 text-[#CFE0FF]';
      default:
        return 'border-white/10 bg-white/5 text-[#B9CBE6]';
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#080E1A] text-[#E8F0FF]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-[-12rem] mx-auto h-[34rem] w-[34rem] rounded-full bg-[#00C896]/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[18rem] h-[24rem] w-[24rem] rounded-full bg-[#2B7FFF]/16 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-8rem] h-[22rem] w-[22rem] rounded-full bg-[#FF7A40]/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#080E1A]/75 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="rounded-[20px] border border-[#253A58] bg-white/95 p-2 shadow-[0_0_40px_rgba(0,200,150,0.12)] transition hover:scale-[1.02]"
                  title="Back to MediCore overview"
                >
                  <img src={logoSrc} alt="MediCore logo" className="h-8 w-auto sm:h-10" />
                </button>
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">MediCore</div>
                  <h1 style={{ fontFamily: '"Fraunces", serif' }} className="text-2xl leading-none text-white">
                    Existing Clinic Access
                  </h1>
                  <p className="mt-1 text-sm text-[#8EA7CD]">
                    Search your clinic, then continue to the live MediCore workspace.
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 md:max-w-2xl md:flex-row md:items-center md:justify-end">
                <button
                  onClick={() => navigate('/#request-access')}
                  className="inline-flex items-center justify-center rounded-full border border-[#253A58] bg-[#0E1829]/90 px-5 py-3 text-sm font-medium text-white transition hover:border-[#00C896]/50 hover:bg-[#13233A]"
                >
                  Request test access
                </button>
                <div className="relative w-full md:max-w-md">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Search className="h-5 w-5 text-[#587296]" />
                  </div>
                  <input
                    type="text"
                    className="block w-full rounded-full border border-[#253A58] bg-[#091320] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#4A6080] focus:border-[#2B7FFF] focus:outline-none focus:ring-2 focus:ring-[#2B7FFF]/20"
                    placeholder="Search by clinic name or subdomain..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex-1 max-w-7xl w-full px-4 py-10 sm:px-6 lg:px-8">
          <section className="mb-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[30px] border border-[#253A58] bg-[#0E1829]/92 p-7 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
              <div className="text-xs uppercase tracking-[0.28em] text-[#7A92B8]">Tenant Directory</div>
              <h2 style={{ fontFamily: '"Fraunces", serif' }} className="mt-3 text-4xl leading-tight text-white">
                Pick your clinic and continue into the right MediCore environment.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#AFC1DF]">
                This page is for existing tenants already using MediCore. If you are evaluating the platform,
                return to the main page and request guided access so we can prepare the correct trial environment.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Secure tenant routing', 'Doctor workspaces', 'Patient portal', 'PostVisit AI', 'FHIR + SNOMED', 'DHIS2-ready'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#A8BEDD]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['Active clinics', String(filteredTenants.length), '#00C896'],
                ['Fast access', '1 click', '#2B7FFF'],
                ['Status', 'Operational', '#FFB020'],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <div className="text-xs uppercase tracking-[0.22em] text-[#7A92B8]">{label}</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
                  <div className="mt-4 h-1.5 rounded-full" style={{ backgroundColor: `${color}33` }}>
                    <div className="h-1.5 rounded-full" style={{ width: '68%', backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-white/10 bg-white/5 text-center backdrop-blur-xl">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#00C896]"></div>
              <p className="font-medium text-[#B4C7E6]">Loading clinic directory...</p>
            </div>
          ) : error ? (
            <div className="mx-auto flex h-64 max-w-lg flex-col items-center justify-center rounded-[32px] border border-[#FF4D6A]/20 bg-[#FF4D6A]/8 px-6 text-center">
              <div className="mb-4 rounded-full border border-[#FF4D6A]/20 bg-[#FF4D6A]/10 p-4">
                <Building2 className="h-8 w-8 text-[#FF7D92]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Connection error</h3>
              <p className="mt-2 text-sm text-[#E9B4C0]">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 rounded-full border border-white/10 bg-white/8 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/12"
              >
                Try again
              </button>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-[32px] border border-white/10 bg-white/5 px-6 text-center backdrop-blur-xl">
              <div className="mb-4 rounded-full border border-white/10 bg-[#0E1829] p-4">
                <Search className="h-8 w-8 text-[#6E84A7]" />
              </div>
              <h3 className="text-lg font-medium text-white">No clinics found</h3>
              <p className="mt-2 text-sm text-[#9FB3D3]">
                We could not find any clinics matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between px-1">
                <div className="text-sm font-medium text-[#9FB3D3]">
                  Showing {filteredTenants.length} active {filteredTenants.length === 1 ? 'clinic' : 'clinics'}
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="text-sm font-medium text-[#7DE8CA] transition hover:text-white"
                >
                  Back to overview
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {paginatedTenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    onClick={() => handleTenantSelect(tenant.subdomain)}
                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,24,41,0.98),rgba(8,14,26,0.98))] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-[#00C896]/30"
                  >
                    {/* QR button — top-right, stops propagation so card click doesn't fire */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setQrTenant(tenant); }}
                      title="View / Print QR code"
                      className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#00C896]/30 bg-[#00C896]/10 text-[#7DE8CA] opacity-0 transition duration-200 hover:bg-[#00C896]/25 group-hover:opacity-100"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                    <div className="absolute right-5 top-5 opacity-0 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100 group-hover:opacity-0">
                      <ArrowRight className="h-5 w-5 text-[#7DE8CA]" />
                    </div>

                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-[#102139]">
                        {tenant.logoUrl ? (
                          <img src={tenant.logoUrl} alt={tenant.clinicName} className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                          <Building2 className="h-7 w-7 text-[#2B7FFF]" />
                        )}
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getTierColor(tenant.subscriptionTier)}`}>
                        {tenant.subscriptionTier || 'Standard'}
                      </span>
                    </div>

                    <div className="mb-5">
                      <h3 className="text-xl font-semibold text-white transition group-hover:text-[#7DE8CA]">
                        {tenant.clinicName}
                      </h3>
                      <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-[#A8BEDD]">
                        {tenant.subdomain}.medicore.health
                      </p>
                    </div>

                    <div className="mt-auto border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#CBEBDD]">
                          <div className="h-2.5 w-2.5 rounded-full bg-[#00C896] shadow-[0_0_14px_rgba(0,200,150,0.7)]" />
                          <span className="font-medium">System operational</span>
                        </div>
                        <span className="font-medium text-[#7DE8CA]">Access portal</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-full border border-white/10 bg-white/5 p-3 text-[#A8BEDD] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`h-10 w-10 rounded-full text-sm font-medium transition ${
                          currentPage === page
                            ? 'bg-[#00C896] text-[#051119] shadow-[0_12px_40px_rgba(0,200,150,0.28)]'
                            : 'border border-white/10 bg-white/5 text-[#B2C6E3] hover:bg-white/10'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-full border border-white/10 bg-white/5 p-3 text-[#A8BEDD] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <footer className="border-t border-white/10 bg-[#080E1A]/70 py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-[#7F96BA] sm:px-6 md:flex-row lg:px-8">
            <p>© {new Date().getFullYear()} MediCore Health Systems. Intelligent workflows for modern clinics.</p>
            <div className="flex gap-6">
              <button onClick={() => navigate('/')} className="transition hover:text-white">Overview</button>
              <button onClick={() => navigate('/#request-access')} className="transition hover:text-white">Request Access</button>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="transition hover:text-white">Back to Top</button>
            </div>
          </div>
        </footer>
      </div>

      {qrTenant && (
        <TenantQRModal tenant={qrTenant} onClose={() => setQrTenant(null)} />
      )}
    </div>
  );
};

export default TenantDirectory;
