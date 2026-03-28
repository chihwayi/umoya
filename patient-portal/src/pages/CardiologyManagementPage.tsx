import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import {
  Heart,
  Activity,
  Calendar,
  ArrowLeft,
  BarChart3,
  Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';

const CardiologyManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantSlug: _tenantSlug } = useParams<{ tenantSlug: string }>();
  const effectiveTenantSlug = useTenantSlug();
  const { token } = usePatientAuth();
  const [loading, setLoading] = useState(true);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [bpTrends, setBpTrends] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'encounters' | 'trends'>('overview');
  const [_error, setError] = useState<string>('');

  useEffect(() => {
    if (token && effectiveTenantSlug) {
      loadData();
    }
  }, [token, effectiveTenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [encountersData, trendsData] = await Promise.all([
        patientPortalApi.getCardiologyEncounters(token!, effectiveTenantSlug).catch(() => []),
        patientPortalApi.getBloodPressureTrends(token!, effectiveTenantSlug, { limit: 30 }).catch(() => []),
      ]);

      setEncounters(Array.isArray(encountersData) ? encountersData : []);
      setBpTrends(Array.isArray(trendsData) ? trendsData : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load cardiology data');
    } finally {
      setLoading(false);
    }
  };

  const getLatestBP = () => {
    if (bpTrends.length === 0) return null;
    return bpTrends[0];
  };

  const getBPStatus = (systolic: number, diastolic: number) => {
    if (systolic >= 180 || diastolic >= 120) {
      return { status: 'crisis', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Hypertensive Crisis' };
    }
    if (systolic >= 140 || diastolic >= 90) {
      return { status: 'high', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'High (Stage 2)' };
    }
    if (systolic >= 130 || diastolic >= 80) {
      return { status: 'elevated', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Elevated (Stage 1)' };
    }
    return { status: 'normal', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Normal' };
  };

  const calculateAverageBP = () => {
    if (bpTrends.length === 0) return null;
    const systolicValues = bpTrends.map((t) => parseFloat(t.systolic || 0)).filter((v) => !isNaN(v) && v > 0);
    const diastolicValues = bpTrends.map((t) => parseFloat(t.diastolic || 0)).filter((v) => !isNaN(v) && v > 0);
    if (systolicValues.length === 0 || diastolicValues.length === 0) return null;
    const avgSystolic = systolicValues.reduce((a, b) => a + b, 0) / systolicValues.length;
    const avgDiastolic = diastolicValues.reduce((a, b) => a + b, 0) / diastolicValues.length;
    return { systolic: avgSystolic.toFixed(0), diastolic: avgDiastolic.toFixed(0) };
  };

  const latestBP = getLatestBP();
  const avgBP = calculateAverageBP();
  const bpStatus = latestBP ? getBPStatus(parseFloat(latestBP.systolic || 0), parseFloat(latestBP.diastolic || 0)) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cardiology data...</p>
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
                  <Heart className="w-7 h-7 text-red-600" />
                  Heart Health & Hypertension
                </h1>
                <p className="text-sm text-gray-600">Monitor your cardiovascular health</p>
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
              <p className="text-sm font-medium text-gray-600">Latest Blood Pressure</p>
              <Heart className="w-5 h-5 text-red-600" />
            </div>
            {latestBP ? (
              <>
                <p className={`text-3xl font-bold ${bpStatus?.color || 'text-gray-900'}`}>
                  {latestBP.systolic}/{latestBP.diastolic}
                </p>
                <p className="text-xs text-gray-500 mt-1">{bpStatus?.label || 'Normal'}</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-gray-400">No readings</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Average BP</p>
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            {avgBP ? (
              <p className="text-3xl font-bold text-gray-900">{avgBP.systolic}/{avgBP.diastolic}</p>
            ) : (
              <p className="text-2xl font-bold text-gray-400">No data</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Last 30 readings</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Total Encounters</p>
              <Stethoscope className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{encounters.length}</p>
            <p className="text-xs text-gray-500 mt-1">Cardiology visits</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Latest Heart Rate</p>
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            {latestBP?.heartRate ? (
              <p className="text-3xl font-bold text-gray-900">{latestBP.heartRate} bpm</p>
            ) : (
              <p className="text-2xl font-bold text-gray-400">N/A</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Beats per minute</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'encounters', label: 'Encounters', icon: Calendar },
            { id: 'trends', label: 'BP Trends', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-red-600 text-red-600'
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
            {/* Latest BP Reading */}
            {latestBP && (
              <div className={`bg-white rounded-2xl shadow-sm border-2 ${bpStatus?.border || 'border-gray-200'} p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Latest Blood Pressure Reading</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bpStatus?.bg || 'bg-gray-100'} ${bpStatus?.color || 'text-gray-700'}`}>
                    {bpStatus?.label?.toUpperCase() || 'NORMAL'}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <p className="text-5xl font-bold text-gray-900 mb-2">
                      {latestBP.systolic}/{latestBP.diastolic}
                      <span className="text-2xl text-gray-500 ml-2">mmHg</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {latestBP.date ? format(new Date(latestBP.date), 'MMM d, yyyy') : 'N/A'}
                    </p>
                  </div>
                  {latestBP.heartRate && (
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-1">Heart Rate</p>
                      <p className="text-3xl font-bold text-gray-900">{latestBP.heartRate} bpm</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent BP Trend */}
            {bpTrends.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Blood Pressure Trend</h2>
                <div className="space-y-2">
                  {bpTrends.slice(0, 7).map((reading, idx) => {
                    const status = getBPStatus(parseFloat(reading.systolic || 0), parseFloat(reading.diastolic || 0));
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${status.status === 'normal' ? 'bg-green-500' : status.status === 'elevated' ? 'bg-yellow-500' : status.status === 'high' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {reading.systolic}/{reading.diastolic} mmHg
                            </p>
                            <p className="text-xs text-gray-600">
                              {reading.date ? format(new Date(reading.date), 'MMM d, yyyy') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Encounters */}
            {encounters.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Encounters</h2>
                <div className="space-y-3">
                  {encounters.slice(0, 5).map((encounter, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-bold text-gray-900">
                              {encounter.encounterDate ? format(new Date(encounter.encounterDate || encounter.encounter_date), 'MMM d, yyyy') : 'N/A'}
                            </h3>
                            {encounter.cardiologist_name && (
                              <span className="text-sm text-gray-600">with {encounter.cardiologist_name}</span>
                            )}
                          </div>
                          {encounter.chiefComplaint && (
                            <p className="text-sm text-gray-700 mb-2">
                              <span className="font-semibold">Chief Complaint:</span> {encounter.chiefComplaint || encounter.chief_complaint}
                            </p>
                          )}
                          {encounter.bloodPressureSystolic && encounter.bloodPressureDiastolic && (
                            <p className="text-sm text-gray-700">
                              <span className="font-semibold">BP:</span> {encounter.bloodPressureSystolic || encounter.blood_pressure_systolic}/{encounter.bloodPressureDiastolic || encounter.blood_pressure_diastolic} mmHg
                            </p>
                          )}
                          {encounter.riskScore && (
                            <p className="text-sm text-gray-700 mt-1">
                              <span className="font-semibold">Risk Score:</span> {encounter.riskScore || encounter.risk_score}
                            </p>
                          )}
                        </div>
                        {encounter.careStatus && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            (encounter.careStatus || encounter.care_status) === 'stable' ? 'bg-green-100 text-green-700' :
                            (encounter.careStatus || encounter.care_status) === 'monitoring' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {(encounter.careStatus || encounter.care_status || 'N/A').toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'encounters' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cardiology Encounters</h2>
            {encounters.length === 0 ? (
              <div className="text-center py-12">
                <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No cardiology encounters found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {encounters.map((encounter, idx) => {
                  const bpStatus = encounter.bloodPressureSystolic && encounter.bloodPressureDiastolic
                    ? getBPStatus(parseFloat(encounter.bloodPressureSystolic || encounter.blood_pressure_systolic || 0), parseFloat(encounter.bloodPressureDiastolic || encounter.blood_pressure_diastolic || 0))
                    : null;
                  return (
                    <div key={idx} className={`p-4 rounded-xl border-2 ${bpStatus?.border || 'border-gray-200'} ${bpStatus?.bg || 'bg-white'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-bold text-gray-900">
                              {encounter.encounterDate ? format(new Date(encounter.encounterDate || encounter.encounter_date), 'MMM d, yyyy') : 'N/A'}
                            </h3>
                            {encounter.cardiologist_name && (
                              <span className="text-sm text-gray-600">• Dr. {encounter.cardiologist_name}</span>
                            )}
                          </div>
                          {encounter.chiefComplaint && (
                            <p className="text-sm text-gray-700 mb-2">
                              <span className="font-semibold">Chief Complaint:</span> {encounter.chiefComplaint || encounter.chief_complaint}
                            </p>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                            {encounter.bloodPressureSystolic && encounter.bloodPressureDiastolic && (
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Blood Pressure</p>
                                <p className="text-lg font-bold text-gray-900">
                                  {encounter.bloodPressureSystolic || encounter.blood_pressure_systolic}/{encounter.bloodPressureDiastolic || encounter.blood_pressure_diastolic} mmHg
                                </p>
                              </div>
                            )}
                            {encounter.heartRate && (
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Heart Rate</p>
                                <p className="text-lg font-bold text-gray-900">{encounter.heartRate || encounter.heart_rate} bpm</p>
                              </div>
                            )}
                            {encounter.riskScore && (
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Risk Score</p>
                                <p className="text-lg font-bold text-gray-900">{encounter.riskScore || encounter.risk_score}</p>
                              </div>
                            )}
                            {encounter.careStatus && (
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Status</p>
                                <p className="text-lg font-bold text-gray-900 capitalize">{encounter.careStatus || encounter.care_status}</p>
                              </div>
                            )}
                          </div>
                          {encounter.notes && (
                            <p className="text-sm text-gray-600 mt-3 italic">"{encounter.notes}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Blood Pressure Trends</h2>
            {bpTrends.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No blood pressure data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bpTrends.map((reading, idx) => {
                  const status = getBPStatus(parseFloat(reading.systolic || 0), parseFloat(reading.diastolic || 0));
                  return (
                    <div key={idx} className={`p-4 rounded-xl border-2 ${status.border} ${status.bg}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full ${status.bg} flex items-center justify-center`}>
                            <Heart className={`w-6 h-6 ${status.color}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900">
                              {reading.systolic}/{reading.diastolic} mmHg
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {reading.date ? format(new Date(reading.date), 'MMM d, yyyy') : 'N/A'}
                              {reading.heartRate && ` • Heart Rate: ${reading.heartRate} bpm`}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                          {status.label.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CardiologyManagementPage;

