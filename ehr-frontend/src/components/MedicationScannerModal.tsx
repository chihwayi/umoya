import React, { useState } from 'react';
import { X, Scan, CheckCircle, AlertTriangle, Shield, Clock } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrAxios } from '../services/api';

interface MedicationScannerModalProps {
  prescription: any;
  patient: any;
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const MedicationScannerModal: React.FC<MedicationScannerModalProps> = ({
  prescription,
  patient,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [step, setStep] = useState(1); // 1=scan patient, 2=scan medication, 3=verify, 4=administer
  const [loading, setLoading] = useState(false);
  const [patientBarcode, setPatientBarcode] = useState('');
  const [medicationBarcode, setMedicationBarcode] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [administrationSite, setAdministrationSite] = useState('');
  const [notes, setNotes] = useState('');
  const [witnessRequired] = useState(() => {
    const medName = (prescription.medicationName || prescription.medication || '').toLowerCase();
    const highRiskPatterns = ['insulin', 'heparin', 'warfarin', 'morphine', 'fentanyl', 'oxycodone', 'hydromorphone', 'methadone', 'blood', 'chemotherapy', 'potassium chloride', 'digoxin'];
    return highRiskPatterns.some(p => medName.includes(p));
  });
  const [witnessName, setWitnessName] = useState('');
  const [witnessId, setWitnessId] = useState('');
  const [witnessConfirmed, setWitnessConfirmed] = useState(false);

  const handleScanPatient = async () => {
    if (!patientBarcode) {
      showError('Error', 'Please enter or scan patient barcode');
      return;
    }

    try {
      setLoading(true);
      const response = await ehrAxios.get(`/bcma/wristband/verify/${patientBarcode}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      if (response.data.patientId !== patient.id) {
        showError('Wrong Patient', 'Scanned wristband does not match selected patient');
        return;
      }

      showSuccess('✅ Patient Verified', 'Correct patient identified');
      setStep(2);
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Invalid patient wristband');
    } finally {
      setLoading(false);
    }
  };

  const handleScanMedication = async () => {
    if (!medicationBarcode) {
      showError('Error', 'Please enter or scan medication barcode');
      return;
    }

    try {
      setLoading(true);

      // Verify 5 Rights
      const response = await ehrAxios.post('/bcma/verify-5-rights', {
        patientBarcode,
        medicationBarcode,
        prescriptionId: prescription.id,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      setVerificationResult(response.data);

      if (response.data.verified) {
        showSuccess('✅ Medication Verified', 'All 5 Rights verified');
        setStep(3);
      } else {
        showError('Verification Failed', response.data.failures.join(', '));
      }
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Medication verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminister = async () => {
    if (witnessRequired && !witnessConfirmed) {
      showError('Witness Required', 'This is a high-risk medication. A witness must confirm before administration.');
      return;
    }

    try {
      setLoading(true);

      const marData: any = {
        prescriptionId: prescription.id,
        patientId: patient.id,
        medicationName: prescription.medicationName || prescription.medication,
        medicationBarcode,
        dose: prescription.dose,
        unit: prescription.unit,
        route: prescription.route,
        scheduledTime: new Date(),
        rightPatientVerified: true,
        rightMedicationVerified: true,
        rightDoseVerified: true,
        rightRouteVerified: true,
        rightTimeVerified: true,
        patientWristbandScanned: true,
        patientBarcode,
        medicationBarcodeScanned: true,
        scanTimestamp: new Date(),
        administrationSite,
        notes,
      };

      if (witnessRequired) {
        marData.witnessName = witnessName;
        marData.witnessId = witnessId;
        marData.witnessConfirmed = true;
      }

      await ehrAxios.post('/bcma/administer', marData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('✅ Medication Administered', 'MAR created successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to record administration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Scan className="w-6 h-6" />
                Barcode Medication Administration
              </h2>
              <p className="text-blue-100 mt-1">5 Rights Verification</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-slate-50 p-4 border-b border-slate-200">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  {s}
                </div>
                {s < 4 && (
                  <div className={`w-16 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between max-w-lg mx-auto mt-2 text-xs text-slate-600">
            <span>Patient</span>
            <span>Medication</span>
            <span>Verify</span>
            <span>Administer</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Scan Patient */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Step 1: Verify Patient Identity
                </h3>
                <p className="text-sm text-slate-600">
                  Scan patient wristband to confirm identity
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Patient Wristband Barcode
                </label>
                <input
                  type="text"
                  value={patientBarcode}
                  onChange={(e) => setPatientBarcode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleScanPatient()}
                  placeholder="Scan or enter wristband barcode..."
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-lg"
                />
              </div>

              <div className="bg-slate-100 rounded-xl p-4">
                <p className="text-sm text-slate-700 mb-2"><strong>Expected Patient:</strong></p>
                <p className="text-lg font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-sm text-slate-600">MRN: {patient.medicalRecordNumber}</p>
              </div>

              <button
                onClick={handleScanPatient}
                disabled={loading || !patientBarcode}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify Patient'}
              </button>
            </div>
          )}

          {/* Step 2: Scan Medication */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Patient Verified ✅
                </h3>
                <p className="text-sm text-slate-600">
                  Now scan medication barcode
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Medication Barcode
                </label>
                <input
                  type="text"
                  value={medicationBarcode}
                  onChange={(e) => setMedicationBarcode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleScanMedication()}
                  placeholder="Scan or enter medication barcode..."
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 font-mono text-lg"
                />
              </div>

              <div className="bg-slate-100 rounded-xl p-4">
                <p className="text-sm text-slate-700 mb-2"><strong>Expected Medication:</strong></p>
                <p className="text-lg font-bold text-slate-900">
                  {prescription.medicationName || prescription.medication}
                </p>
                <p className="text-sm text-slate-600">
                  Dose: {prescription.dose} {prescription.unit} | Route: {prescription.route}
                </p>
              </div>

              <button
                onClick={handleScanMedication}
                disabled={loading || !medicationBarcode}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify Medication'}
              </button>
            </div>
          )}

          {/* Step 3: Verify 5 Rights */}
          {step === 3 && verificationResult && (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  5 Rights Verification Complete
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Right Patient:</span> {verificationResult.patient.firstName} {verificationResult.patient.lastName}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Right Medication:</span> {verificationResult.medication.medicationName}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Right Dose:</span> {prescription.dose} {prescription.unit}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Right Route:</span> {prescription.route}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Right Time:</span> Now
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {verificationResult.alerts && verificationResult.alerts.length > 0 && (
                <div className="space-y-2">
                  {verificationResult.alerts.map((alert: any, idx: number) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-4 border-2 ${
                        alert.severity === 'critical' ? 'bg-red-50 border-red-300' :
                        alert.severity === 'high' ? 'bg-orange-50 border-orange-300' :
                        'bg-yellow-50 border-yellow-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                          alert.severity === 'critical' ? 'text-red-600' :
                          alert.severity === 'high' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`} />
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{alert.type.replace('_', ' ').toUpperCase()}</p>
                          <p className="text-sm text-slate-700">{alert.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Administration Details */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Administration Site (if applicable)
                </label>
                <input
                  type="text"
                  value={administrationSite}
                  onChange={(e) => setAdministrationSite(e.target.value)}
                  placeholder="e.g., Right deltoid, Left arm IV"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Witness Enforcement (K5) */}
              {witnessRequired && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-700" />
                    <h4 className="font-bold text-amber-900 text-sm">Witness Required — High-Risk Medication</h4>
                  </div>
                  <p className="text-xs text-amber-800 mb-3">
                    This medication requires an independent witness to verify dose and patient before administration.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Witness Name</label>
                      <input
                        type="text"
                        value={witnessName}
                        onChange={(e) => setWitnessName(e.target.value)}
                        placeholder="e.g., Nurse Jane Smith"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Witness Staff ID</label>
                      <input
                        type="text"
                        value={witnessId}
                        onChange={(e) => setWitnessId(e.target.value)}
                        placeholder="Staff ID or badge #"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={witnessConfirmed}
                      onChange={(e) => setWitnessConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-400"
                      disabled={!witnessName.trim() || !witnessId.trim()}
                    />
                    <span className="text-sm font-semibold text-amber-900">
                      I confirm that the witness has verified the medication, dose, and patient identity.
                    </span>
                  </label>
                </div>
              )}

              <button
                onClick={handleAdminister}
                disabled={loading || (witnessRequired && !witnessConfirmed)}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Administering...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Administer Medication
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{new Date().toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>BCMA Safety System</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationScannerModal;

