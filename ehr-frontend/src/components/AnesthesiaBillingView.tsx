import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, Calculator, FileText, CheckCircle } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrAxios } from '../services/api';

interface AnesthesiaBillingViewProps {
  caseId: string;
  tenantSlug: string;
  token: string;
}

const AnesthesiaBillingView: React.FC<AnesthesiaBillingViewProps> = ({
  caseId,
  tenantSlug,
  token,
}) => {
  const { showError, showSuccess } = useNotification();
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBilling();
  }, [caseId]);

  const loadBilling = async () => {
    try {
      setLoading(true);
      const response = await ehrAxios.get(`/anesthesia/billing/case/${caseId}`, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });
      setBilling(response.data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        showError('Error', 'Failed to load billing');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto"></div>
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 text-center">
        <Calculator className="w-12 h-12 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600">Billing not yet calculated</p>
        <p className="text-xs text-slate-500 mt-1">Complete anesthesia record first</p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-5">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          Anesthesia Billing
        </h3>
        <p className="text-green-100 text-sm mt-1">ASA-based calculation</p>
      </div>

      {/* Billing Details */}
      <div className="p-6 space-y-4">
        {/* CPT Code */}
        {billing.anesthesiaCptCode && (
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
            <p className="text-sm text-slate-600 mb-1">CPT Code</p>
            <p className="text-2xl font-bold text-indigo-600">{billing.anesthesiaCptCode}</p>
            {billing.modifiers && (
              <p className="text-xs text-slate-500 mt-1">Modifiers: {billing.modifiers}</p>
            )}
          </div>
        )}

        {/* Units Calculation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-sm font-semibold text-slate-700">Base Units</span>
            <span className="text-lg font-bold text-slate-900">{billing.baseUnits}</span>
          </div>

          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Anesthesia Time</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
              <div>
                <span className="text-slate-600">Start: </span>
                <span className="font-semibold">{new Date(billing.anesthesiaStart).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="text-slate-600">End: </span>
                <span className="font-semibold">{new Date(billing.anesthesiaEnd).toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-purple-300">
              <span className="text-sm font-semibold text-slate-700">Duration: {billing.totalMinutes} minutes</span>
              <span className="text-lg font-bold text-purple-600">{billing.timeUnits} time units</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Calculated: {billing.totalMinutes} min ÷ 15 min/unit</p>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-sm font-semibold text-slate-700">Modifying Units</span>
            <span className="text-lg font-bold text-slate-900">{billing.modifyingUnits}</span>
          </div>
        </div>

        {/* Total */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold text-slate-900">Total Units</span>
            <span className="text-3xl font-bold text-green-600">{billing.totalUnits?.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
            <span>Conversion Factor</span>
            <span className="font-semibold">${billing.conversionFactor?.toFixed(2)} / unit</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t-2 border-green-300">
            <span className="text-xl font-bold text-slate-900">Total Charge</span>
            <span className="text-3xl font-bold text-green-600">${billing.totalCharge?.toFixed(2)}</span>
          </div>
        </div>

        {/* Billed Status */}
        {billing.billedAt && (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Billed on {new Date(billing.billedAt).toLocaleDateString()}</p>
                {billing.billedBy && (
                  <p className="text-sm">by {billing.billedBy.firstName} {billing.billedBy.lastName}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Additional Procedures */}
        {billing.additionalProcedures && billing.additionalProcedures.length > 0 && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm font-semibold text-slate-900 mb-2">Additional Procedures:</p>
            <ul className="space-y-1">
              {billing.additionalProcedures.map((proc: any, idx: number) => (
                <li key={idx} className="text-sm text-slate-700">
                  • {proc.description || proc.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnesthesiaBillingView;

