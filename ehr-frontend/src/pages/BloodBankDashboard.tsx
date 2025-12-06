import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Droplet, Activity, AlertTriangle, TrendingUp, Loader2, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useNotification } from '../components/GlobalNotification';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

const BloodBankDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const [inventory, setInventory] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [activeTransfusions, setActiveTransfusions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState('all');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [selectedComponent]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load inventory
      const inventoryParams: any = { status: 'available' };
      if (selectedComponent !== 'all') {
        inventoryParams.componentType = selectedComponent;
      }
      const inventoryResponse = await ehrAxios.get('/blood-bank/inventory', {
        params: inventoryParams,
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setInventory(inventoryResponse.data || []);

      // Load stats
      const statsResponse = await ehrAxios.get('/blood-bank/inventory/stats', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setStats(statsResponse.data || []);

      // Load active transfusions
      const transfusionsResponse = await ehrAxios.get('/blood-bank/transfusions/active', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setActiveTransfusions(transfusionsResponse.data || []);
    } catch (error) {
      showError('Error', 'Failed to load blood bank data');
    } finally {
      setLoading(false);
    }
  };

  const getBloodGroupColor = (group: string) => {
    switch (group) {
      case 'O': return 'from-red-500 to-rose-600';
      case 'A': return 'from-blue-500 to-cyan-600';
      case 'B': return 'from-purple-500 to-violet-600';
      case 'AB': return 'from-pink-500 to-rose-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const components = [
    { value: 'all', label: 'All Components' },
    { value: 'packed_rbc', label: 'Packed RBC' },
    { value: 'ffp', label: 'FFP (Plasma)' },
    { value: 'platelets', label: 'Platelets' },
    { value: 'whole_blood', label: 'Whole Blood' },
    { value: 'cryoprecipitate', label: 'Cryoprecipitate' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading blood bank...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Droplet className="w-8 h-8" />
                  Blood Bank Dashboard
                </h1>
                <p className="text-red-100 mt-1">Inventory & transfusion management</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Component Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {components.map((comp) => (
            <button
              key={comp.value}
              onClick={() => setSelectedComponent(comp.value)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                selectedComponent === comp.value
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
              }`}
            >
              {comp.label}
            </button>
          ))}
        </div>

        {/* Active Transfusions */}
      {activeTransfusions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600 animate-pulse" />
            Active Transfusions ({activeTransfusions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTransfusions.map((transfusion) => (
              <div key={transfusion.id} className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-red-300 shadow-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900">
                    {transfusion.patient?.firstName} {transfusion.patient?.lastName}
                  </h3>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                    IN PROGRESS
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  <strong>Unit:</strong> {transfusion.inventory?.unitNumber} ({transfusion.inventory?.componentType})
                </p>
                <p className="text-sm text-slate-700">
                  <strong>Started:</strong> {new Date(transfusion.startTime).toLocaleTimeString()}
                </p>
                <p className="text-sm text-slate-600">
                  By: {transfusion.administeredBy?.firstName} {transfusion.administeredBy?.lastName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Available Blood Products</h2>
        {inventory.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <AlertTriangle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Units Available</h3>
            <p className="text-slate-600">No blood products match the selected criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((unit) => (
              <div
                key={unit.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className={`bg-gradient-to-r ${getBloodGroupColor(unit.bloodGroup)} text-white p-4`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{unit.bloodGroup}{unit.rhFactor === 'positive' ? '+' : '-'}</h3>
                      <p className="text-sm opacity-90">{unit.componentType.replace('_', ' ').toUpperCase()}</p>
                    </div>
                    <Droplet className="w-8 h-8 opacity-80" />
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-700 mb-1">
                    <strong>Unit:</strong> {unit.unitNumber}
                  </p>
                  <p className="text-sm text-slate-700 mb-1">
                    <strong>Volume:</strong> {unit.volumeMl} mL
                  </p>
                  <p className="text-sm text-slate-700 mb-1">
                    <strong>Expires:</strong> {new Date(unit.expiryDate).toLocaleDateString()}
                  </p>
                  {unit.storageLocation && (
                    <p className="text-xs text-slate-600 mt-2">
                      📍 {unit.storageLocation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default BloodBankDashboard;

