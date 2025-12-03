import React, { useState, useEffect } from 'react';
import {
  Activity, Clock, AlertTriangle, Ambulance, User, Heart,
  TrendingUp, RefreshCw, Filter, Users, Zap
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface EDTrackingBoardProps {
  tenantSlug: string;
  token: string;
}

const EDTrackingBoard: React.FC<EDTrackingBoardProps> = ({
  tenantSlug,
  token,
}) => {
  const { showError } = useNotification();
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterESI, setFilterESI] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadTrackingBoard();
    
    if (autoRefresh) {
      const interval = setInterval(loadTrackingBoard, 15000); // 15 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadTrackingBoard = async () => {
    try {
      const response = await ehrApi.get('/ed/tracking-board', token, tenantSlug);
      setVisits(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load ED board:', error);
      showError('Error', 'Failed to load ED tracking board');
      setLoading(false);
    }
  };

  const getESIColor = (level: number) => {
    switch (level) {
      case 1: return 'from-red-600 to-red-700'; // Immediate
      case 2: return 'from-orange-500 to-red-500'; // Emergent
      case 3: return 'from-yellow-500 to-orange-500'; // Urgent
      case 4: return 'from-green-500 to-emerald-500'; // Less urgent
      case 5: return 'from-blue-500 to-cyan-500'; // Non-urgent
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getESILabel = (level: number) => {
    switch (level) {
      case 1: return 'ESI-1: IMMEDIATE';
      case 2: return 'ESI-2: EMERGENT';
      case 3: return 'ESI-3: URGENT';
      case 4: return 'ESI-4: LESS URGENT';
      case 5: return 'ESI-5: NON-URGENT';
      default: return 'NOT TRIAGED';
    }
  };

  const getWaitTime = (arrivalTime: string) => {
    const arrival = new Date(arrivalTime);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - arrival.getTime()) / (1000 * 60));
    return minutes;
  };

  const filteredVisits = visits.filter(visit => {
    if (filterESI === 'all') return true;
    return visit.triageLevel === parseInt(filterESI);
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 sm:p-6 border border-red-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">ED Tracking Board</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {visits.length} active patients • Real-time updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all text-xs sm:text-sm font-medium ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-300'
              }`}
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Auto</span>
            </button>
            
            <button
              onClick={loadTrackingBoard}
              disabled={loading}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm font-medium"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ESI Filter */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {['all', '1', '2', '3', '4', '5'].map(esi => (
          <button
            key={esi}
            onClick={() => setFilterESI(esi)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
              filterESI === esi
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-white text-slate-600 border border-slate-300 hover:border-red-300'
            }`}
          >
            {esi === 'all' ? 'All ESI' : `ESI-${esi}`}
          </button>
        ))}
      </div>

      {/* Patient Cards */}
      {filteredVisits.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
          <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-base sm:text-lg font-medium text-slate-600">No active ED patients</p>
          <p className="text-xs sm:text-sm text-slate-500">Patients will appear here when registered</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {filteredVisits.map(visit => {
            const waitTime = getWaitTime(visit.arrivalTime);
            const isDelayed = waitTime > 60;
            
            return (
              <div
                key={visit.id}
                className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group"
              >
                {/* ESI Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${getESIColor(visit.triageLevel)} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                
                {/* Content */}
                <div className="relative bg-white/95 backdrop-blur-sm p-4 sm:p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${getESIColor(visit.triageLevel)} rounded-lg flex items-center justify-center shadow-md flex-shrink-0`}>
                        <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                          {visit.patient.firstName} {visit.patient.lastName}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600">
                          {visit.patient.dateOfBirth ? `${new Date().getFullYear() - new Date(visit.patient.dateOfBirth).getFullYear()}y` : ''} • {visit.patient.gender}
                        </p>
                      </div>
                    </div>

                    {/* ESI Badge */}
                    <div className={`relative overflow-hidden rounded-lg shadow-lg`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${getESIColor(visit.triageLevel)} opacity-90`}></div>
                      <div className="relative px-3 py-1.5 text-white text-xs sm:text-sm font-bold">
                        ESI-{visit.triageLevel}
                      </div>
                    </div>
                  </div>

                  {/* Chief Complaint */}
                  <div className="mb-4">
                    <div className="text-xs sm:text-sm text-slate-500 mb-1">Chief Complaint:</div>
                    <div className="text-sm sm:text-base font-medium text-slate-900">{visit.chiefComplaint}</div>
                  </div>

                  {/* Vitals */}
                  {visit.vitalSigns && (
                    <div className="flex flex-wrap gap-3 mb-4 text-xs sm:text-sm">
                      {visit.vitalSigns.heartRate && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                          <span>{visit.vitalSigns.heartRate} bpm</span>
                        </div>
                      )}
                      {visit.vitalSigns.bloodPressureSystolic && (
                        <div className="text-slate-600">
                          BP: {visit.vitalSigns.bloodPressureSystolic}/{visit.vitalSigns.bloodPressureDiastolic}
                        </div>
                      )}
                      {visit.vitalSigns.oxygenSaturation && (
                        <div className="text-slate-600">
                          SpO2: {visit.vitalSigns.oxygenSaturation}%
                        </div>
                      )}
                    </div>
                  )}

                  {/* Critical Alerts */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {visit.traumaActivation && (
                      <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-300">
                        <Zap className="w-3 h-3 inline mr-1" />
                        TRAUMA
                      </span>
                    )}
                    {visit.codeStroke && (
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold border border-purple-300">
                        STROKE
                      </span>
                    )}
                    {visit.codeStemi && (
                      <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-300">
                        STEMI
                      </span>
                    )}
                    {visit.codeSepsis && (
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold border border-orange-300">
                        SEPSIS
                      </span>
                    )}
                    {visit.fastTrack && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-300">
                        FAST TRACK
                      </span>
                    )}
                  </div>

                  {/* Footer Info */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <Ambulance className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                      <span className="capitalize">{visit.arrivalMode?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                      <span className={isDelayed ? 'text-red-600 font-bold' : ''}>
                        {waitTime} min
                      </span>
                    </div>
                    {visit.roomAssigned && (
                      <div className="font-medium">
                        Room: {visit.roomAssigned}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EDTrackingBoard;

