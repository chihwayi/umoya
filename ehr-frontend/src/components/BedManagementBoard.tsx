import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bed, Users, Activity, Clock, AlertCircle, CheckCircle, Loader2,
  ArrowRight, Home, Filter, RefreshCw, Maximize2
} from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrAxios } from '../services/api';

interface BedManagementBoardProps {
  tenantSlug: string;
  token: string;
}

const BedManagementBoard: React.FC<BedManagementBoardProps> = ({
  tenantSlug,
  token,
}) => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [beds, setBeds] = useState<any[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [occupancyStats, setOccupancyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

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

  // No longer needed - we use tabs instead
  // const groupedBeds = beds.reduce((acc, bed) => {
  //   if (!acc[bed.wardName]) acc[bed.wardName] = [];
  //   acc[bed.wardName].push(bed);
  //   return acc;
  // }, {} as Record<string, any[]>);

  // Get unique wards from beds  
  const wardNames = Array.from(new Set(beds.map((bed: any) => bed.wardName || bed.ward_name))).filter(Boolean).sort();
  const [activeWardTab, setActiveWardTab] = useState<string>('');

  // Set first ward as active on load
  useEffect(() => {
    if (wardNames.length > 0 && !activeWardTab) {
      setActiveWardTab(wardNames[0]);
    }
  }, [wardNames]);

  // Filter beds by active ward tab
  const displayBeds = activeWardTab ? beds.filter((bed: any) => (bed.wardName || bed.ward_name) === activeWardTab) : beds;

  return (
    <div className="space-y-6">
      {/* Ward Tabs - Glassy Design */}
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-2 sticky top-0 z-10">
        <div className="flex gap-2 overflow-x-auto">
          {wardNames.map(ward => {
            const wardBeds = beds.filter((b: any) => (b.wardName || b.ward_name) === ward);
            const occupied = wardBeds.filter(b => b.status === 'occupied').length;
            const available = wardBeds.filter(b => b.status === 'available').length;
            
            return (
              <button
                key={ward}
                onClick={() => setActiveWardTab(ward)}
                className={`flex-shrink-0 px-6 py-4 rounded-xl transition-all duration-300 ${
                  activeWardTab === ward
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-white/50 text-slate-700 hover:bg-white/80 hover:shadow-md'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-lg mb-1">{ward}</div>
                  <div className={`text-xs ${activeWardTab === ward ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {occupied} occupied • {available} available
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Occupancy Stats for Active Ward */}
      {occupancyStats && activeWardTab && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="relative overflow-hidden rounded-xl shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-700"></div>
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-3xl font-bold text-white">{displayBeds.length}</div>
                <Bed className="w-8 h-8 text-white/80" />
              </div>
              <div className="text-sm text-white/90">Total Beds</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600"></div>
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-3xl font-bold text-white">
                  {displayBeds.filter(b => b.status === 'available').length}
                </div>
                <CheckCircle className="w-8 h-8 text-white/80" />
              </div>
              <div className="text-sm text-white/90">Available</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-600"></div>
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-3xl font-bold text-white">
                  {displayBeds.filter(b => b.status === 'occupied').length}
                </div>
                <Users className="w-8 h-8 text-white/80" />
              </div>
              <div className="text-sm text-white/90">Occupied</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600"></div>
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-3xl font-bold text-white">
                  {displayBeds.filter(b => b.status === 'cleaning').length}
                </div>
                <Clock className="w-8 h-8 text-white/80" />
              </div>
              <div className="text-sm text-white/90">Cleaning</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-xl shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600"></div>
            <div className="relative p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-3xl font-bold text-white">
                  {displayBeds.length > 0 ? Math.round((displayBeds.filter(b => b.status === 'occupied').length / displayBeds.length) * 100) : 0}%
                </div>
                <Loader2 className="w-8 h-8 text-white/80" />
              </div>
              <div className="text-sm text-white/90">Occupancy</div>
            </div>
          </div>
        </div>
      )}

      {/* Bed Grid for Active Ward */}
      {displayBeds.length === 0 ? (
        <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20">
          <Bed className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-600">No beds in this ward</p>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Bed className="w-6 h-6 text-indigo-600" />
              {activeWardTab}
              <span className="text-sm font-normal text-slate-500 ml-2">
                ({displayBeds.length} beds)
              </span>
            </h3>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                  autoRefresh
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-slate-100 text-slate-600 border border-slate-300'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {displayBeds.map(bed => (
              <button
                key={bed.id}
                onClick={async () => {
                  if (bed.status === 'occupied' && bed.currentPatient) {
                    try {
                      const response = await ehrAxios.get(`/beds/admissions`, {
                        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
                        params: { patientId: bed.currentPatient.id },
                      });

                      if (response.data && response.data.length > 0) {
                        const admissionData = {
                          ...response.data[0],
                          patient_first_name: bed.currentPatient.firstName,
                          patient_last_name: bed.currentPatient.lastName,
                          patient_id: bed.currentPatient.id,
                          bed_number: bed.bedNumber,
                          ward_name: bed.wardName,
                        };
                        navigate(`/ehr/${tenantSlug}/admitted-patient`, { state: { admission: admissionData } });
                      } else {
                        showError('Info', 'No active admission found for this patient');
                      }
                    } catch (error) {
                      console.error('Failed to load admission:', error);
                      showError('Error', 'Failed to load admission details');
                    }
                  } else if (bed.status === 'available') {
                    showError('Info', 'This bed is available. Admit a patient first.');
                  }
                }}
                className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-200 transform hover:scale-105 aspect-square"
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${getBedStatusColor(bed.status)}`}></div>
                
                {/* Content */}
                <div className="relative h-full flex flex-col items-center justify-center p-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-2">
                    {getBedStatusIcon(bed.status)}
                  </div>
                  <div className="text-white text-center">
                    <div className="text-sm font-bold truncate w-full">{bed.bedNumber}</div>
                    <div className="text-xs text-white/90 truncate w-full">{bed.roomNumber}</div>
                    {bed.currentPatient && (
                      <div className="text-xs text-white/80 mt-1 truncate w-full">
                        {bed.currentPatient.firstName?.[0]}. {bed.currentPatient.lastName}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-green-500 to-emerald-600"></div>
              <span className="text-sm text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-red-500 to-rose-600"></div>
              <span className="text-sm text-slate-600">Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-yellow-500 to-amber-600"></div>
              <span className="text-sm text-slate-600">Cleaning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-br from-slate-500 to-slate-600"></div>
              <span className="text-sm text-slate-600">Blocked</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BedManagementBoard;

