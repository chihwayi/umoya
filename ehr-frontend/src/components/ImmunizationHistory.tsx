import React, { useState, useEffect } from 'react';
import { 
  Syringe, Calendar, User, Building, AlertTriangle, CheckCircle,
  Clock, Download, Plus, Search, Filter, TrendingUp
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface ImmunizationHistoryProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onAddImmunization?: () => void;
}

const ImmunizationHistory: React.FC<ImmunizationHistoryProps> = ({
  patientId,
  tenantSlug,
  token,
  onAddImmunization,
}) => {
  const { showError } = useNotification();
  const [immunizations, setImmunizations] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadImmunizations();
    loadForecast();
  }, [patientId]);

  const loadImmunizations = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getPatientImmunizations(patientId, token, tenantSlug);
      setImmunizations(response.data || []);
    } catch (error) {
      console.error('Failed to load immunizations:', error);
      showError('Error', 'Failed to load immunization history');
    } finally {
      setLoading(false);
    }
  };

  const loadForecast = async () => {
    try {
      // Get patient DOB from patient record
      const patientResponse = await ehrApi.getPatientById(patientId, token, tenantSlug);
      const dateOfBirth = patientResponse.data.dateOfBirth;
      
      // For now, just get all schedules as forecast
      const response = await ehrApi.getImmunizationSchedules({}, token, tenantSlug);
      setForecast(response.data || []);
    } catch (error) {
      console.error('Failed to load forecast:', error);
    }
  };

  const filteredImmunizations = immunizations.filter(imm => {
    if (!searchTerm && filterType === 'all') return true;
    
    const matchesSearch = !searchTerm || 
      imm.vaccineName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      imm.immunizationNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || imm.vaccineCode === filterType;
    
    return matchesSearch && matchesType;
  });

  const getVaccineColor = (vaccineName: string) => {
    if (vaccineName.includes('COVID')) return 'from-purple-500 to-indigo-600';
    if (vaccineName.includes('Flu') || vaccineName.includes('Influenza')) return 'from-blue-500 to-cyan-600';
    if (vaccineName.includes('HPV')) return 'from-pink-500 to-rose-600';
    if (vaccineName.includes('Hepatitis')) return 'from-orange-500 to-amber-600';
    if (vaccineName.includes('DTaP') || vaccineName.includes('Tetanus')) return 'from-green-500 to-emerald-600';
    if (vaccineName.includes('MMR') || vaccineName.includes('Measles')) return 'from-red-500 to-rose-600';
    if (vaccineName.includes('Polio')) return 'from-teal-500 to-cyan-600';
    return 'from-slate-500 to-slate-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading immunization records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-purple-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <Syringe className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Immunization History</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                {immunizations.length} vaccines administered • {forecast.length} due/upcoming
              </p>
            </div>
          </div>
          
          {onAddImmunization && (
            <button
              onClick={onAddImmunization}
              className="flex items-center justify-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-lg hover:from-purple-700 hover:to-indigo-800 transition-all duration-200 shadow-lg font-medium text-sm sm:text-base w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Record Vaccine</span>
            </button>
          )}
        </div>
      </div>

      {/* Due/Upcoming Vaccines */}
      {forecast.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-amber-300 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Due & Upcoming Vaccines</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forecast.map((item, index) => (
              <div
                key={index}
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4"
              >
                <h4 className="font-semibold text-slate-900 mb-1 text-sm sm:text-base">{item.vaccineName}</h4>
                <div className="text-xs sm:text-sm text-slate-600 space-y-1">
                  <div>Dose: <strong>{item.doseNumber}</strong></div>
                  <div>Due: <strong>{formatDateToDDMMYYYY(item.recommendedDate)}</strong></div>
                  <div className="flex items-center gap-1 text-amber-700 font-medium mt-2">
                    <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">{item.status.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vaccines..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm appearance-none"
            >
              <option value="all">All Vaccines</option>
              <option value="213">COVID-19</option>
              <option value="141">Influenza</option>
              <option value="20">DTaP</option>
              <option value="03">MMR</option>
              <option value="08">Hepatitis B</option>
              <option value="10">Polio</option>
              <option value="137">HPV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Immunization List */}
      {filteredImmunizations.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
          <Syringe className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-base sm:text-lg font-medium text-slate-600">No immunization records found</p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Click "Record Vaccine" to add immunizations</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {filteredImmunizations.map(imm => (
            <div
              key={imm.id}
              className="relative overflow-hidden rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group"
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${getVaccineColor(imm.vaccineName)} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
              
              {/* Content */}
              <div className="relative bg-white/90 backdrop-blur-sm p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${getVaccineColor(imm.vaccineName)} rounded-lg flex items-center justify-center flex-shrink-0 shadow-md`}>
                      <Syringe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1">{imm.vaccineName}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600 mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                          <span>{formatDateToDDMMYYYY(imm.administrationDate)}</span>
                        </div>
                        {imm.doseNumber && (
                          <div>Dose: <strong>#{imm.doseNumber}</strong></div>
                        )}
                        {imm.lotNumber && (
                          <div className="text-xs">Lot: <strong>{imm.lotNumber}</strong></div>
                        )}
                        {imm.site && (
                          <div className="text-xs">Site: <strong>{imm.site}</strong></div>
                        )}
                      </div>
                      
                      {/* Status Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-300">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          {imm.completionStatus}
                        </span>
                        {imm.registrySubmitted && (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold border border-blue-300">
                            Registry Reported
                          </span>
                        )}
                        {imm.reactionObserved && (
                          <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-300">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            Reaction
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center gap-2">
                    <button
                      onClick={() => {/* View details */}}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => {/* Download */}}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImmunizationHistory;

