import React, { useState, useEffect } from 'react';
import { Users, Calendar, Activity, Heart, TrendingUp, AlertTriangle, Eye, Search, Filter, FileText, CheckSquare, Square, Download, Printer } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import HIVPatientDetailModal from './HIVPatientDetailModal';
import HIVClinicalVisitModal from './HIVClinicalVisitModal';

interface HIVPatientManagementProps {
  tenantSlug: string;
}

const HIVPatientManagement: React.FC<HIVPatientManagementProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [eacStatusMap, setEacStatusMap] = useState<{ [key: string]: any }>({});
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);

  useEffect(() => {
    loadEnrollments();
  }, [filterStatus]);

  const loadEnrollments = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);
      const response = await ehrApi.getHivEnrollments(filterStatus, token, tenantSlug);
      const enrollmentsList = response.data.enrollments || [];
      setEnrollments(enrollmentsList);

      // Check EAC eligibility for each enrollment
      const eacMap: { [key: string]: any } = {};
      for (const enrollment of enrollmentsList) {
        try {
          const eacResponse = await ehrApi.checkEacEligibility(enrollment.id, token, tenantSlug);
          eacMap[enrollment.id] = eacResponse.data || {};
        } catch (error) {
          console.error(`Failed to check EAC for ${enrollment.id}:`, error);
          eacMap[enrollment.id] = {};
        }
      }
      setEacStatusMap(eacMap);
    } catch (error) {
      console.error('Failed to load enrollments:', error);
      showError('Error', 'Failed to load HIV patients');
    } finally {
      setLoading(false);
    }
  };

  const filteredEnrollments = enrollments.filter(e => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      e.first_name?.toLowerCase().includes(search) ||
      e.last_name?.toLowerCase().includes(search) ||
      e.patient_number?.toLowerCase().includes(search) ||
      e.enrollment_number?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">HIV Patients on Care</h2>
            <p className="text-emerald-100">Manage enrolled HIV patients</p>
          </div>
          <div className="flex items-center gap-3">
            {bulkActionMode && (
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <span className="text-sm font-semibold">
                  {selectedEnrollments.size} selected
                </span>
              </div>
            )}
            <button
              onClick={() => {
                setBulkActionMode(!bulkActionMode);
                setSelectedEnrollments(new Set());
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                bulkActionMode
                  ? 'bg-white text-emerald-600 hover:bg-emerald-50'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              {bulkActionMode ? 'Cancel' : 'Bulk Actions'}
            </button>
            <Users className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or enrollment number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="active">Active</option>
            <option value="transferred_out">Transferred Out</option>
            <option value="lost_to_followup">Lost to Follow-up</option>
            <option value="deceased">Deceased</option>
          </select>
        </div>
      </div>

      {/* Patients List */}
      {loading ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-emerald-400 mx-auto animate-spin mb-4" />
          <p className="text-slate-600">Loading patients...</p>
        </div>
      ) : filteredEnrollments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No Patients Found</h3>
          <p className="text-slate-500">
            {searchTerm ? 'Try adjusting your search' : 'No patients enrolled with this status'}
          </p>
        </div>
      ) : (
        <>
          {/* Bulk Actions Bar */}
          {bulkActionMode && selectedEnrollments.size > 0 && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 flex items-center justify-between">
              <span className="font-semibold text-blue-900">
                {selectedEnrollments.size} patient{selectedEnrollments.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    // Bulk print patient cards
                    const token = localStorage.getItem('ehr_token');
                    if (!token) return;
                    showSuccess('Info', `Printing ${selectedEnrollments.size} patient cards...`);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Cards
                </button>
                <button
                  onClick={async () => {
                    // Bulk export
                    showSuccess('Info', `Exporting ${selectedEnrollments.size} patient summaries...`);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEnrollments.map((enrollment) => {
              const eacStatus = eacStatusMap[enrollment.id] || {};
              const needsEac = eacStatus.needsEac || false;
              const activeEac = eacStatus.activeEac || false;
              const isSelected = selectedEnrollments.has(enrollment.id);
              return (
              <div 
                key={enrollment.id} 
                className={`rounded-xl shadow-lg p-6 border-2 hover:shadow-xl transition-all ${
                  isSelected ? 'ring-4 ring-blue-500' : ''
                } ${
                needsEac 
                  ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-400 animate-pulse' 
                  : activeEac
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Bulk Selection Checkbox */}
              {bulkActionMode && (
                <div className="mb-3 flex items-center justify-end">
                  <button
                    onClick={() => {
                      const newSet = new Set(selectedEnrollments);
                      if (isSelected) {
                        newSet.delete(enrollment.id);
                      } else {
                        newSet.add(enrollment.id);
                      }
                      setSelectedEnrollments(newSet);
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-6 h-6" />
                    ) : (
                      <Square className="w-6 h-6 border-2 border-slate-300 rounded" />
                    )}
                  </button>
                </div>
              )}

              {/* EAC Urgent Badge */}
              {needsEac && (
                <div className="mb-4 -mt-2 -mx-2 bg-red-600 text-white px-4 py-2 rounded-t-xl flex items-center justify-center gap-2 shadow-lg">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                  <span className="font-bold text-sm">⚠️ EAC REQUIRED - URGENT</span>
                </div>
              )}
              
              {/* Active EAC Badge */}
              {activeEac && !needsEac && (
                <div className="mb-4 -mt-2 -mx-2 bg-blue-600 text-white px-4 py-2 rounded-t-xl flex items-center justify-center gap-2 shadow-lg">
                  <Activity className="w-5 h-5" />
                  <span className="font-bold text-sm">📋 ACTIVE EAC PROGRAM</span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {enrollment.first_name} {enrollment.last_name}
                    </h3>
                    {needsEac && (
                      <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                        EAC REQUIRED
                      </span>
                    )}
                    {activeEac && !needsEac && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                        ACTIVE EAC
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">Enrollment: {enrollment.enrollment_number}</p>
                  <p className="text-xs text-slate-500">Patient ID: {enrollment.patient_number}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  enrollment.enrollment_status === 'active' ? 'bg-green-100 text-green-800' :
                  enrollment.enrollment_status === 'transferred_out' ? 'bg-blue-100 text-blue-800' :
                  enrollment.enrollment_status === 'lost_to_followup' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {enrollment.enrollment_status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {enrollment.enrollment_date && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4" />
                    Enrolled: {formatDateToDDMMYYYY(enrollment.enrollment_date)}
                  </div>
                )}
                {enrollment.current_regimen && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Activity className="w-4 h-4" />
                    Regimen: {enrollment.current_regimen}
                  </div>
                )}
                {enrollment.baseline_cd4 && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Heart className="w-4 h-4" />
                    Baseline CD4: {enrollment.baseline_cd4}
                  </div>
                )}
                {enrollment.baseline_viral_load && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <TrendingUp className="w-4 h-4" />
                    Baseline VL: {enrollment.baseline_viral_load} {enrollment.baseline_viral_load_unit || 'copies/mL'}
                  </div>
                )}
              </div>

              {/* EAC Warning Message */}
              {needsEac && (
                <div className="mt-3 mb-3 px-4 py-3 bg-red-100 border-2 border-red-400 rounded-lg shadow-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-900 mb-1">
                        Patient Requires Enhanced Adherence Counseling
                      </p>
                      <p className="text-xs text-red-800">
                        2 consecutive high viral loads detected. EAC intervention required per WHO guidelines.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeEac && !needsEac && (
                <div className="mt-3 mb-3 px-4 py-3 bg-blue-100 border-2 border-blue-400 rounded-lg shadow-sm">
                  <div className="flex items-start gap-2">
                    <Activity className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-blue-900 mb-1">
                        Patient is in Active EAC Program
                      </p>
                      <p className="text-xs text-blue-800">
                        {eacStatus.eacProgram?.sessions_completed ? (
                          <>EAC sessions in progress ({eacStatus.eacProgram.sessions_completed} sessions completed). Continue monitoring adherence.</>
                        ) : (
                          <>EAC program is active. Continue conducting EAC sessions per WHO guidelines.</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedEnrollment(enrollment);
                    setShowDetailModal(true);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium ${
                    needsEac
                      ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
                <button
                  onClick={() => {
                    setSelectedEnrollment(enrollment);
                    setShowVisitModal(true);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium ${
                    needsEac
                      ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg border-2 border-red-400'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  {needsEac ? '⚠️ Record Visit' : 'Record Visit'}
                </button>
              </div>
            </div>
          );
          })}
        </div>
        </>
      )}

      {/* Patient Detail Modal */}
      {showDetailModal && selectedEnrollment && (
        <HIVPatientDetailModal
          enrollment={selectedEnrollment}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedEnrollment(null);
          }}
          tenantSlug={tenantSlug}
        />
      )}

      {/* Clinical Visit Modal */}
      {showVisitModal && selectedEnrollment && (
        <HIVClinicalVisitModal
          enrollment={selectedEnrollment}
          onClose={() => {
            setShowVisitModal(false);
            setSelectedEnrollment(null);
          }}
          onSuccess={() => {
            setShowVisitModal(false);
            setSelectedEnrollment(null);
            loadEnrollments();
          }}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
};

export default HIVPatientManagement;

