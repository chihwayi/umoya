import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { Pill, Calendar, User, ArrowLeft, AlertCircle, Filter, CheckCircle, Clock, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const PrescriptionsPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadPrescriptions();
  }, [activeOnly]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getPrescriptions(token!, tenantSlug, activeOnly);
      setPrescriptions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPrescription = async (prescriptionId: string) => {
    try {
      setDownloadingId(prescriptionId);
      await patientPortalApi.downloadPrescription(prescriptionId, token!, tenantSlug);
    } catch (err: any) {
      setError(err.message || 'Failed to download prescription');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your prescriptions...</p>
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
              to="/dashboard"
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Prescriptions</h1>
              <p className="text-sm text-gray-600">View your current and past medications</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-6 border border-white/20">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">Show only active prescriptions</span>
          </label>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {prescriptions.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-6 shadow-lg">
              <Pill className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Prescriptions</h3>
            <p className="text-gray-600">
              {activeOnly ? 'You don\'t have any active prescriptions.' : 'You don\'t have any prescriptions yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {prescriptions.map((prescription) => (
              <div
                key={prescription.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all transform hover:scale-[1.01]"
              >
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Pill className="w-8 h-8 text-white" />
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-900">{prescription.medicationName}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(prescription.status)}`}>
                            {prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleDownloadPrescription(prescription.id)}
                          disabled={downloadingId === prescription.id}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-4 h-4" />
                          <span>{downloadingId === prescription.id ? 'Downloading...' : 'Download PDF'}</span>
                        </button>
                        {prescription.status === 'active' && (
                          <button className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors flex items-center gap-2 border border-purple-200 hover:border-purple-300">
                            <RefreshCw className="w-4 h-4" />
                            <span>Request Refill</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-xs text-blue-600 mb-1 font-semibold">Dosage</p>
                        <p className="font-bold text-blue-900">
                          {prescription.dosage}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4">
                        <p className="text-xs text-green-600 mb-1 font-semibold">Frequency</p>
                        <p className="font-bold text-green-900">
                          {prescription.frequency}
                        </p>
                      </div>
                      {prescription.duration && (
                        <div className="bg-purple-50 rounded-xl p-4">
                          <p className="text-xs text-purple-600 mb-1 font-semibold">Duration</p>
                          <p className="font-bold text-purple-900">
                            {prescription.duration}
                          </p>
                        </div>
                      )}
                      {prescription.quantity && (
                        <div className="bg-orange-50 rounded-xl p-4">
                          <p className="text-xs text-orange-600 mb-1 font-semibold">Quantity</p>
                          <p className="font-bold text-orange-900">
                            {prescription.quantity}
                          </p>
                        </div>
                      )}
                    </div>

                    {prescription.instructions && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-indigo-900 mb-1 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Instructions:
                        </p>
                        <p className="text-sm text-indigo-800">{prescription.instructions}</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-3">
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        {prescription.prescriber && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>
                              Dr. {prescription.prescriber.firstName} {prescription.prescriber.lastName}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(prescription.prescribedDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
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

export default PrescriptionsPage;
