import React, { useState } from 'react';
import { Syringe, Calendar, User, AlertTriangle, X } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface VaccineAdministrationModalProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const VaccineAdministrationModal: React.FC<VaccineAdministrationModalProps> = ({
  patientId,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [formData, setFormData] = useState({
    vaccineCode: '',
    vaccineName: '',
    manufacturer: '',
    lotNumber: '',
    expirationDate: '',
    administrationDate: new Date().toISOString().split('T')[0],
    administrationTime: new Date().toTimeString().slice(0, 5),
    doseNumber: '1',
    route: 'Intramuscular',
    site: '',
    notes: '',
    reactionObserved: false,
    reactionDetails: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const commonVaccines = [
    { code: 'COVID19', name: 'COVID-19 Vaccine' },
    { code: 'FLU', name: 'Influenza Vaccine' },
    { code: 'PNEUMO', name: 'Pneumococcal Vaccine' },
    { code: 'HEPA', name: 'Hepatitis A Vaccine' },
    { code: 'HEPB', name: 'Hepatitis B Vaccine' },
    { code: 'HPV', name: 'HPV Vaccine' },
    { code: 'MMR', name: 'MMR Vaccine' },
    { code: 'TDAP', name: 'Tdap Vaccine' },
    { code: 'VARICELLA', name: 'Varicella Vaccine' },
  ];

  const administrationSites = [
    'Left deltoid',
    'Right deltoid',
    'Left thigh',
    'Right thigh',
    'Left gluteal',
    'Right gluteal',
  ];

  const handleSubmit = async () => {
    if (!formData.vaccineCode || !formData.vaccineName || !formData.site) {
      showError('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await ehrApi.administerVaccine(patientId, formData, token, tenantSlug);
      showSuccess('Success', 'Vaccine administered and recorded successfully');
      onSuccess();
      onClose();
    } catch (error) {
      showError('Error', 'Failed to record vaccine administration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Syringe className="w-6 h-6" />
                Administer Vaccine
              </h3>
              <p className="text-green-100 mt-1">Record vaccine administration</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Vaccine Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Vaccine *</label>
            <select
              value={formData.vaccineCode}
              onChange={(e) => {
                const vaccine = commonVaccines.find(v => v.code === e.target.value);
                setFormData({
                  ...formData,
                  vaccineCode: e.target.value,
                  vaccineName: vaccine?.name || '',
                });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select Vaccine</option>
              {commonVaccines.map((vaccine) => (
                <option key={vaccine.code} value={vaccine.code}>
                  {vaccine.name}
                </option>
              ))}
            </select>
          </div>

          {/* Administration Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Administration Date *</label>
              <input
                type="date"
                value={formData.administrationDate}
                onChange={(e) => setFormData({ ...formData, administrationDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Administration Time</label>
              <input
                type="time"
                value={formData.administrationTime}
                onChange={(e) => setFormData({ ...formData, administrationTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Dose and Route */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Dose Number</label>
              <input
                type="number"
                min="1"
                value={formData.doseNumber}
                onChange={(e) => setFormData({ ...formData, doseNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Route</label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="Intramuscular">Intramuscular</option>
                <option value="Subcutaneous">Subcutaneous</option>
                <option value="Intradermal">Intradermal</option>
                <option value="Oral">Oral</option>
                <option value="Intranasal">Intranasal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Site *</label>
              <select
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select Site</option>
                {administrationSites.map((site) => (
                  <option key={site} value={site}>{site}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vaccine Details */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="e.g., Pfizer"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Lot Number</label>
              <input
                type="text"
                value={formData.lotNumber}
                onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                placeholder="e.g., EL1234"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Expiration Date</label>
              <input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Reaction */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="reactionObserved"
                checked={formData.reactionObserved}
                onChange={(e) => setFormData({ ...formData, reactionObserved: e.target.checked })}
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="reactionObserved" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Adverse reaction observed
              </label>
            </div>
            {formData.reactionObserved && (
              <textarea
                value={formData.reactionDetails}
                onChange={(e) => setFormData({ ...formData, reactionDetails: e.target.value })}
                rows={2}
                placeholder="Describe the reaction..."
                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Recording...
              </>
            ) : (
              <>
                <Syringe className="w-4 h-4" />
                Record Administration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VaccineAdministrationModal;

