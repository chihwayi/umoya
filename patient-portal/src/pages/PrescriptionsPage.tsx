import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { Pill, Calendar, User, ArrowLeft, AlertCircle, Filter, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const PrescriptionsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

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

  const isExpiringSoon = (endDate: string) => {
    if (!endDate) return false;
    const end = new Date(endDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your prescriptions...</p>
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Prescriptions</h1>
          <p className="text-gray-600">View your current and past medications</p>
        </div>

        {/* Filter */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-6 border border-white/20">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">Show only active prescriptions</span>
          </label>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
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
          <div className="space-y-4">
            {prescriptions.map((prescription) => (
              <div
                key={prescription.id}
                className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all ${
                  isExpiringSoon(prescription.endDate) ? 'ring-2 ring-yellow-400' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Pill className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{prescription.medicationName}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(prescription.status)}`}>
                        {prescription.status.charAt(0).toUpperCase() + prescription.status.slice(1)}
                      </span>
                      {isExpiringSoon(prescription.endDate) && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border border-yellow-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expiring Soon
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Strength & Form</p>
                        <p className="font-medium text-gray-900">
                          {prescription.strength} • {prescription.form}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Dosage</p>
                        <p className="font-medium text-gray-900">
                          {prescription.dosage} • {prescription.frequency}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Route</p>
                        <p className="font-medium text-gray-900 capitalize">{prescription.route}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Quantity</p>
                        <p className="font-medium text-gray-900">
                          {prescription.quantity} {prescription.refills !== null && prescription.refills !== undefined && `• ${prescription.refills} refills`}
                        </p>
                      </div>
                    </div>

                    {prescription.instructions && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-3">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Instructions:</p>
                        <p className="text-sm text-blue-800">{prescription.instructions}</p>
                      </div>
                    )}

                    {prescription.indication && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600">
                          <strong>For:</strong> {prescription.indication}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
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
                            {prescription.endDate && ` - ${format(new Date(prescription.endDate), 'MMM d, yyyy')}`}
                          </span>
                        </div>
                      </div>
                      {prescription.status === 'active' && (
                        <button className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2 border border-indigo-200">
                          <RefreshCw className="w-4 h-4" />
                          <span className="hidden sm:inline">Request Refill</span>
                        </button>
                      )}
                    </div>
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

export default PrescriptionsPage;

