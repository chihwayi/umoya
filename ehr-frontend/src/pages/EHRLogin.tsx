import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ehrAPI, tenantAPI } from '../services/api';

interface Tenant {
  id: string;
  clinicName: string;
  subdomain: string;
  status: string;
}

export const EHRLogin: React.FC = () => {
  const { subdomain } = useParams<{ subdomain: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadTenant();
  }, [subdomain]);

  const loadTenant = async () => {
    try {
      const tenants = await tenantAPI.getAllTenants();
      const foundTenant = tenants.find((t: Tenant) => t.subdomain === subdomain);
      
      if (!foundTenant) {
        setError('Clinic not found');
        return;
      }
      
      if (foundTenant.status !== 'active') {
        setError('Clinic is not active');
        return;
      }
      
      setTenant(foundTenant);
    } catch (error) {
      setError('Failed to load clinic information');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    setLoginLoading(true);
    setError('');

    try {
      const response = await ehrAPI.login(tenant.id, credentials);
      
      // Store auth token and tenant info
      localStorage.setItem('ehrToken', response.token);
      localStorage.setItem('tenantId', tenant.id);
      localStorage.setItem('clinicName', tenant.clinicName);
      localStorage.setItem('userEmail', credentials.email);
      
      // Store user info if available in response
      if (response.user) {
        localStorage.setItem('userRole', response.user.role || 'user');
        localStorage.setItem('userName', `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim());
      }
      
      // Check if password change is required
      if (response.mustChangePassword) {
        navigate(`/ehr/${subdomain}/change-password`);
      } else {
        navigate(`/ehr/${subdomain}/dashboard`);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clinic...</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Clinic Not Found</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Back to Clinic Directory
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">
              {tenant?.clinicName.charAt(0)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{tenant?.clinicName}</h1>
          <p className="text-gray-600">EHR System Login</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={credentials.email}
              onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-colors disabled:opacity-50"
          >
            {loginLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                Signing In...
              </div>
            ) : (
              'Sign In to EHR'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Clinic Directory
          </button>
        </div>
      </div>
    </div>
  );
};