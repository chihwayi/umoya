import React, { useEffect, useState } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { Activity, Heart, Thermometer, Droplet, Wind, Scale, Ruler, Gauge, AlertCircle, Calendar, User, ArrowLeft, TrendingUp, TrendingDown, Plus, X, Save, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const VitalsPage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formData, setFormData] = useState({
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    oxygenSaturation: '',
    respiratoryRate: '',
    weight: '',
    height: '',
    bloodGlucose: '',
    painLevel: '',
    notes: '',
  });

  useEffect(() => {
    loadVitals();
  }, []);

  const loadVitals = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await patientPortalApi.getVitals(token!, tenantSlug, { limit: 50 });
      // Handle both array and object with array property
      const vitalsList = Array.isArray(data) ? data : (data?.vitals || data?.data || []);
      setVitals(vitalsList);
      if (vitalsList.length === 0) {
        console.log('No vitals found for patient');
      }
    } catch (err: any) {
      console.error('Error loading vitals:', err);
      setError(err.message || 'Failed to load vitals');
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSubmitError('');
  };

  const handleSubmitVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      // Prepare data - convert empty strings to null
      const vitalsData: any = {};
      Object.keys(formData).forEach(key => {
        const value = formData[key as keyof typeof formData];
        vitalsData[key] = value === '' ? null : (key === 'painLevel' || key === 'heartRate' || key === 'oxygenSaturation' || key === 'respiratoryRate' ? parseInt(value) || null : parseFloat(value) || null);
      });

      await patientPortalApi.submitVitals(vitalsData, token!, tenantSlug);
      setSubmitSuccess(true);
      setFormData({
        bloodPressure: '',
        heartRate: '',
        temperature: '',
        oxygenSaturation: '',
        respiratoryRate: '',
        weight: '',
        height: '',
        bloodGlucose: '',
        painLevel: '',
        notes: '',
      });
      
      // Reload vitals after successful submission
      setTimeout(() => {
        loadVitals();
        setShowSubmitForm(false);
        setSubmitSuccess(false);
      }, 2000);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit vitals');
    } finally {
      setSubmitting(false);
    }
  };

  const VitalCard = ({ vital }: { vital: any }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all transform hover:scale-[1.01]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
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
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <User className="w-3 h-3" />
              {typeof vital.recordedBy === 'string' 
                ? vital.recordedBy 
                : `${vital.recordedBy.firstName || ''} ${vital.recordedBy.lastName || ''}`.trim() || 'Staff'}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {vital.bloodPressure && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Blood Pressure</span>
            </div>
            <p className="text-lg font-bold text-blue-900">{vital.bloodPressure} mmHg</p>
          </div>
        )}

        {vital.heartRate && (
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-red-600" />
              <span className="text-xs font-semibold text-red-700">Heart Rate</span>
            </div>
            <p className="text-lg font-bold text-red-900">{vital.heartRate} bpm</p>
          </div>
        )}

        {vital.temperature && (
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-semibold text-orange-700">Temperature</span>
            </div>
            <p className="text-lg font-bold text-orange-900">{vital.temperature}°C</p>
          </div>
        )}

        {vital.oxygenSaturation && (
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200">
            <div className="flex items-center gap-2 mb-2">
              <Droplet className="w-4 h-4 text-cyan-600" />
              <span className="text-xs font-semibold text-cyan-700">O2 Saturation</span>
            </div>
            <p className="text-lg font-bold text-cyan-900">{vital.oxygenSaturation}%</p>
          </div>
        )}

        {vital.respiratoryRate && (
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Respiratory Rate</span>
            </div>
            <p className="text-lg font-bold text-green-900">{vital.respiratoryRate} /min</p>
          </div>
        )}

        {vital.weight && (
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-700">Weight</span>
            </div>
            <p className="text-lg font-bold text-purple-900">{vital.weight} kg</p>
          </div>
        )}

        {vital.height && (
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <Ruler className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700">Height</span>
            </div>
            <p className="text-lg font-bold text-indigo-900">{vital.height} cm</p>
          </div>
        )}

        {vital.bmi && (
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 border border-pink-200">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-pink-600" />
              <span className="text-xs font-semibold text-pink-700">BMI</span>
            </div>
            <p className="text-lg font-bold text-pink-900">{vital.bmi}</p>
          </div>
        )}

        {vital.bloodGlucose && (
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <Droplet className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-semibold text-yellow-700">Blood Glucose</span>
            </div>
            <p className="text-lg font-bold text-yellow-900">{vital.bloodGlucose} mg/dL</p>
          </div>
        )}

        {vital.painLevel !== null && vital.painLevel !== undefined && (
          <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4 border border-rose-200">
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
          <Activity className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
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
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
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
                className="w-10 h-10 bg-gradient-to-br from-red-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vital Signs</h1>
                <p className="text-sm text-gray-600">Your health monitoring records</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-700">{vitals.length} Records</p>
              </div>
              <button
                onClick={() => setShowSubmitForm(true)}
                className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span>Submit Vitals</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Submit Vitals Modal */}
      {showSubmitForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-pink-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-2xl font-bold">Submit Vital Signs</h2>
              <button
                onClick={() => {
                  setShowSubmitForm(false);
                  setSubmitError('');
                  setSubmitSuccess(false);
                }}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitVitals} className="p-6 space-y-6">
              {submitSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-800 font-semibold">Vitals submitted successfully!</p>
                </div>
              )}

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-800">{submitError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Blood Pressure <span className="text-gray-500">(e.g., 120/80)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.bloodPressure}
                    onChange={(e) => handleInputChange('bloodPressure', e.target.value)}
                    placeholder="120/80"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Heart Rate <span className="text-gray-500">(bpm)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.heartRate}
                    onChange={(e) => handleInputChange('heartRate', e.target.value)}
                    placeholder="72"
                    min="30"
                    max="220"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Temperature <span className="text-gray-500">(°C)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => handleInputChange('temperature', e.target.value)}
                    placeholder="36.5"
                    min="30"
                    max="45"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Oxygen Saturation <span className="text-gray-500">(%)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.oxygenSaturation}
                    onChange={(e) => handleInputChange('oxygenSaturation', e.target.value)}
                    placeholder="98"
                    min="70"
                    max="100"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Respiratory Rate <span className="text-gray-500">(/min)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.respiratoryRate}
                    onChange={(e) => handleInputChange('respiratoryRate', e.target.value)}
                    placeholder="16"
                    min="8"
                    max="40"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Weight <span className="text-gray-500">(kg)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    placeholder="70"
                    min="1"
                    max="500"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Height <span className="text-gray-500">(cm)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    placeholder="170"
                    min="30"
                    max="250"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Blood Glucose <span className="text-gray-500">(mg/dL)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.bloodGlucose}
                    onChange={(e) => handleInputChange('bloodGlucose', e.target.value)}
                    placeholder="100"
                    min="20"
                    max="600"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pain Level <span className="text-gray-500">(0-10)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.painLevel}
                    onChange={(e) => handleInputChange('painLevel', e.target.value)}
                    placeholder="0"
                    min="0"
                    max="10"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional notes about your vitals..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmitForm(false);
                    setSubmitError('');
                    setSubmitSuccess(false);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Activity className="w-5 h-5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Submit Vitals</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {vitals.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-12 text-center">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Vitals Records</h2>
            <p className="text-gray-600 mb-6">You don't have any vital signs records yet.</p>
            <Link
              to="/dashboard"
              className="inline-block bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
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
