import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Search, ArrowRight, AlertCircle, Heart, Shield, Sparkles } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_EHR_API_URL;

interface Tenant {
  id: string;
  subdomain: string;
  name?: string;
}

const TenantSelectorPage: React.FC = () => {
  const navigate = useNavigate();
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
      } else {
        // Fallback: Use known tenants if API fails
        setTenants([
          { id: '1', subdomain: 'bulawayo-general', name: 'Bulawayo General Clinic' },
        ]);
      }
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      // Fallback: Use known tenants
      setTenants([
        { id: '1', subdomain: 'bulawayo-general', name: 'Bulawayo General Clinic' },
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
    <div className="min-h-screen flex">
      {/* Left Side - Branding & Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Heart className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold">MediCore</h1>
            </div>
            <p className="text-xl text-white/90 font-light">Patient Portal</p>
          </div>

          <div className="space-y-6 mt-12">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Secure & Private</h3>
                <p className="text-white/80 text-sm">Your medical information is encrypted and protected</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Easy Access</h3>
                <p className="text-white/80 text-sm">View your records, appointments, and more in one place</p>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-20 right-20 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Right Side - Tenant Selector */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MediCore</h1>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 sm:p-10 border border-white/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Your Clinic</h2>
              <p className="text-gray-600">Choose your healthcare provider to access your patient portal</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
                  placeholder="Search for your clinic..."
                />
              </div>
            </div>

            {/* Tenant List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading clinics...</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No clinics found</p>
                <p className="text-sm text-gray-500 mt-2">
                  {searchTerm ? 'Try a different search term' : 'Please contact your clinic for access'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleTenantSelect(tenant.subdomain)}
                    className="w-full p-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900 group-hover:text-indigo-700">
                          {tenant.name || tenant.subdomain.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <p className="text-sm text-gray-500">{tenant.subdomain}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-center text-gray-500">
                Can't find your clinic?{' '}
                <a href="mailto:support@medicore.co.zw" className="text-indigo-600 hover:underline">
                  Contact Support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantSelectorPage;


