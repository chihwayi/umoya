import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { TrendingUp, ArrowLeft, CheckCircle, XCircle, Calendar, Clock, Pill, AlertCircle, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const MedicationAdherencePage: React.FC = () => {
  const { token, patient } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [adherenceSummary, setAdherenceSummary] = useState<any[]>([]);
  const [adherenceLogs, setAdherenceLogs] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<string>('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    prescriptionId: '',
    scheduledTime: new Date().toISOString().slice(0, 16),
    taken: true,
    takenTime: new Date().toISOString().slice(0, 16),
    missedReason: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedPrescription]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [summaryData, logsData, prescriptionsData] = await Promise.all([
        patientPortalApi.getMedicationAdherenceSummary(token!, tenantSlug, {
          prescriptionId: selectedPrescription || undefined,
        }),
        patientPortalApi.getMedicationAdherenceLogs(token!, tenantSlug, {
          prescriptionId: selectedPrescription || undefined,
          limit: 50,
        }),
        patientPortalApi.getPrescriptions(token!, tenantSlug, true),
      ]);
      setAdherenceSummary(Array.isArray(summaryData) ? summaryData : []);
      setAdherenceLogs(Array.isArray(logsData) ? logsData : []);
      setPrescriptions(Array.isArray(prescriptionsData) ? prescriptionsData : []);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load adherence data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogAdherence = () => {
    setError('');
    setLogForm({
      prescriptionId: '',
      scheduledTime: new Date().toISOString().slice(0, 16),
      taken: true,
      takenTime: new Date().toISOString().slice(0, 16),
      missedReason: '',
      notes: '',
    });
    setShowLogModal(true);
  };

  const handleSubmitLog = async () => {
    if (!logForm.prescriptionId) {
      setError('Please select a medication');
      return;
    }
    try {
      setError('');
      await patientPortalApi.logMedicationAdherence(
        logForm.prescriptionId,
        {
          scheduledTime: logForm.scheduledTime,
          taken: logForm.taken,
          takenTime: logForm.taken ? logForm.takenTime : undefined,
          missedReason: logForm.taken ? undefined : logForm.missedReason,
          notes: logForm.notes || undefined,
        },
        token!,
        tenantSlug,
      );
      setShowLogModal(false);
      setLogForm({
        prescriptionId: '',
        scheduledTime: new Date().toISOString().slice(0, 16),
        taken: true,
        takenTime: new Date().toISOString().slice(0, 16),
        missedReason: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to log adherence');
    }
  };

  const getAdherenceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAdherenceBgColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-100 border-green-200';
    if (percentage >= 70) return 'bg-yellow-100 border-yellow-200';
    return 'bg-red-100 border-red-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading adherence data...</p>
        </div>
      </div>
    );
  }

  const overallAdherence = adherenceSummary.length > 0
    ? adherenceSummary.reduce((acc, s) => acc + parseFloat(s.adherencePercentage || 0), 0) / adherenceSummary.length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/${tenantSlug}/dashboard`}
                className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Medication Adherence</h1>
                <p className="text-sm text-gray-600">Track your medication compliance</p>
              </div>
            </div>
            <button
              onClick={handleLogAdherence}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Log Medication</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {/* Overall Adherence Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Overall Adherence</h2>
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className={`text-5xl font-bold ${getAdherenceColor(overallAdherence)} mb-2`}>
                {overallAdherence.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600">
                {overallAdherence >= 90
                  ? 'Excellent compliance!'
                  : overallAdherence >= 70
                  ? 'Good compliance'
                  : 'Needs improvement'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Medications</p>
              <p className="text-2xl font-bold text-gray-900">{adherenceSummary.length}</p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 mb-6 border border-white/20">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Medication</label>
          <select
            value={selectedPrescription}
            onChange={(e) => setSelectedPrescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Medications</option>
            {prescriptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.medicationName} ({p.dosage})
              </option>
            ))}
          </select>
        </div>

        {/* Adherence Summary by Medication */}
        {adherenceSummary.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">By Medication</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adherenceSummary.map((summary) => {
                const prescription = prescriptions.find((p) => p.id === summary.prescriptionId);
                const percentage = parseFloat(summary.adherencePercentage || 0);
                return (
                  <div
                    key={summary.prescriptionId}
                    className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border-2 ${getAdherenceBgColor(percentage)}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Pill className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">
                          {prescription?.medicationName || 'Unknown Medication'}
                        </h3>
                        <p className="text-xs text-gray-600">{prescription?.dosage}</p>
                      </div>
                    </div>
                    <div className={`text-3xl font-bold ${getAdherenceColor(percentage)} mb-2`}>
                      {percentage.toFixed(1)}%
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-600">Taken</p>
                        <p className="font-bold text-green-700">{summary.takenDoses || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Missed</p>
                        <p className="font-bold text-red-700">{summary.missedDoses || 0}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Adherence Logs */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
          {adherenceLogs.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-6 shadow-lg">
                <Calendar className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Logs Yet</h3>
              <p className="text-gray-600 mb-6">Start logging your medication intake to track adherence</p>
              <button
                onClick={handleLogAdherence}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
              >
                Log Your First Medication
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {adherenceLogs.map((log) => {
                const prescription = prescriptions.find((p) => p.id === log.prescriptionId);
                return (
                  <div
                    key={log.id}
                    className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          log.taken
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {log.taken ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          <XCircle className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-gray-900">
                            {prescription?.medicationName || 'Unknown Medication'}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              log.taken
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            {log.taken ? 'Taken' : 'Missed'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              Scheduled: {format(new Date(log.scheduledTime), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          {log.takenTime && (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              <span>
                                Taken: {format(new Date(log.takenTime), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                          )}
                        </div>
                        {log.missedReason && (
                          <p className="mt-2 text-sm text-red-600">
                            <strong>Reason:</strong> {log.missedReason}
                          </p>
                        )}
                        {log.notes && (
                          <p className="mt-2 text-sm text-gray-600">{log.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Log Medication Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Log Medication</h2>
              <button
                onClick={() => {
                  setShowLogModal(false);
                  setLogForm({
                    prescriptionId: '',
                    scheduledTime: new Date().toISOString().slice(0, 16),
                    taken: true,
                    takenTime: new Date().toISOString().slice(0, 16),
                    missedReason: '',
                    notes: '',
                  });
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Medication</label>
                <select
                  value={logForm.prescriptionId}
                  onChange={(e) => setLogForm({ ...logForm, prescriptionId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select medication</option>
                  {prescriptions
                    .filter((p) => p.status === 'active')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.medicationName} ({p.dosage})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Scheduled Time</label>
                <input
                  type="datetime-local"
                  value={logForm.scheduledTime}
                  onChange={(e) => setLogForm({ ...logForm, scheduledTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logForm.taken}
                    onChange={(e) => setLogForm({ ...logForm, taken: e.target.checked })}
                    className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-700">Medication was taken</span>
                </label>
              </div>

              {logForm.taken && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time Taken</label>
                  <input
                    type="datetime-local"
                    value={logForm.takenTime}
                    onChange={(e) => setLogForm({ ...logForm, takenTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}

              {!logForm.taken && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for Missing</label>
                  <input
                    type="text"
                    value={logForm.missedReason}
                    onChange={(e) => setLogForm({ ...logForm, missedReason: e.target.value })}
                    placeholder="e.g., Forgot, Out of medication, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (optional)</label>
                <textarea
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLogModal(false);
                  setLogForm({
                    prescriptionId: '',
                    scheduledTime: new Date().toISOString().slice(0, 16),
                    taken: true,
                    takenTime: new Date().toISOString().slice(0, 16),
                    missedReason: '',
                    notes: '',
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitLog}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
              >
                Save Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationAdherencePage;

