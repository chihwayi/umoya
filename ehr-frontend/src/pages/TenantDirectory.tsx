import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Users, ArrowRight, Search, Stethoscope } from 'lucide-react';
import { tenantApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  city?: string;
  subscriptionTier: string;
}

const TenantDirectory: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { showError, showInfo } = useNotification();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await tenantApi.getActiveTenants();
      setTenants(response.data);
      showInfo('Clinics Loaded', `Found ${response.data.length} active clinics`);
    } catch (error) {
      showError('Connection Error', 'Failed to load clinic directory');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.clinicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTenantSelect = (tenant: Tenant) => {
    navigate(`/ehr/${tenant.subdomain}`, { 
      state: { tenantName: tenant.clinicName } 
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-gradient-to-r from-purple-500 to-indigo-600';
      case 'professional': return 'bg-gradient-to-r from-blue-500 to-cyan-600';
      default: return 'bg-gradient-to-r from-emerald-500 to-teal-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading clinic directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                MediCore EHR
              </h1>
              <p className="text-slate-600">Select your healthcare facility</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search clinics or cities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Clinics Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTenants.map((tenant) => (
            <div
              key={tenant.id}
              onClick={() => handleTenantSelect(tenant)}
              className="group bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer hover:-translate-y-1"
            >
              {/* Tier Badge */}
              <div className="flex justify-between items-start mb-4">
                <div className={`${getTierColor(tenant.subscriptionTier)} text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide`}>
                  {tenant.subscriptionTier}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </div>

              {/* Clinic Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">
                      {tenant.clinicName}
                    </h3>
                    <p className="text-slate-500 text-sm">@{tenant.subdomain}</p>
                  </div>
                </div>

                {tenant.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <p className="text-slate-600 text-sm">
                      {tenant.address}
                      {tenant.city && `, ${tenant.city}`}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-slate-600 text-sm">{tenant.contactEmail}</p>
                </div>
              </div>

              {/* Hover Effect */}
              <div className="mt-4 pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-blue-600 text-sm font-medium">Click to access EHR system →</p>
              </div>
            </div>
          ))}
        </div>

        {filteredTenants.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No clinics found</h3>
            <p className="text-slate-500">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantDirectory;