import React, { useState, useEffect } from 'react';
import { X, Search, User, Calendar, DollarSign, FileText, Loader2 } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrApi, ehrAxios } from '../services/api';

interface AddChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId?: string;
  patientName?: string;
  admissionId?: string;
  tenantSlug: string;
}

const AddChargeModal: React.FC<AddChargeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  patientId: initialPatientId,
  patientName: initialPatientName,
  admissionId: initialAdmissionId,
  tenantSlug,
}) => {
  const { showSuccess, showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';
  const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [chargeMaster, setChargeMaster] = useState<any[]>([]);
  const [filteredCharges, setFilteredCharges] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    patientId: initialPatientId || '',
    patientName: initialPatientName || '',
    admissionId: initialAdmissionId || '',
    chargeCode: '',
    chargeDescription: '',
    quantity: 1,
    unitPrice: 0,
    serviceDate: new Date().toISOString().split('T')[0],
    department: '',
    cptCode: '',
    icd10Code: '',
    notes: '',
  });

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadChargeMaster();
      if (!initialPatientId) {
        loadPatients();
      }
      if (initialPatientId && !initialAdmissionId) {
        loadAdmissions(initialPatientId);
      }
    }
  }, [isOpen, initialPatientId, initialAdmissionId]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = chargeMaster.filter(
        (charge) =>
          charge.chargeDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
          charge.chargeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (charge.cptCode && charge.cptCode.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredCharges(filtered);
    } else {
      setFilteredCharges(chargeMaster.slice(0, 20)); // Show first 20 by default
    }
  }, [searchQuery, chargeMaster]);

  const loadChargeMaster = async () => {
    try {
      setSearching(true);
      const response = await ehrAxios.get('/revenue-cycle/charge-master', {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setChargeMaster(response.data || []);
      setFilteredCharges((response.data || []).slice(0, 20));
    } catch (error) {
      showError('Error', 'Failed to load charge master');
    } finally {
      setSearching(false);
    }
  };

  const loadPatients = async () => {
    try {
      const response = await ehrAxios.get('/patients', {
        params: { limit: 100 },
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setPatients(response.data.patients || []);
    } catch (error) {
      // Silent fail
    }
  };

  const loadAdmissions = async (patientId: string) => {
    try {
      // Use the API service method for consistency
      const response = await ehrApi.getPatientAdmissions(patientId, token, tenantSlug, false);
      const activeAdmissions = (response.data || []).filter(
        (adm: any) => adm.admissionStatus === 'active'
      );
      setAdmissions(activeAdmissions);
    } catch (error) {
      // Silent fail - patient may not have admissions
      setAdmissions([]);
    }
  };

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    setFormData({
      ...formData,
      patientId,
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : '',
    });
    loadAdmissions(patientId);
  };

  const handleChargeSelect = (charge: any) => {
    setFormData({
      ...formData,
      chargeCode: charge.chargeCode,
      chargeDescription: charge.chargeDescription,
      unitPrice: parseFloat(charge.standardCharge),
      department: charge.department || '',
      cptCode: charge.cptCode || '',
    });
    setSearchQuery('');
    setFilteredCharges(chargeMaster.slice(0, 20));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.chargeCode) {
      showError('Validation Error', 'Please select a patient and charge item');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        patientId: formData.patientId,
        admissionId: formData.admissionId || null,
        chargeCode: formData.chargeCode,
        chargeDescription: formData.chargeDescription,
        quantity: parseFloat(formData.quantity.toString()),
        unitPrice: parseFloat(formData.unitPrice.toString()),
        serviceDate: formData.serviceDate,
        department: formData.department,
        cptCode: formData.cptCode || null,
        icd10Code: formData.icd10Code || null,
        orderingProviderId: currentUser.id,
        chargeStatus: 'pending',
        captureMethod: 'manual',
        notes: formData.notes || null,
      };

      await ehrAxios.post('/revenue-cycle/charges', payload, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Charge added successfully');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to add charge');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: initialPatientId || '',
      patientName: initialPatientName || '',
      admissionId: initialAdmissionId || '',
      chargeCode: '',
      chargeDescription: '',
      quantity: 1,
      unitPrice: 0,
      serviceDate: new Date().toISOString().split('T')[0],
      department: '',
      cptCode: '',
      icd10Code: '',
      notes: '',
    });
    setSearchQuery('');
  };

  if (!isOpen) return null;

  const totalAmount = formData.quantity * formData.unitPrice;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                Add Charge to Patient
              </h2>
              <p className="text-slate-600 mt-1">Capture a new charge for billing</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Selection */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Patient Information
              </h3>
              {initialPatientId ? (
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="font-semibold text-slate-900">{formData.patientName || 'Selected Patient'}</p>
                  <p className="text-sm text-slate-600">Patient ID: {formData.patientId}</p>
                </div>
              ) : (
                <select
                  required
                  value={formData.patientId}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select Patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName} - {patient.patientNumber}
                    </option>
                  ))}
                </select>
              )}

              {/* Admission Selection */}
              {formData.patientId && admissions.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Link to Admission (Optional)
                  </label>
                  <select
                    value={formData.admissionId}
                    onChange={(e) => setFormData({ ...formData, admissionId: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">No admission link</option>
                    {admissions.map((adm) => (
                      <option key={adm.id} value={adm.id}>
                        Admission {adm.admissionNumber} - {new Date(adm.admissionDate).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Charge Selection */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Charge Item
              </h3>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search charges by description, code, or CPT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Charge List */}
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                </div>
              ) : filteredCharges.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No charges found. Try a different search term.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {filteredCharges.map((charge) => (
                    <button
                      key={charge.id}
                      type="button"
                      onClick={() => handleChargeSelect(charge)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        formData.chargeCode === charge.chargeCode
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-green-300 hover:bg-green-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{charge.chargeDescription}</p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                            <span>Code: {charge.chargeCode}</span>
                            {charge.cptCode && <span>CPT: {charge.cptCode}</span>}
                            {charge.department && <span>Dept: {charge.department}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${parseFloat(charge.standardCharge).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Charge Details */}
              {formData.chargeCode && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-semibold text-slate-900 mb-2">Selected Charge:</p>
                  <p className="text-slate-700">{formData.chargeDescription}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                    <span>Code: {formData.chargeCode}</span>
                    {formData.cptCode && <span>CPT: {formData.cptCode}</span>}
                    {formData.department && <span>Dept: {formData.department}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Charge Details */}
            {formData.chargeCode && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Charge Details
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData({ ...formData, quantity: parseFloat(e.target.value) || 1 })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Unit Price *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.unitPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Service Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.serviceDate}
                      onChange={(e) => setFormData({ ...formData, serviceDate: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Total Amount
                    </label>
                    <div className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg">
                      <p className="text-xl font-bold text-green-600">
                        ${totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ICD-10 Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.icd10Code}
                      onChange={(e) => setFormData({ ...formData, icd10Code: e.target.value })}
                      placeholder="e.g., K35.80"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes about this charge..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              {formData.chargeCode && (
                <p className="text-sm text-slate-600">
                  Total: <span className="font-bold text-green-600">${totalAmount.toFixed(2)}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading || !formData.patientId || !formData.chargeCode}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    Add Charge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddChargeModal;

