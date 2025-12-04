import React from 'react';
import { Clock, Users, Activity, CheckCircle, AlertCircle } from 'lucide-react';

interface ORBoardViewProps {
  orAvailability: any[];
  onCaseClick: (surgicalCase: any) => void;
  selectedDate: string;
}

const ORBoardView: React.FC<ORBoardViewProps> = ({
  orAvailability,
  onCaseClick,
  selectedDate,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'from-blue-500 to-cyan-500';
      case 'confirmed': return 'from-cyan-500 to-teal-500';
      case 'patient_arrived': return 'from-purple-500 to-pink-500';
      case 'in_progress': return 'from-orange-500 to-amber-500';
      case 'completed': return 'from-green-500 to-emerald-500';
      case 'cancelled': return 'from-red-500 to-rose-500';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress': return <Activity className="w-4 h-4 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getORStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 border-green-300 text-green-800';
      case 'occupied': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'cleaning': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'maintenance': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'offline': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-slate-100 border-slate-300 text-slate-800';
    }
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {orAvailability.map((or) => (
        <div
          key={or.id}
          className="bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 shadow-lg hover:shadow-xl transition-all overflow-hidden"
        >
          {/* OR Header */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 border-b-2 border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{or.room_number}</h3>
                <p className="text-slate-600 text-sm">{or.room_name}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getORStatusColor(or.status)}`}>
                {or.status.toUpperCase()}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Activity className="w-4 h-4" />
              <span className="capitalize">{or.room_type.replace('_', ' ')}</span>
              <span className="mx-2">•</span>
              <span>{or.scheduled_cases?.length || 0} cases today</span>
            </div>
          </div>

          {/* Cases Timeline */}
          <div className="p-5">
            {!or.scheduled_cases || or.scheduled_cases.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">No cases scheduled</p>
                <p className="text-slate-400 text-sm mt-1">OR available all day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {or.scheduled_cases.map((surgicalCase: any, index: number) => (
                  <button
                    key={`${surgicalCase.caseid}-${index}`}
                    onClick={() => onCaseClick(surgicalCase)}
                    className="w-full text-left group"
                  >
                    {/* Timeline connector */}
                    {index > 0 && (
                      <div className="h-4 border-l-2 border-slate-300 ml-6 mb-2"></div>
                    )}
                    
                    <div className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 bg-gradient-to-br ${getStatusColor(surgicalCase.status)} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                        <div className="text-white">
                          {getStatusIcon(surgicalCase.status)}
                        </div>
                      </div>

                      {/* Case card */}
                      <div className="ml-16 bg-slate-50 group-hover:bg-slate-100 rounded-xl p-4 border border-slate-200 group-hover:border-indigo-300 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-900">{surgicalCase.patientname}</span>
                              {isToday && surgicalCase.status === 'in_progress' && (
                                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full animate-pulse">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 font-medium mb-2">{surgicalCase.procedurename}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {surgicalCase.scheduledstarttime} - {surgicalCase.scheduledendtime}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                Dr. {surgicalCase.surgeonname}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-400 group-hover:text-indigo-600 transition-colors">
                            →
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ORBoardView;

