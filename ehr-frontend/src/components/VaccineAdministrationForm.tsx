import React, { useState, useEffect } from 'react';
import { X, Syringe, Calendar, MapPin, AlertTriangle, Check } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import DatePicker from './DatePicker';

interface VaccineAdministrationFormProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const VaccineAdministrationForm: React.FC<VaccineAdministrationFormProps> = ({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    vaccineCode: '',
    vaccineName: '',
    manufacturer: '',
    lotNumber: '',
    expirationDate: '',
    administrationDate: new Date().toISOString().split('T')[0],
    doseNumber: 1,
    route: 'intramuscular',
    site: 'left_deltoid',
    notes: '',
    visPresented: false,
  });

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const response = await ehrApi.get('/vaccine-inventory?status=active', token, tenantSlug);
      setInventory(response.data || []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
  };

  const handleVaccineSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = inventory.find(v => v.id === e.target.value);
    if (selected) {
      setFormData({
        ...formData,
        vaccineCode: selected.vaccineCode,
        vaccineName: selected.vaccineName,
        manufacturer: selected.manufacturer || '',
        lotNumber: selected.lotNumber,
        expirationDate: selected.expirationDate,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vaccineCode || !formData.administrationDate) {
      showError('Error', 'Please fill in required fields');
      return;
    }

    try {
      setLoading(true);
      await ehrApi.post(
        '/immunizations',
        {
          patientId,
          ...formData,
        },
        token,
        tenantSlug,
      );
      
      showSuccess('Success', 'Vaccine administration recorded');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to record immunization:', error);
      showError('Error', error.response?.data?.message || 'Failed to record vaccine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Syringe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Record Vaccination</h2>
              <p className="text-xs sm:text-sm text-purple-100">{patientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-purple-100">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Vaccine Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Vaccine from Inventory <span className="text-red-500">*</span>
            </label>
            <select
              onChange={handleVaccineSelect}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
              required
            >
              <option value="">-- Select Vaccine --</option>
              {inventory.map(vax => (
                <option key={vax.id} value={vax.id}>
                  {vax.vaccineName} - Lot: {vax.lotNumber} (Exp: {new Date(vax.expirationDate).toLocaleDateString()}) - {vax.quantityRemaining} available
                </option>
              ))}
            </select>
          </div>

          {/* Administration Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Administration Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.administrationDate}
                onChange={(e) => setFormData({ ...formData, administrationDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Dose Number
              </label>
              <input
                type="number"
                value={formData.doseNumber}
                onChange={(e) => setFormData({ ...formData, doseNumber: parseInt(e.target.value) })}
                min="1"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Route <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
                required
              >
                <option value="intramuscular">Intramuscular (IM)</option>
                <option value="subcutaneous">Subcutaneous (SC)</option>
                <option value="oral">Oral (PO)</option>
                <option value="intradermal">Intradermal (ID)</option>
                <option value="intranasal">Intranasal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Injection Site <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
                required
              >
                <option value="left_deltoid">Left Deltoid</option>
                <option value="right_deltoid">Right Deltoid</option>
                <option value="left_thigh">Left Thigh</option>
                <option value="right_thigh">Right Thigh</option>
                <option value="left_gluteal">Left Gluteal</option>
                <option value="right_gluteal">Right Gluteal</option>
              </select>
            </div>
          </div>

          {/* VIS Presented */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.visPresented}
                onChange={(e) => setFormData({ ...formData, visPresented: e.target.checked })}
                className="mt-1 w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-2 focus:ring-purple-500"
              />
              <div>
                <div className="font-medium text-slate-900 text-sm sm:text-base">Vaccine Information Statement (VIS) Presented</div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  Confirm that VIS was provided and explained to patient
                </div>
              </div>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
              placeholder="Any additional notes or observations..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-lg hover:from-purple-700 hover:to-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Record Vaccination</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VaccineAdministrationForm;

