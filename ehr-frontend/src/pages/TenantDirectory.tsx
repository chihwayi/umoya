import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantApi } from '../services/api';
import { Search, ChevronLeft, ChevronRight, Building2, Stethoscope, ArrowRight } from 'lucide-react';

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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await tenantApi.getActiveTenants();
        setTenants(response.data);
      } catch (err) {
        console.error('Failed to fetch tenants', err);
        setError('Failed to load clinic directory');
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  // Filter tenants based on search query
  const filteredTenants = useMemo(() => {
    return tenants.filter(tenant => 
      tenant.clinicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tenants, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTenants.length / ITEMS_PER_PAGE);
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleTenantSelect = (subdomain: string) => {
    navigate(`/ehr/${subdomain}`);
  };

  const getTierColor = (tier?: string) => {
    switch(tier?.toLowerCase()) {
      case 'enterprise': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'professional': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="bg-slate-900 p-2 rounded-lg shadow-lg shadow-slate-900/20 transition hover:scale-[1.02]"
                title="Back to MediCore overview"
              >
                <Stethoscope className="w-6 h-6 text-white" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">MediCore Tenant Access</h1>
                <p className="text-xs text-slate-500 font-medium">Existing clinic directory and login entry point</p>
              </div>
            </div>
            
            <div className="flex w-full flex-col gap-3 md:max-w-2xl md:flex-row md:items-center md:justify-end">
              <button
                onClick={() => navigate('/#request-access')}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Request test access
              </button>
              <div className="relative max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 sm:text-sm shadow-sm"
                  placeholder="Search for a clinic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Loading medical directory...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center max-w-lg mx-auto">
            <div className="bg-red-50 p-4 rounded-full mb-4">
              <Building2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Connection Error</h3>
            <p className="text-slate-500 mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors shadow-sm"
            >
              Try Again
            </button>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No clinics found</h3>
            <p className="text-slate-500">
              We couldn't find any clinics matching "{searchQuery}"
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-slate-500 font-medium px-1">
              Showing {filteredTenants.length} active {filteredTenants.length === 1 ? 'clinic' : 'clinics'}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedTenants.map((tenant) => (
                <div 
                  key={tenant.id}
                  onClick={() => handleTenantSelect(tenant.subdomain)}
                  className="group bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowRight className="w-5 h-5 text-blue-500 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-100 group-hover:scale-105 transition-transform duration-300">
                      <Building2 className="w-8 h-8 text-blue-600" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border uppercase tracking-wide ${getTierColor(tenant.subscriptionTier)}`}>
                      {tenant.subscriptionTier || 'Standard'}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {tenant.clinicName}
                    </h3>
                    <p className="text-sm text-slate-500 font-mono bg-slate-50 inline-block px-2 py-0.5 rounded border border-slate-100">
                      {tenant.subdomain}.medicore.health
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="font-medium text-emerald-700">System Operational</span>
                    </div>
                    <span className="group-hover:translate-x-1 transition-transform duration-300 text-blue-600 font-medium">
                      Access Portal
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} MediCore Health Systems. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-500">
            <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">Overview</button>
            <button onClick={() => navigate('/#request-access')} className="hover:text-blue-600 transition-colors">Request Access</button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-blue-600 transition-colors">Back to Top</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TenantDirectory;
