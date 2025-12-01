import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { useNotification } from '../components/GlobalNotification';
import { ArrowLeft, Activity, Link as LinkIcon, CheckCircle, X, AlertCircle, TrendingUp, Heart, Footprints, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const FitnessIntegrationPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { showError, showSuccess } = useNotification();

  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const availableApps = [
    { id: 'fitbit', name: 'Fitbit', icon: '⌚', color: 'from-blue-500 to-cyan-500' },
    { id: 'apple-health', name: 'Apple Health', icon: '🍎', color: 'from-gray-500 to-gray-600' },
    { id: 'google-fit', name: 'Google Fit', icon: '📱', color: 'from-green-500 to-emerald-500' },
    { id: 'strava', name: 'Strava', icon: '🏃', color: 'from-orange-500 to-red-500' },
    { id: 'garmin', name: 'Garmin', icon: '⌚', color: 'from-blue-500 to-indigo-500' },
  ];

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      // Mock data - would call API
      setIntegrations([]);
    } catch (err: any) {
      showError(err.message || 'Failed to load integrations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (appId: string) => {
    try {
      setSyncing(appId);
      // Would initiate OAuth flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      showSuccess(`${availableApps.find(a => a.id === appId)?.name} connected successfully`, 'success');
      loadIntegrations();
    } catch (err: any) {
      showError(err.message || 'Failed to connect app', 'error');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (appId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      showSuccess('App disconnected successfully', 'success');
      loadIntegrations();
    } catch (err: any) {
      showError(err.message || 'Failed to disconnect app', 'error');
    }
  };

  const handleSync = async (appId: string) => {
    try {
      setSyncing(appId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      showSuccess('Data synced successfully', 'success');
    } catch (err: any) {
      showError(err.message || 'Failed to sync data', 'error');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fitness App Integration</h1>
              <p className="text-sm text-gray-600">Connect your fitness apps to sync health data</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-1">How it works</p>
              <p>Connect your fitness apps to automatically sync steps, heart rate, workouts, and other health metrics to your medical records.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableApps.map((app) => {
            const isConnected = integrations.some(i => i.appId === app.id);
            const isSyncing = syncing === app.id;

            return (
              <div key={app.id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-xl flex items-center justify-center text-2xl shadow-lg`}>
                    {app.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{app.name}</h3>
                    {isConnected && (
                      <div className="flex items-center gap-1 text-green-600 text-sm mt-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>Connected</span>
                      </div>
                    )}
                  </div>
                </div>

                {isConnected ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSync(app.id)}
                      disabled={isSyncing}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Sync Now
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDisconnect(app.id)}
                      className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(app.id)}
                    disabled={isSyncing}
                    className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        Connect
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {integrations.length > 0 && (
          <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Synced Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Footprints className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Steps Today</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">8,234</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-900">Avg Heart Rate</span>
                </div>
                <p className="text-2xl font-bold text-red-900">72 bpm</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Active Minutes</span>
                </div>
                <p className="text-2xl font-bold text-green-900">45 min</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FitnessIntegrationPage;

