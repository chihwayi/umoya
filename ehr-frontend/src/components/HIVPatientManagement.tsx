import React, { useState, useEffect } from 'react';
import { Users, Calendar, Activity, Heart, TrendingUp, AlertTriangle, Eye, Search, Filter } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface HIVPatientManagementProps {
  tenantSlug: string;
}

const HIVPatientManagement: React.FC<HIVPatientManagementProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  useEffect(() => {
    loadEnrollments();
  }, [filterStatus]);

  const loadEnrollments = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);
      const response = await ehrApi.getHivEnrollments(filterStatus, token, tenantSlug);
      setEnrollments(response.data.enrollments || []);
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
          <Users className="w-12 h-12 opacity-80" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEnrollments.map((enrollment) => (
            <div key={enrollment.id} className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {enrollment.first_name} {enrollment.last_name}
                  </h3>
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

              <button
                onClick={() => {
                  // Navigate to patient detail or open visit modal
                  showSuccess('Info', 'Patient detail view will open here');
                }}
                className="mt-4 w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HIVPatientManagement;

