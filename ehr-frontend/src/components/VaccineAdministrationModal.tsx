import React, { useState, useEffect } from 'react';
import { Syringe, Calendar, User, AlertTriangle, X } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker from './SnomedConceptPicker';
import { ehrAxios, storeroomApi } from '../services/api';
import StockRequestModal from './StockRequestModal';

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
    cvxCode: '', // CDC CVX code
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
    reactionSnomedConceptId: '',
    reactionTerm: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [vaccineStock, setVaccineStock] = useState<Record<string, number>>({});
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestVaccine, setRequestVaccine] = useState<string | null>(null);

  useEffect(() => {
    storeroomApi.listLocations(token, tenantSlug).then((locs: any[]) => {
      const store = locs.find((l: any) => l.code === 'VACCINE_STORE');
      if (!store) return;
      storeroomApi.getStockByLocation(store.id, { category: 'vaccine' }, token, tenantSlug)
        .then((stock: any[]) => {
          const map: Record<string, number> = {};
          for (const s of stock) {
            const key = s.item_name ?? s.name;
            if (key) map[key] = (map[key] ?? 0) + (s.quantity_on_hand ?? 0);
          }
          setVaccineStock(map);
        })
        .catch(() => {});
    }).catch(() => {});
  }, [token, tenantSlug]);

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
      showError('Error', 'Please fill in all required fields (Vaccine and Site)');
      return;
    }

    try {
      setSubmitting(true);
      await ehrAxios.post(`/immunizations/patient/${patientId}/administer`, formData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
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
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Syringe className="w-6 h-6" />
                Administer Vaccine
              </h3>
              <p className="text-green-100 mt-1">Record vaccine administration with SNOMED coding</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Vaccine Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Vaccine (SNOMED) *</label>
              <SnomedConceptPicker
                value={formData.vaccineCode ? { conceptId: formData.vaccineCode, term: formData.vaccineName } : null}
                onChange={(concept) => {
                  setFormData({
                    ...formData,
                    vaccineCode: concept?.conceptId || '',
                    vaccineName: concept?.term || '',
                  });
                }}
                token={token}
                tenantSlug={tenantSlug}
                ecl="<< 787859002 |Vaccine product (product)|"
                placeholder="Search vaccine (e.g., Influenza, COVID-19)..."
              />
              {formData.vaccineName && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-green-600">Selected: {formData.vaccineName} ({formData.vaccineCode})</p>
                  {vaccineStock[formData.vaccineName] !== undefined && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: vaccineStock[formData.vaccineName] === 0 ? '#fee2e2'
                                : vaccineStock[formData.vaccineName] <= 5  ? '#fef3c7' : '#dcfce7',
                      color: vaccineStock[formData.vaccineName] === 0 ? '#dc2626'
                           : vaccineStock[formData.vaccineName] <= 5  ? '#d97706' : '#16a34a',
                    }}>
                      {vaccineStock[formData.vaccineName] === 0 ? 'OUT OF STOCK' : `${vaccineStock[formData.vaccineName]} vials`}
                    </span>
                  )}
                  {vaccineStock[formData.vaccineName] === 0 && (
                    <button
                      type="button"
                      onClick={() => { setRequestVaccine(formData.vaccineName); setShowRequestModal(true); }}
                      style={{
                        padding: '2px 10px', background: '#fef3c7', border: '1px solid #fde68a',
                        borderRadius: 8, fontSize: 11, cursor: 'pointer', color: '#92400e', fontWeight: 600,
                      }}
                    >
                      Request Stock
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                CVX Code
                <span className="text-xs text-slate-500 ml-1">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.cvxCode}
                onChange={(e) => setFormData({ ...formData, cvxCode: e.target.value })}
                placeholder="e.g., 213"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-slate-50"
              />
            </div>
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
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reaction Type (SNOMED)</label>
                  <SnomedConceptPicker
                    value={formData.reactionSnomedConceptId ? { conceptId: formData.reactionSnomedConceptId, term: formData.reactionTerm } : null}
                    onChange={(concept) => {
                      setFormData({
                        ...formData,
                        reactionSnomedConceptId: concept?.conceptId || '',
                        reactionTerm: concept?.term || '',
                        reactionDetails: formData.reactionDetails || (concept ? `Reaction: ${concept.term}` : '')
                      });
                    }}
                    token={token}
                    tenantSlug={tenantSlug}
                    ecl="<< 404684003 |Clinical finding (finding)|"
                    placeholder="Search reaction (e.g. Fever, Rash)..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Details</label>
                  <textarea
                    value={formData.reactionDetails}
                    onChange={(e) => setFormData({ ...formData, reactionDetails: e.target.value })}
                    rows={2}
                    placeholder="Describe the reaction details..."
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
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

    {showRequestModal && requestVaccine && (
      <StockRequestModal
        defaultItems={[{ catalog_id: '', item_name: requestVaccine, quantity: 10 }]}
        onClose={() => { setShowRequestModal(false); setRequestVaccine(null); }}
        onDone={() => { setShowRequestModal(false); setRequestVaccine(null); }}
      />
    )}
    </>
  );
};

export default VaccineAdministrationModal;

