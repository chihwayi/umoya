import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Scan, Loader2, ArrowLeft } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { ehrAxios } from '../services/api';
import MedicationScannerModal from '../components/MedicationScannerModal';

const MARDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [marRecords, setMarRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedMarForScan, setSelectedMarForScan] = useState<any>(null);

  useEffect(() => {
    loadAdmittedPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadMARs();
    }
  }, [selectedPatient, selectedDate]);

  const loadAdmittedPatients = async () => {
    try {
      const response = await ehrAxios.get('/beds/admissions', {
        params: { active: true },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPatients(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedPatient(response.data[0]);
      }
    } catch (error) {
      showError('Error', 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const loadMARs = async () => {
    if (!selectedPatient) return;

    // Handle both camelCase and snake_case patient ID
    const patientId = selectedPatient.patientId || selectedPatient.patient_id;
    if (!patientId) {
      console.warn('No patient ID found in selectedPatient:', selectedPatient);
      return;
    }

    try {
      const response = await ehrAxios.get(`/bcma/mar/patient/${patientId}`, {
        params: { date: selectedDate },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setMarRecords(response.data || []);
    } catch (error) {
      // Silent fail - might be no MARs
      console.error('Error loading MARs:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'administered': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'held': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'refused': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'administered': return 'bg-green-100 text-green-800 border-green-300';
      case 'held': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'refused': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading MAR...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/${user?.role === 'doctor' ? 'doctor' : user?.role === 'nurse' ? 'nurse' : 'dashboard'}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Scan className="w-8 h-8" />
                  Medication Administration Record (MAR)
                </h1>
                <p className="text-blue-100 mt-1">Barcode medication safety system</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Patient</label>
            <select
              value={selectedPatient?.id || selectedPatient?.patient_id || ''}
              onChange={(e) => {
                const patient = patients.find(p => (p.id === e.target.value) || (p.patient_id === e.target.value));
                setSelectedPatient(patient || null);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select patient...</option>
              {patients.map((patient) => {
                const patientId = patient.id || patient.patient_id;
                const firstName = patient.patient_first_name || patient.patientFirstName || patient.firstName || '';
                const lastName = patient.patient_last_name || patient.patientLastName || patient.lastName || '';
                const bedNumber = patient.bed_number || patient.bedNumber || 'N/A';
                return (
                  <option key={patientId} value={patientId}>
                    {firstName} {lastName} - Bed {bedNumber}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Scheduled MAR Timeline (K5) */}
        {selectedPatient && marRecords.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Today's Administration Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-3 pl-10">
                {[...marRecords]
                  .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
                  .map((mar) => {
                    const isOverdue = mar.administrationStatus === 'pending' && new Date(mar.scheduledTime) < new Date();
                    const isGiven = mar.administrationStatus === 'administered';
                    const isRefused = mar.administrationStatus === 'refused';
                    const isHeld = mar.administrationStatus === 'held' || mar.administrationStatus === 'omitted';
                    return (
                      <div key={`tl-${mar.id}`} className="relative flex items-center gap-3">
                        <div className={`absolute -left-10 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isGiven ? 'bg-green-500 border-green-600' :
                          isRefused ? 'bg-red-400 border-red-500' :
                          isHeld ? 'bg-amber-400 border-amber-500' :
                          isOverdue ? 'bg-red-100 border-red-400 animate-pulse' :
                          'bg-white border-slate-300'
                        }`}>
                          {isGiven && <CheckCircle className="w-3 h-3 text-white" />}
                          {isOverdue && !isGiven && <AlertCircle className="w-3 h-3 text-red-500" />}
                        </div>
                        <div className={`flex-1 flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                          isGiven ? 'bg-green-50 border border-green-200' :
                          isOverdue ? 'bg-red-50 border border-red-200' :
                          isRefused ? 'bg-red-50 border border-red-200' :
                          isHeld ? 'bg-amber-50 border border-amber-200' :
                          'bg-slate-50 border border-slate-200'
                        }`}>
                          <span className="font-semibold text-slate-800">
                            {new Date(mar.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-700">{mar.medicationName}</span>
                          <span className="text-slate-500">{mar.dose} {mar.unit} ({mar.route})</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            isGiven ? 'bg-green-200 text-green-800' :
                            isOverdue ? 'bg-red-200 text-red-800' :
                            isRefused ? 'bg-red-200 text-red-800' :
                            isHeld ? 'bg-amber-200 text-amber-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {isOverdue && !isGiven ? 'OVERDUE' : mar.administrationStatus.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* MAR Grid */}
      {!selectedPatient ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Patient Selected</h3>
          <p className="text-slate-600">Please select a patient to view their MAR</p>
        </div>
      ) : marRecords.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Medications Scheduled</h3>
          <p className="text-slate-600">No medication administrations for selected date</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {marRecords.map((mar) => (
            <div
              key={mar.id}
              className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {getStatusIcon(mar.administrationStatus)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{mar.medicationName}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(mar.administrationStatus)}`}>
                        {mar.administrationStatus.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mb-1">
                      <strong>Dose:</strong> {mar.dose} {mar.unit} | <strong>Route:</strong> {mar.route}
                    </p>
                    <p className="text-sm text-slate-600">
                      <strong>Scheduled:</strong> {new Date(mar.scheduledTime).toLocaleTimeString()}
                      {mar.actualAdministrationTime && mar.administrationStatus === 'administered' && (
                        <> | <strong>Given:</strong> {new Date(mar.actualAdministrationTime).toLocaleTimeString()}</>
                      )}
                    </p>
                    {mar.administeredBy && (
                      <p className="text-xs text-slate-500 mt-1">
                        By: {mar.administeredBy.firstName} {mar.administeredBy.lastName}
                      </p>
                    )}
                    {mar.refusalReason && (
                      <p className="text-sm text-red-600 mt-2">
                        <strong>Refusal Reason:</strong> {mar.refusalReason}
                      </p>
                    )}
                    {mar.omissionReason && (
                      <p className="text-sm text-yellow-600 mt-2">
                        <strong>Hold Reason:</strong> {mar.omissionReason}
                      </p>
                    )}
                  </div>
                </div>
                {mar.administrationStatus === 'pending' && (
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
                    onClick={() => {
                      setSelectedMarForScan(mar);
                      setScannerOpen(true);
                    }}
                  >
                    <Scan className="w-4 h-4" />
                    Scan & Give
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
    {scannerOpen && selectedMarForScan && selectedPatient && tenantSlug && (
      <MedicationScannerModal
        prescription={selectedMarForScan}
        patient={selectedPatient}
        tenantSlug={tenantSlug}
        token={token}
        onSuccess={() => {
          setScannerOpen(false);
          setSelectedMarForScan(null);
          loadMARs();
        }}
        onClose={() => {
          setScannerOpen(false);
          setSelectedMarForScan(null);
        }}
      />
    )}
  </>
  );
};

export default MARDashboard;

