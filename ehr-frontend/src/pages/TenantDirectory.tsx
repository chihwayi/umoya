import React, { useState, useEffect } from 'react';
import { tenantAPI } from '../services/api';

interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  status: string;
  subscriptionTier: string;
  contactEmail: string;
  city?: string;
}

export const TenantDirectory: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await tenantAPI.getAllTenants();
      setTenants(data.filter((t: Tenant) => t.status === 'active'));
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTenantClick = (tenant: Tenant) => {
    const ehrUrl = `${window.location.origin}/ehr/${tenant.subdomain}`;
    window.location.href = ehrUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clinics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">MediCore EHR System</h1>
          <p className="text-xl text-gray-600">Select your clinic to access the EHR system</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              onClick={() => handleTenantClick(tenant)}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 p-6"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {tenant.clinicName.charAt(0)}
                  </span>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">{tenant.clinicName}</h3>
                  <p className="text-sm text-gray-500">{tenant.city}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    {tenant.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Plan:</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {tenant.subscriptionTier}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">URL:</span>
                  <span className="text-xs text-gray-500">{tenant.subdomain}.medicore.co.zw</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-colors">
                  Access EHR System
                </button>
              </div>
            </div>
          ))}
        </div>

        {tenants.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🏥</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Active Clinics</h3>
            <p className="text-gray-500">No clinics are currently available in the system.</p>
          </div>
        )}
      </div>
    </div>
  );
};