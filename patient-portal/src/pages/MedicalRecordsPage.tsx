import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { FileText, Calendar, User, ArrowLeft, AlertCircle, Filter, Search, Stethoscope, Activity, Heart, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const MedicalRecordsPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const tenantSlug = useTenantSlug();
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
      setError('');
      console.log('Loading medical records...', { tenantSlug, patient: patient?.id, hasToken: !!token });
      
      // Decode JWT token to see what's inside
      if (token) {
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('JWT Token payload:', payload);
            console.log('JWT Token sub (patient ID):', payload.sub);
            console.log('JWT Token email:', payload.email);
          }
        } catch (e) {
          console.warn('Could not decode JWT token:', e);
        }
      }
      
      const data = await patientPortalApi.getRecords(token!, tenantSlug, { type: typeFilter !== 'all' ? typeFilter : undefined });
      console.log('Medical Records response:', data);
      console.log('Response type:', typeof data, 'Is array:', Array.isArray(data));
      // Handle both array and object with data property
      const recordsArray = Array.isArray(data) ? data : (data?.data || data?.records || []);
      console.log('Records array:', recordsArray, 'Length:', recordsArray.length);
      setRecords(recordsArray);
    } catch (err: any) {
      console.error('Error loading medical records:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(err.message || 'Failed to load medical records');
      setRecords([]);
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
      record.plan?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your medical records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/${tenantSlug}/dashboard`}
              className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Medical Records</h1>
              <p className="text-sm text-gray-600">View your complete medical history</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search records by complaint, assessment, or plan..."
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white/50 backdrop-blur-sm"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="pl-12 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white/50 backdrop-blur-sm appearance-none cursor-pointer min-w-[180px]"
              >
                <option value="all">All Types</option>
                <option value="consultation">Consultation</option>
                <option value="diagnosis">Diagnosis</option>
                <option value="treatment">Treatment</option>
                <option value="procedure">Procedure</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {filteredRecords.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-6 shadow-lg">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Medical Records</h3>
            <p className="text-gray-600">You don't have any medical records yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all transform hover:scale-[1.01]"
              >
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Stethoscope className="w-8 h-8 text-white" />
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <h3 className="text-xl font-bold text-gray-900">
                        Medical Record
                      </h3>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(record.recordDate), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {record.provider && (
                      <div className="flex items-center gap-2 text-gray-600 mb-4">
                        <User className="w-4 h-4" />
                        <span className="text-sm">
                          Dr. {record.provider.firstName} {record.provider.lastName}
                          {record.provider.specialization && ` - ${record.provider.specialization}`}
                        </span>
                      </div>
                    )}

                    {record.chiefComplaint && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-500" />
                          Chief Complaint:
                        </p>
                        <p className="text-gray-700 bg-red-50 rounded-lg p-3">{record.chiefComplaint}</p>
                      </div>
                    )}

                    {record.historyPresentIllness && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-1">History of Present Illness:</p>
                        <p className="text-gray-600 bg-blue-50 rounded-lg p-3">{record.historyPresentIllness}</p>
                      </div>
                    )}

                    {record.physicalExamination && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-500" />
                          Physical Examination:
                        </p>
                        <p className="text-gray-600 bg-blue-50 rounded-lg p-3">{record.physicalExamination}</p>
                      </div>
                    )}

                    {record.assessment && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Assessment:</p>
                        <p className="text-gray-700 bg-yellow-50 rounded-lg p-3">{record.assessment}</p>
                      </div>
                    )}

                    {record.plan && (
                      <div className="mb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-4">
                        <p className="text-sm font-semibold text-green-900 mb-1">Treatment Plan:</p>
                        <p className="text-sm text-green-800">{record.plan}</p>
                      </div>
                    )}

                    {record.diagnoses && record.diagnoses.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {record.diagnoses.map((diag: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold border border-purple-200"
                          >
                            {typeof diag === 'string' ? diag : (diag.description || diag.code || diag)}
                          </span>
                        ))}
                      </div>
                    )}

                    {record.vitalSigns && (
                      <div className="mt-4 bg-indigo-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-indigo-900 mb-2">Vital Signs:</p>
                        <p className="text-xs text-indigo-800">{typeof record.vitalSigns === 'string' ? record.vitalSigns : JSON.stringify(record.vitalSigns)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MedicalRecordsPage;
