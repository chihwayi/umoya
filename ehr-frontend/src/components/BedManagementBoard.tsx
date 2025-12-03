import React, { useState, useEffect } from 'react';
import {
  Bed, Users, Activity, Clock, AlertCircle, CheckCircle, Loader2,
  ArrowRight, Home, Filter, RefreshCw, Maximize2
} from 'lucide-react';
import { ehrApi } from '../services/api';
import axios from 'axios';
import { useNotification } from './GlobalNotification';
import AdmittedPatientWorkflow from './AdmittedPatientWorkflow';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

interface BedManagementBoardProps {
  tenantSlug: string;
  token: string;
}

const BedManagementBoard: React.FC<BedManagementBoardProps> = ({
  tenantSlug,
  token,
}) => {
  const { showError, showSuccess } = useNotification();
  const [beds, setBeds] = useState<any[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [occupancyStats, setOccupancyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [showPatientWorkflow, setShowPatientWorkflow] = useState(false);

  useEffect(() => {
    loadBeds();
    loadWards();
    loadOccupancy();
    
    // Auto-refresh every 30 seconds
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadBeds();
        loadOccupancy();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedWard, autoRefresh]);

  const loadBeds = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedWard !== 'all') params.wardName = selectedWard;
      
      const response = await ehrAxios.get('/beds', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        params
      });
      setBeds(response.data || []);
    } catch (error) {
      console.error('Failed to load beds:', error);
      setBeds([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWards = async () => {
    try {
      const response = await ehrAxios.get('/beds/wards', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setWards(response.data || []);
    } catch (error) {
      console.error('Failed to load wards:', error);
      setWards([]);
    }
  };

  const loadOccupancy = async () => {
    if (!token || !tenantSlug || token === 'null' || token === 'undefined') return;
    try {
      const response = await ehrAxios.get('/beds/occupancy', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
        params: { wardName: selectedWard !== 'all' ? selectedWard : null },
      });
      setOccupancyStats(response.data);
    } catch (error) {
      // Silently ignore all errors to prevent console spam
    }
  };

  const getBedStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'from-green-500 to-emerald-600';
      case 'occupied': return 'from-red-500 to-rose-600';
      case 'reserved': return 'from-blue-500 to-cyan-600';
      case 'cleaning': return 'from-yellow-500 to-amber-600';
      case 'blocked': return 'from-slate-500 to-slate-600';
      case 'maintenance': return 'from-orange-500 to-red-500';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  const getBedStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      case 'occupied': return <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      case 'reserved': return <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      case 'cleaning': return <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
      default: return <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />;
    }
  };

  const groupedBeds = beds.reduce((acc, bed) => {
    if (!acc[bed.wardName]) acc[bed.wardName] = [];
    acc[bed.wardName].push(bed);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Occupancy Stats */}
      {occupancyStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-700 opacity-90"></div>
            <div className="relative p-3 sm:p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{occupancyStats.totalBeds}</div>
              <div className="text-xs sm:text-sm text-white/90">Total Beds</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-90"></div>
            <div className="relative p-3 sm:p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{occupancyStats.available}</div>
              <div className="text-xs sm:text-sm text-white/90">Available</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-600 opacity-90"></div>
            <div className="relative p-3 sm:p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{occupancyStats.occupied}</div>
              <div className="text-xs sm:text-sm text-white/90">Occupied</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600 opacity-90"></div>
            <div className="relative p-3 sm:p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{occupancyStats.cleaning}</div>
              <div className="text-xs sm:text-sm text-white/90">Cleaning</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500 to-slate-600 opacity-90"></div>
            <div className="relative p-3 sm:p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{occupancyStats.blocked}</div>
              <div className="text-xs sm:text-sm text-white/90">Blocked</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg sm:rounded-xl shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 opacity-90"></div>
            <div className="relative p-3 sm:p-4">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{occupancyStats.occupancyRate.toFixed(0)}%</div>
              <div className="text-xs sm:text-sm text-white/90">Occupancy</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 hidden sm:block" />
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Wards</option>
            {wards.map(ward => (
              <option key={ward} value={ward}>{ward}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg transition-all duration-200 text-xs sm:text-sm font-medium ${
              autoRefresh
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-slate-100 text-slate-600 border border-slate-300'
            }`}
          >
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Auto-Refresh</span>
          </button>
          
          <button
            onClick={loadBeds}
            disabled={loading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs sm:text-sm font-medium"
          >
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Bed Grid by Ward */}
      {Object.keys(groupedBeds).length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
          <Bed className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-base sm:text-lg font-medium text-slate-600">No beds found</p>
          <p className="text-xs sm:text-sm text-slate-500">Check your filters or ward selection</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {Object.keys(groupedBeds).map(wardName => (
            <div key={wardName} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                {wardName}
                <span className="text-xs sm:text-sm font-normal text-slate-500 ml-2">
                  ({groupedBeds[wardName].length} beds)
                </span>
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                {groupedBeds[wardName].map(bed => (
                  <button
                    key={bed.id}
                    onClick={async () => {
                      if (bed.status === 'occupied' && bed.currentPatient) {
                        // Load admission details and open workflow
                        try {
                          const response = await ehrAxios.get(`/beds/admissions/active?patientId=${bed.currentPatient.id}`, {
                            headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
                          });
                          if (response.data && response.data.length > 0) {
                            setSelectedAdmission({
                              ...response.data[0],
                              patient_first_name: bed.currentPatient.firstName,
                              patient_last_name: bed.currentPatient.lastName,
                              patient_id: bed.currentPatient.id,
                              bed_number: bed.bedNumber,
                              ward_name: bed.wardName,
                            });
                            setShowPatientWorkflow(true);
                          }
                        } catch (error) {
                          showError('Error', 'Failed to load admission details');
                        }
                      }
                    }}
                    className="relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group aspect-square"
                  >
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${getBedStatusColor(bed.status)} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
                    
                    {/* Content */}
                    <div className="relative h-full flex flex-col items-center justify-center p-2 sm:p-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
                        {getBedStatusIcon(bed.status)}
                      </div>
                      <div className="text-white text-center">
                        <div className="text-xs sm:text-sm font-bold truncate w-full">{bed.bedNumber}</div>
                        <div className="text-[10px] sm:text-xs text-white/90 truncate w-full">{bed.roomNumber}</div>
                        {bed.currentPatient && (
                          <div className="text-[10px] text-white/80 mt-1 truncate w-full">
                            {bed.currentPatient.firstName[0]}. {bed.currentPatient.lastName}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BedManagementBoard;

