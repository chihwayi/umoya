import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import {
  Activity,
  Droplet,
  Pill,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Target,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';

const DiabetesManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantSlug: _tenantSlug } = useParams<{ tenantSlug: string }>();
  const effectiveTenantSlug = useTenantSlug();
  const { token } = usePatientAuth();
  const [loading, setLoading] = useState(true);
  const [registry, setRegistry] = useState<any>(null);
  const [glucoseHistory, setGlucoseHistory] = useState<any[]>([]);
  const [carePlan, setCarePlan] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'glucose' | 'medications' | 'care-plan'>('overview');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (token && effectiveTenantSlug) {
      loadData();
    }
  }, [token, effectiveTenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [registryData, glucoseData, carePlanData, medicationsData] = await Promise.all([
        patientPortalApi.getDiabetesRegistry(token!, effectiveTenantSlug).catch(() => null),
        patientPortalApi.getGlucoseHistory(token!, effectiveTenantSlug, { limit: 30 }).catch(() => []),
        patientPortalApi.getDiabetesCarePlan(token!, effectiveTenantSlug).catch(() => null),
        patientPortalApi.getDiabetesMedications(token!, effectiveTenantSlug).catch(() => []),
      ]);

      setRegistry(registryData);
      setGlucoseHistory(Array.isArray(glucoseData) ? glucoseData : []);
      setCarePlan(carePlanData);
      setMedications(Array.isArray(medicationsData) ? medicationsData : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load diabetes data');
    } finally {
      setLoading(false);
    }
  };

  const getLatestGlucose = () => {
    if (glucoseHistory.length === 0) return null;
    return glucoseHistory[0];
  };

  const getGlucoseStatus = (value: number, unit: string = 'mg/dL') => {
    if (unit === 'mmol/L') {
      if (value < 4.0) return { status: 'low', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
      if (value > 10.0) return { status: 'high', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
      return { status: 'normal', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    } else {
      if (value < 70) return { status: 'low', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
      if (value > 180) return { status: 'high', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
      return { status: 'normal', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    }
  };

  const calculateAverageGlucose = () => {
    if (glucoseHistory.length === 0) return null;
    const values = glucoseHistory.map((g) => parseFloat(g.glucoseValue || g.glucose_value || 0)).filter((v) => !isNaN(v));
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return (sum / values.length).toFixed(1);
  };

  const latestGlucose = getLatestGlucose();
  const avgGlucose = calculateAverageGlucose();
  const glucoseStatus = latestGlucose ? getGlucoseStatus(parseFloat(latestGlucose.glucoseValue || latestGlucose.glucose_value || 0), latestGlucose.glucoseUnit || latestGlucose.glucose_unit) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading diabetes management data...</p>
        </div>
      </div>
    );
  }

  if (error && !registry) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Diabetes Registry Found</h2>
          <p className="text-gray-600 mb-6">{error || 'You do not have a diabetes registry. Please contact your healthcare provider.'}</p>
          <button
            onClick={() => navigate(`/${effectiveTenantSlug}/dashboard`)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Back to Dashboard
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
              <button
                onClick={() => navigate(`/${effectiveTenantSlug}/dashboard`)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Droplet className="w-7 h-7 text-blue-600" />
                  Diabetes Management
                </h1>
                <p className="text-sm text-gray-600">Monitor your diabetes health</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Latest Glucose</p>
              <Droplet className="w-5 h-5 text-blue-600" />
            </div>
            {latestGlucose ? (
              <>
                <p className={`text-3xl font-bold ${glucoseStatus?.color || 'text-gray-900'}`}>
                  {latestGlucose.glucoseValue || latestGlucose.glucose_value || 'N/A'} {latestGlucose.glucoseUnit || latestGlucose.glucose_unit || 'mg/dL'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {latestGlucose.measurementTime || latestGlucose.measurement_time
                    ? format(new Date(latestGlucose.measurementTime || latestGlucose.measurement_time), 'MMM d, h:mm a')
                    : 'N/A'}
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold text-gray-400">No readings</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Average Glucose</p>
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            {avgGlucose ? (
              <p className="text-3xl font-bold text-gray-900">{avgGlucose} mg/dL</p>
            ) : (
              <p className="text-2xl font-bold text-gray-400">No data</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Last 30 readings</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Active Medications</p>
              <Pill className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{medications.filter((m) => m.status === 'active').length}</p>
            <p className="text-xs text-gray-500 mt-1">Currently taking</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Care Plan</p>
              <Target className="w-5 h-5 text-indigo-600" />
            </div>
            {carePlan?.careBundle ? (
              <p className="text-3xl font-bold text-gray-900">{carePlan.careBundle.completionPercentage || 0}%</p>
            ) : (
              <p className="text-2xl font-bold text-gray-400">No plan</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Completion</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'glucose', label: 'Glucose History', icon: Droplet },
            { id: 'medications', label: 'Medications', icon: Pill },
            { id: 'care-plan', label: 'Care Plan', icon: Target },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Registry Info */}
            {registry && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Diabetes Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{registry.diabetes_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Diagnosis Date</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {registry.diagnosis_date ? format(new Date(registry.diagnosis_date), 'MMM d, yyyy') : 'N/A'}
                    </p>
                  </div>
                  {registry.primary_care_provider_name && (
                    <div>
                      <p className="text-sm text-gray-600">Primary Care Provider</p>
                      <p className="text-lg font-semibold text-gray-900">{registry.primary_care_provider_name}</p>
                    </div>
                  )}
                  {registry.endocrinologist_name && (
                    <div>
                      <p className="text-sm text-gray-600">Endocrinologist</p>
                      <p className="text-lg font-semibold text-gray-900">{registry.endocrinologist_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Latest Glucose Reading */}
            {latestGlucose && (
              <div className={`bg-white rounded-2xl shadow-sm border-2 ${glucoseStatus?.border || 'border-gray-200'} p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Latest Glucose Reading</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${glucoseStatus?.bg || 'bg-gray-100'} ${glucoseStatus?.color || 'text-gray-700'}`}>
                    {glucoseStatus?.status?.toUpperCase() || 'NORMAL'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-4xl font-bold text-gray-900">
                      {latestGlucose.glucoseValue || latestGlucose.glucose_value} {latestGlucose.glucoseUnit || latestGlucose.glucose_unit || 'mg/dL'}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {latestGlucose.measurementType || latestGlucose.measurement_type || 'Fasting'} •{' '}
                      {latestGlucose.measurementTime || latestGlucose.measurement_time
                        ? format(new Date(latestGlucose.measurementTime || latestGlucose.measurement_time), 'MMM d, yyyy h:mm a')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Glucose Trend */}
            {glucoseHistory.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Glucose Trend</h2>
                <div className="space-y-2">
                  {glucoseHistory.slice(0, 7).map((reading, idx) => {
                    const value = parseFloat(reading.glucoseValue || reading.glucose_value || 0);
                    const status = getGlucoseStatus(value, reading.glucoseUnit || reading.glucose_unit);
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${status.status === 'normal' ? 'bg-green-500' : status.status === 'high' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {reading.glucoseValue || reading.glucose_value} {reading.glucoseUnit || reading.glucose_unit || 'mg/dL'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {reading.measurementTime || reading.measurement_time
                                ? format(new Date(reading.measurementTime || reading.measurement_time), 'MMM d, h:mm a')
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                          {reading.measurementType || reading.measurement_type || 'Fasting'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'glucose' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Glucose History</h2>
            {glucoseHistory.length === 0 ? (
              <div className="text-center py-12">
                <Droplet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No glucose readings available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {glucoseHistory.map((reading, idx) => {
                  const value = parseFloat(reading.glucoseValue || reading.glucose_value || 0);
                  const status = getGlucoseStatus(value, reading.glucoseUnit || reading.glucose_unit);
                  return (
                    <div key={idx} className={`p-4 rounded-xl border-2 ${status.border} ${status.bg}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full ${status.bg} flex items-center justify-center`}>
                            <Droplet className={`w-6 h-6 ${status.color}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">
                              {reading.glucoseValue || reading.glucose_value} {reading.glucoseUnit || reading.glucose_unit || 'mg/dL'}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {reading.measurementType || reading.measurement_type || 'Fasting'} •{' '}
                              {reading.measurementTime || reading.measurement_time
                                ? format(new Date(reading.measurementTime || reading.measurement_time), 'MMM d, yyyy h:mm a')
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                          {status.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'medications' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Diabetes Medications</h2>
            {medications.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No medications recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {medications.map((med, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Pill className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-lg font-bold text-gray-900">{med.medicationName || med.medication_name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${med.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {med.status || 'active'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-semibold">Dosage:</span> {med.dosage} • <span className="font-semibold">Frequency:</span> {med.frequency}
                        </p>
                        {med.startDate && (
                          <p className="text-xs text-gray-500">
                            Started: {format(new Date(med.startDate || med.start_date), 'MMM d, yyyy')}
                          </p>
                        )}
                        {med.adherencePercentage !== null && med.adherencePercentage !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">Adherence</span>
                              <span className="text-xs font-semibold text-gray-900">{med.adherencePercentage || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${(med.adherencePercentage || 0) >= 80 ? 'bg-green-500' : (med.adherencePercentage || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${med.adherencePercentage || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'care-plan' && (
          <div className="space-y-6">
            {carePlan?.careBundle && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Current Care Plan</h2>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Completion</span>
                    <span className="text-lg font-bold text-gray-900">{carePlan.careBundle.completionPercentage || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-indigo-600 h-3 rounded-full transition-all"
                      style={{ width: `${carePlan.careBundle.completionPercentage || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: 'hba1cChecked', label: 'HbA1c', checked: carePlan.careBundle.hba1cChecked || carePlan.careBundle.hba1c_checked },
                    { key: 'bloodPressureChecked', label: 'Blood Pressure', checked: carePlan.careBundle.bloodPressureChecked || carePlan.careBundle.blood_pressure_checked },
                    { key: 'lipidProfileChecked', label: 'Lipid Profile', checked: carePlan.careBundle.lipidProfileChecked || carePlan.careBundle.lipid_profile_checked },
                    { key: 'footExamChecked', label: 'Foot Exam', checked: carePlan.careBundle.footExamChecked || carePlan.careBundle.foot_exam_checked },
                    { key: 'eyeExamChecked', label: 'Eye Exam', checked: carePlan.careBundle.eyeExamChecked || carePlan.careBundle.eye_exam_checked },
                    { key: 'urineAcrChecked', label: 'Urine ACR', checked: carePlan.careBundle.urineAcrChecked || carePlan.careBundle.urine_acr_checked },
                    { key: 'diabetesEducationDocumented', label: 'Education', checked: carePlan.careBundle.diabetesEducationDocumented || carePlan.careBundle.diabetes_education_documented },
                    { key: 'medicationReviewCompleted', label: 'Med Review', checked: carePlan.careBundle.medicationReviewCompleted || carePlan.careBundle.medication_review_completed },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center gap-2">
                      {item.checked ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300" />
                      )}
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </div>
                  ))}
                </div>
                {carePlan.careBundle.bundleDate && (
                  <p className="text-xs text-gray-500 mt-4">
                    Last updated: {format(new Date(carePlan.careBundle.bundleDate || carePlan.careBundle.bundle_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            )}

            {carePlan?.registry?.carePlan && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Care Plan Details</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{carePlan.registry.carePlan}</p>
              </div>
            )}

            {!carePlan && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6 text-center py-12">
                <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No care plan available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiabetesManagementPage;

