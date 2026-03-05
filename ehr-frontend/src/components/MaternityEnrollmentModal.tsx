import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Heart, Baby, Calendar, AlertTriangle, Search } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface MaternityEnrollmentModalProps {
  patientId?: string;
  patientName?: string;
  patientDateOfBirth?: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber?: string;
  dateOfBirth?: string;
  phone?: string;
}

export default function MaternityEnrollmentModal({
  patientId,
  patientName,
  patientDateOfBirth,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}: MaternityEnrollmentModalProps) {
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);
  const [patientLookupError, setPatientLookupError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(() => {
    if (patientId && patientName) {
      return {
        id: patientId,
        firstName: patientName.split(' ')[0] || patientName,
        lastName: patientName.split(' ').slice(1).join(' '),
        dateOfBirth: patientDateOfBirth,
      };
    }
    return null;
  });

  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [lmpDate, setLmpDate] = useState('');
  const [edd, setEdd] = useState('');
  const [gravida, setGravida] = useState<number>(1);
  const [para, setPara] = useState<number>(0);
  const [parityTerm, setParityTerm] = useState<number>(0);
  const [parityPreterm, setParityPreterm] = useState<number>(0);
  const [parityAbortions, setParityAbortions] = useState<number>(0);
  const [parityLiving, setParityLiving] = useState<number>(0);
  const [previousCesarean, setPreviousCesarean] = useState(false);
  const [previousComplications, setPreviousComplications] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharedPatientContext, setSharedPatientContext] = useState<any | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  const computedPatientName = useMemo(() => {
    if (selectedPatient) {
      return `${selectedPatient.firstName} ${selectedPatient.lastName}`.trim();
    }
    return patientName || '';
  }, [patientName, selectedPatient]);

  const calculateEDD = useCallback((lmp: string) => {
    if (!lmp) return;
    
    const lmpDate = new Date(lmp);
    const eddDate = new Date(lmpDate);
    eddDate.setDate(eddDate.getDate() + 280); // Add 280 days (40 weeks)
    
    setEdd(eddDate.toISOString().split('T')[0]);
  }, []);

  const handleLMPChange = (value: string) => {
    setLmpDate(value);
    calculateEDD(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatient) {
      showError('Select patient', 'Choose the patient to enroll in maternity care.');
      return;
    }

    if (!lmpDate) {
      showError('LMP required', 'Please provide the Last Menstrual Period date.');
      return;
    }

    try {
      setLoading(true);

      await ehrApi.createMaternityEnrollment(tenantSlug, token, {
        patient_id: selectedPatient.id,
        enrollment_date: enrollmentDate,
        lmp_date: lmpDate,
        gravida,
        para,
        parity_term: parityTerm,
        parity_preterm: parityPreterm,
        parity_abortions: parityAbortions,
        parity_living: parityLiving,
        previous_cesarean: previousCesarean,
        previous_complications: previousComplications,
      });

      showSuccess('Enrollment complete', 'Patient has been enrolled in maternity care successfully.');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to enroll patient:', error);
      showError('Enrollment failed', 'Unable to enroll patient in maternity care.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const search = async () => {
      if (!patientSearchTerm || patientSearchTerm.length < 2) {
        setPatientResults([]);
        setPatientLookupError(null);
        return;
      }

      try {
        setPatientLookupLoading(true);
        setPatientLookupError(null);
        const res = await ehrApi.searchPatients(patientSearchTerm, token, tenantSlug);
        const payload = res.data;
        const rows: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.patients)
            ? payload.patients
            : [];
        const filteredRows = rows.filter((p) => {
          const gender = (p.gender || p.sex || '').toString().toLowerCase();
          return gender === '' || gender === 'female'
            || gender === 'f' || gender === 'woman' || gender === 'girl';
        });
        setPatientResults(
          filteredRows.map((p) => ({
            id: p.id,
            firstName: p.first_name || p.firstName || '',
            lastName: p.last_name || p.lastName || '',
            patientNumber: p.patient_number || p.patientNumber,
            dateOfBirth: p.date_of_birth || p.dateOfBirth,
            phone: p.phone,
          })),
        );
      } catch (err) {
        console.error('Failed to search patients', err);
        setPatientLookupError('Unable to search patients. Try again.');
      } finally {
        setPatientLookupLoading(false);
      }
    };

    const timeout = setTimeout(search, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [patientSearchTerm, tenantSlug, token]);

  useEffect(() => {
    const loadSharedPatientContext = async () => {
      if (!selectedPatient?.id) {
        setSharedPatientContext(null);
        return;
      }

      try {
        setContextLoading(true);
        const response = await ehrApi.getPatientContext(selectedPatient.id, token, tenantSlug);
        const context = response.data || null;
        setSharedPatientContext(context);

        const latestMaternity = context?.modules?.maternity?.latestEnrollment;
        if (!latestMaternity) {
          return;
        }

        if (latestMaternity.lmp_date && !lmpDate) {
          const nextLmpDate = String(latestMaternity.lmp_date).slice(0, 10);
          setLmpDate(nextLmpDate);
          calculateEDD(nextLmpDate);
        }

        if (latestMaternity.gravida != null) {
          setGravida(Math.max(1, Number(latestMaternity.gravida) || 1));
        }
        if (latestMaternity.para != null) {
          setPara(Math.max(0, Number(latestMaternity.para) || 0));
        }
        if (latestMaternity.parity_term != null) {
          setParityTerm(Math.max(0, Number(latestMaternity.parity_term) || 0));
        }
        if (latestMaternity.parity_preterm != null) {
          setParityPreterm(Math.max(0, Number(latestMaternity.parity_preterm) || 0));
        }
        if (latestMaternity.parity_abortions != null) {
          setParityAbortions(Math.max(0, Number(latestMaternity.parity_abortions) || 0));
        }
        if (latestMaternity.parity_living != null) {
          setParityLiving(Math.max(0, Number(latestMaternity.parity_living) || 0));
        }
        if (typeof latestMaternity.previous_cesarean === 'boolean') {
          setPreviousCesarean(latestMaternity.previous_cesarean);
        }
        if (latestMaternity.previous_complications && !previousComplications) {
          setPreviousComplications(String(latestMaternity.previous_complications));
        }
      } catch (error) {
        console.error('Failed to load shared patient context for maternity enrollment', error);
      } finally {
        setContextLoading(false);
      }
    };

    loadSharedPatientContext();
  }, [calculateEDD, lmpDate, previousComplications, selectedPatient?.id, tenantSlug, token]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-pink-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center">
                <Baby className="w-6 h-6 mr-2" />
                Maternity Care Enrollment
              </h2>
              <p className="text-pink-100 mt-1">
                Patient: {computedPatientName || 'Select patient'}
              </p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-pink-800 rounded-lg p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {!selectedPatient && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-pink-600" />
                Search Patient to Enroll <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={patientSearchTerm}
                onChange={(e) => setPatientSearchTerm(e.target.value)}
                placeholder="Search by name, patient number, or national ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              {patientLookupError && (
                <p className="text-sm text-red-600 mt-1">{patientLookupError}</p>
              )}
              {patientLookupLoading && (
                <p className="text-sm text-gray-500 mt-1">Searching patients...</p>
              )}
              {!patientLookupLoading && patientResults.length > 0 && (
                <div className="mt-3 border border-gray-200 rounded-lg divide-y max-h-56 overflow-y-auto">
                  {patientResults.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatient(patient);
                        setPatientResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-pink-50 focus:outline-none"
                    >
                      <div className="font-semibold text-gray-900">
                        {patient.firstName} {patient.lastName}
                      </div>
                      <div className="text-xs text-gray-600 flex flex-wrap gap-3 mt-1">
                        {patient.patientNumber && <span>#{patient.patientNumber}</span>}
                        {patient.dateOfBirth && <span>DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</span>}
                        {patient.phone && <span>{patient.phone}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Don’t see the patient? Ensure they are registered in the system first.
              </p>
            </div>
          )}

          {selectedPatient && (
            <div className="mb-6 bg-pink-50 border border-pink-200 rounded-lg p-4 flex items-start justify-between">
              <div>
                <p className="text-sm text-pink-800 uppercase tracking-wide">Patient Selected</p>
                <h3 className="text-lg font-semibold text-pink-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </h3>
                <div className="text-sm text-pink-800 flex flex-wrap gap-4 mt-1">
                  {selectedPatient.patientNumber && <span>#{selectedPatient.patientNumber}</span>}
                  {selectedPatient.dateOfBirth && (
                    <span>DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</span>
                  )}
                  {selectedPatient.phone && <span>{selectedPatient.phone}</span>}
                </div>
                {contextLoading && (
                  <p className="text-xs text-pink-700 mt-2">Loading shared context...</p>
                )}
                {sharedPatientContext?.modules?.maternity?.latestEnrollment?.id && (
                  <div className="mt-2 text-xs text-pink-900">
                    Reused prior maternity context
                    {' '}
                    ({sharedPatientContext.modules.maternity.latestEnrollment.enrollment_number || 'previous enrollment'})
                    {' '}
                    to prefill parity and risk history.
                  </div>
                )}
                {sharedPatientContext?.modules?.maternity?.latestEnrollment?.enrollment_status === 'active' && (
                  <div className="mt-2 text-xs font-semibold text-amber-700">
                    Active maternity enrollment already exists. Confirm this new enrollment is intentional.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearchTerm('');
                  setSharedPatientContext(null);
                }}
                className="text-xs px-3 py-1 bg-white text-pink-600 border border-pink-300 rounded-lg hover:bg-pink-100"
              >
                Change patient
              </button>
            </div>
          )}

          {/* Enrollment Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enrollment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={enrollmentDate}
              onChange={(e) => setEnrollmentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              required
            />
          </div>

          {/* Pregnancy Dating */}
          <div className="bg-pink-50 rounded-lg p-4 border-2 border-pink-200 mb-6">
            <h3 className="font-semibold text-pink-900 mb-3 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Pregnancy Dating
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Menstrual Period (LMP) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={lmpDate}
                  onChange={(e) => handleLMPChange(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Delivery Date (EDD)
                </label>
                <input
                  type="date"
                  value={edd}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                  placeholder="Calculated from LMP"
                />
                {edd && (
                  <p className="text-xs text-pink-600 mt-1">
                    Calculated: {new Date(edd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Obstetric History - Gravida/Para */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Obstetric History (Gravida/Para)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gravida <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={gravida}
                  onChange={(e) => setGravida(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Total pregnancies</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Para
                </label>
                <input
                  type="number"
                  value={para}
                  onChange={(e) => setPara(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
                <p className="text-xs text-gray-500 mt-1">Deliveries {'>'} 20 weeks</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term Deliveries
                </label>
                <input
                  type="number"
                  value={parityTerm}
                  onChange={(e) => setParityTerm(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preterm Deliveries
                </label>
                <input
                  type="number"
                  value={parityPreterm}
                  onChange={(e) => setParityPreterm(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Abortions/Miscarriages
                </label>
                <input
                  type="number"
                  value={parityAbortions}
                  onChange={(e) => setParityAbortions(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Living Children
                </label>
                <input
                  type="number"
                  value={parityLiving}
                  onChange={(e) => setParityLiving(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Risk Assessment</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previousCesarean}
                  onChange={(e) => setPreviousCesarean(e.target.checked)}
                  className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-gray-900">Previous Cesarean Section</span>
              </label>
            </div>
          </div>

          {/* Previous Complications */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Previous Pregnancy Complications
            </label>
            <textarea
              value={previousComplications}
              onChange={(e) => setPreviousComplications(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              rows={3}
              placeholder="Document any previous pregnancy or delivery complications (e.g., 'PPH in 2020', 'Pre-eclampsia', 'Gestational diabetes')"
            />
          </div>

          {/* Risk Warning */}
          {(previousCesarean || para >= 5 || parityAbortions >= 3) && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-900">High-Risk Pregnancy Indicators Detected</p>
                <p className="text-sm text-yellow-800 mt-1">
                  This patient will be automatically categorized as high-risk and may require:
                </p>
                <ul className="text-sm text-yellow-800 mt-2 space-y-1 ml-4">
                  {previousCesarean && <li>• Specialized obstetric care (previous cesarean)</li>}
                  {para >= 5 && <li>• Grand multiparity monitoring (≥5 deliveries)</li>}
                  {parityAbortions >= 3 && <li>• Recurrent pregnancy loss evaluation</li>}
                </ul>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {edd && `EDD: ${new Date(edd).toLocaleDateString()}`}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedPatient || !lmpDate || loading}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Enrolling...</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5" />
                    <span>Enroll in Maternity Care</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
