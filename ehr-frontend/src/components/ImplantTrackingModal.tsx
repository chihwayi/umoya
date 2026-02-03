import React, { useState } from 'react';
import { X, Package, Barcode, DollarSign, MapPin, AlertTriangle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrAxios } from '../services/api';

interface ImplantTrackingModalProps {
  surgicalCaseId: string;
  tenantSlug: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ImplantTrackingModal: React.FC<ImplantTrackingModalProps> = ({
  surgicalCaseId,
  tenantSlug,
  token,
  onSuccess,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    implantName: '',
    implantType: '',
    manufacturer: '',
    catalogNumber: '',
    lotNumber: '',
    serialNumber: '',
    expirationDate: '',
    udi: '',
    udiDi: '',
    udiPi: '',
    chargeCode: '',
    unitCost: '',
    billable: true,
    bodySite: '',
    notes: '',
  });

  const handleTrackImplant = async () => {
    // Validation
    if (!formData.implantName) {
      showError('Error', 'Please enter implant name');
      return;
    }

    if (!formData.lotNumber && !formData.serialNumber && !formData.udi) {
      showError('Error', 'Please enter at least one identifier (Lot Number, Serial Number, or UDI)');
      return;
    }

    try {
      setLoading(true);

      const implantData = {
        surgicalCaseId,
        implantName: formData.implantName,
        implantType: formData.implantType || undefined,
        manufacturer: formData.manufacturer || undefined,
        catalogNumber: formData.catalogNumber || undefined,
        lotNumber: formData.lotNumber || undefined,
        serialNumber: formData.serialNumber || undefined,
        expirationDate: formData.expirationDate || undefined,
        udi: formData.udi || undefined,
        udiDi: formData.udiDi || undefined,
        udiPi: formData.udiPi || undefined,
        chargeCode: formData.chargeCode || undefined,
        unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
        billable: formData.billable,
        bodySite: formData.bodySite || undefined,
        notes: formData.notes || undefined,
      };

      await ehrAxios.post('/operating-room/implants', implantData, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', 'Implant tracked successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to track implant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6" />
                Track Surgical Implant
              </h2>
              <p className="text-purple-100 mt-1">FDA-compliant implant tracking</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* FDA UDI Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">FDA Requirement:</p>
                  <p>All implantable devices MUST be tracked with UDI (Unique Device Identifier) for patient safety and recalls.</p>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Implant Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.implantName}
                  onChange={(e) => setFormData({ ...formData, implantName: e.target.value })}
                  placeholder="e.g., Titanium Hip Prosthesis"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Implant Type
                </label>
                <input
                  type="text"
                  value={formData.implantType}
                  onChange={(e) => setFormData({ ...formData, implantType: e.target.value })}
                  placeholder="e.g., Joint Replacement"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g., Stryker, Medtronic"
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Identifiers */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Barcode className="w-5 h-5 text-purple-600" />
                Device Identifiers
              </h3>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    UDI (Unique Device Identifier) 🏷️
                  </label>
                  <input
                    type="text"
                    value={formData.udi}
                    onChange={(e) => setFormData({ ...formData, udi: e.target.value })}
                    placeholder="Scan or enter full UDI barcode"
                    className="w-full px-4 py-2 border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                  <p className="text-xs text-purple-700 mt-1">
                    Format: (01)00843210001234(17)250101(10)A213B1(21)1234
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lot Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lotNumber}
                      onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                      placeholder="LOT123456"
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Serial Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      placeholder="SN789012"
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Catalog Number
                    </label>
                    <input
                      type="text"
                      value={formData.catalogNumber}
                      onChange={(e) => setFormData({ ...formData, catalogNumber: e.target.value })}
                      placeholder="CAT456"
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full px-4 py-2 border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Billing */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Billing Information
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Charge Code
                  </label>
                  <input
                    type="text"
                    value={formData.chargeCode}
                    onChange={(e) => setFormData({ ...formData, chargeCode: e.target.value })}
                    placeholder="CHG-IMPL-001"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Unit Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.billable}
                      onChange={(e) => setFormData({ ...formData, billable: e.target.checked })}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-sm font-semibold text-slate-700">Billable to Patient</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Clinical Info */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                Clinical Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Body Site / Location
                  </label>
                  <input
                    type="text"
                    value={formData.bodySite}
                    onChange={(e) => setFormData({ ...formData, bodySite: e.target.value })}
                    placeholder="e.g., Right hip, Left knee"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* FDA Compliance Note */}
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
              <p className="text-sm text-yellow-800">
                <strong>FDA Compliance:</strong> This implant will be tracked per FDA regulations. 
                The UDI, lot number, and serial number enable tracking for recalls and adverse event reporting.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleTrackImplant}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Tracking...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Track Implant
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImplantTrackingModal;

