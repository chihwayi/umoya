import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { Activity, Heart, Thermometer, Droplet, Wind, Scale, Ruler, Gauge, AlertCircle, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const VitalsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVitals();
  }, []);

  const loadVitals = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getVitals(token!, tenantSlug, { limit: 50 });
      setVitals(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load vitals');
      console.error('Failed to load vitals:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | Date) => {
    try {
      return format(new Date(date), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'N/A';
    }
  };

  const VitalCard = ({ vital }: { vital: any }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-200/50 hover:shadow-xl transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Vital Signs</h3>
            <p className="text-sm text-gray-600 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(vital.recordedAt)}
            </p>
          </div>
        </div>
        {vital.recordedBy && (
          <div className="text-right">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <User className="w-3 h-3" />
              {vital.recordedBy.firstName} {vital.recordedBy.lastName}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {vital.bloodPressure && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Blood Pressure</span>
            </div>
            <p className="text-lg font-bold text-blue-900">{vital.bloodPressure} mmHg</p>
          </div>
        )}

        {vital.heartRate && (
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-red-600" />
              <span className="text-xs font-semibold text-red-700">Heart Rate</span>
            </div>
            <p className="text-lg font-bold text-red-900">{vital.heartRate} bpm</p>
          </div>
        )}

        {vital.temperature && (
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-semibold text-orange-700">Temperature</span>
            </div>
            <p className="text-lg font-bold text-orange-900">{vital.temperature}°C</p>
          </div>
        )}

        {vital.oxygenSaturation && (
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplet className="w-4 h-4 text-cyan-600" />
              <span className="text-xs font-semibold text-cyan-700">O2 Saturation</span>
            </div>
            <p className="text-lg font-bold text-cyan-900">{vital.oxygenSaturation}%</p>
          </div>
        )}

        {vital.respiratoryRate && (
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Respiratory Rate</span>
            </div>
            <p className="text-lg font-bold text-green-900">{vital.respiratoryRate} /min</p>
          </div>
        )}

        {vital.weight && (
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-700">Weight</span>
            </div>
            <p className="text-lg font-bold text-purple-900">{vital.weight} kg</p>
          </div>
        )}

        {vital.height && (
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Ruler className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700">Height</span>
            </div>
            <p className="text-lg font-bold text-indigo-900">{vital.height} cm</p>
          </div>
        )}

        {vital.bmi && (
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-pink-600" />
              <span className="text-xs font-semibold text-pink-700">BMI</span>
            </div>
            <p className="text-lg font-bold text-pink-900">{vital.bmi}</p>
          </div>
        )}

        {vital.bloodGlucose && (
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplet className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700">Blood Glucose</span>
            </div>
            <p className="text-lg font-bold text-yellow-900">{vital.bloodGlucose} mg/dL</p>
          </div>
        )}

        {vital.painLevel !== null && vital.painLevel !== undefined && (
          <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-semibold text-rose-700">Pain Level</span>
            </div>
            <p className="text-lg font-bold text-rose-900">{vital.painLevel}/10</p>
          </div>
        )}
      </div>

      {vital.notes && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Notes: </span>
            {vital.notes}
          </p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <Activity className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading vitals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Vitals</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadVitals}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <span className="text-white font-bold">←</span>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vital Signs</h1>
                <p className="text-sm text-gray-600">Your health monitoring records</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">{vitals.length} Records</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {vitals.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-12 text-center">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Vitals Records</h2>
            <p className="text-gray-600 mb-6">You don't have any vital signs records yet.</p>
            <Link
              to="/dashboard"
              className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {vitals.map((vital) => (
              <VitalCard key={vital.id} vital={vital} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default VitalsPage;

