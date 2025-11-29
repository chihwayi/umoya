import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { FileText, Calendar, User, ArrowLeft, AlertCircle, Filter, Search, Stethoscope, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const MedicalRecordsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getRecords(token!, tenantSlug, { type: typeFilter !== 'all' ? typeFilter : undefined });
      setRecords(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [typeFilter]);

  const filteredRecords = records.filter((record) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      record.chiefComplaint?.toLowerCase().includes(search) ||
      record.assessment?.toLowerCase().includes(search) ||
      record.type?.toLowerCase().includes(search)
    );
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      consultation: 'from-blue-500 to-blue-600',
      diagnosis: 'from-purple-500 to-purple-600',
      treatment: 'from-green-500 to-green-600',
      procedure: 'from-orange-500 to-orange-600',
      lab_result: 'from-indigo-500 to-indigo-600',
      imaging: 'from-pink-500 to-pink-600',
      prescription: 'from-yellow-500 to-yellow-600',
      vaccination: 'from-teal-500 to-teal-600',
      discharge: 'from-gray-500 to-gray-600',
    };
    return colors[type] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your medical records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Medical Records</h1>
          <p className="text-gray-600">View your complete medical history</p>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search records..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/50 backdrop-blur-sm appearance-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="consultation">Consultation</option>
                <option value="diagnosis">Diagnosis</option>
                <option value="treatment">Treatment</option>
                <option value="procedure">Procedure</option>
                <option value="lab_result">Lab Result</option>
                <option value="imaging">Imaging</option>
                <option value="prescription">Prescription</option>
                <option value="vaccination">Vaccination</option>
                <option value="discharge">Discharge</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {filteredRecords.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full mb-6 shadow-lg">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Medical Records</h3>
            <p className="text-gray-600">You don't have any medical records yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${getTypeColor(record.type)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <Stethoscope className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900 capitalize">
                        {record.type?.replace('_', ' ')}
                      </h3>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                        {format(new Date(record.recordDate), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {record.provider && (
                      <div className="flex items-center gap-2 text-gray-600 mb-3">
                        <User className="w-4 h-4" />
                        <span className="text-sm">
                          Dr. {record.provider.firstName} {record.provider.lastName}
                          {record.provider.specialization && ` - ${record.provider.specialization}`}
                        </span>
                      </div>
                    )}

                    {record.chiefComplaint && (
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Chief Complaint:</p>
                        <p className="text-gray-600">{record.chiefComplaint}</p>
                      </div>
                    )}

                    {record.assessment && (
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Assessment:</p>
                        <p className="text-gray-600">{record.assessment}</p>
                      </div>
                    )}

                    {record.plan && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Treatment Plan:</p>
                        <p className="text-sm text-blue-800">{record.plan}</p>
                      </div>
                    )}

                    {record.diagnoses && record.diagnoses.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {record.diagnoses.map((diag: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold"
                          >
                            {diag.description || diag.code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalRecordsPage;

