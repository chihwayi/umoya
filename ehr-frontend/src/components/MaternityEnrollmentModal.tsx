import React, { useState } from 'react';
import { X, Heart, Baby, Calendar, AlertTriangle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface MaternityEnrollmentModalProps {
  patientId: string;
  patientName: string;
  patientDateOfBirth: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
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
  const { showSuccess, showError } = useNotification();

  const calculateEDD = (lmp: string) => {
    if (!lmp) return;
    
    const lmpDate = new Date(lmp);
    const eddDate = new Date(lmpDate);
    eddDate.setDate(eddDate.getDate() + 280); // Add 280 days (40 weeks)
    
    setEdd(eddDate.toISOString().split('T')[0]);
  };

  const handleLMPChange = (value: string) => {
    setLmpDate(value);
    calculateEDD(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lmpDate) {
      showError('Please provide Last Menstrual Period date');
      return;
    }

    try {
      setLoading(true);

      await ehrApi.createMaternityEnrollment(tenantSlug, token, {
        patient_id: patientId,
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

      showSuccess('Patient enrolled in maternity care successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to enroll patient:', error);
      showError('Failed to enroll patient in maternity care');
    } finally {
      setLoading(false);
    }
  };

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
              <p className="text-pink-100 mt-1">Patient: {patientName}</p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-pink-800 rounded-lg p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
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
                disabled={!lmpDate || loading}
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

