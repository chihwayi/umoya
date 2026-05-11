import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, Calendar, LogOut, Pill, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useCaregiverAuth } from '../contexts/CaregiverAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';

const formatDate = (value?: string) => {
  if (!value) return 'Date pending';
  try {
    return format(new Date(value), 'MMM d, yyyy h:mm a');
  } catch {
    return 'Date pending';
  }
};

const CaregiverDashboard: React.FC = () => {
  const tenantSlug = useTenantSlug();
  const { caregiver, patient, token, logout } = useCaregiverAuth();
  const [summary, setSummary] = useState<any>({ appointments: [], recentVitals: [], activePrescriptions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSummary = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await patientPortalApi.getCaregiverPatientSummary(token, tenantSlug);
        setSummary(data);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Failed to load caregiver summary');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [tenantSlug, token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Caring for {patient?.firstName} {patient?.lastName}
                </h1>
                <p className="text-sm text-gray-600">
                  {caregiver?.relationship || 'Caregiver'} — {caregiver?.accessLevel || 'view_only'} access
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-6">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-700">
            You have read-only access to {patient?.firstName || 'this patient'}'s health information.
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-gray-900">Upcoming Appointments</h2>
              </div>
              <div className="space-y-3">
                {summary.appointments?.length ? summary.appointments.map((appointment: any) => (
                  <div key={appointment.id} className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                    <p className="text-sm font-semibold text-gray-900">{formatDate(appointment.appointmentDate)}</p>
                    <p className="text-sm text-gray-600 mt-1">{appointment.reason || 'Clinic appointment'}</p>
                    <span className="inline-block mt-2 rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                      {appointment.status}
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">No upcoming appointments.</p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-red-600" />
                <h2 className="font-bold text-gray-900">Recent Vitals</h2>
              </div>
              <div className="space-y-3">
                {summary.recentVitals?.length ? summary.recentVitals.map((vital: any) => (
                  <div key={vital.id} className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-3">{formatDate(vital.recordedAt)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-gray-500">BP</p>
                        <p className="font-semibold text-gray-900">{vital.bloodPressure || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-gray-500">Heart rate</p>
                        <p className="font-semibold text-gray-900">{vital.heartRate || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-gray-500">Temp</p>
                        <p className="font-semibold text-gray-900">{vital.temperature || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-gray-500">O2 sat</p>
                        <p className="font-semibold text-gray-900">{vital.oxygenSaturation || '—'}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">No recent vitals.</p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Pill className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold text-gray-900">Active Medications</h2>
              </div>
              <div className="space-y-3">
                {summary.activePrescriptions?.length ? summary.activePrescriptions.map((prescription: any) => (
                  <div key={prescription.id} className="rounded-xl bg-purple-50 border border-purple-100 p-3">
                    <p className="text-sm font-semibold text-gray-900">{prescription.medicationName}</p>
                    <p className="text-sm text-gray-600 mt-1">{prescription.dosage}</p>
                    <p className="text-xs text-gray-500 mt-1">{prescription.frequency}</p>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">No active medications.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default CaregiverDashboard;
