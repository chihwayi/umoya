import React, { useState } from 'react';
import { Pill, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { cdssApi } from '../services/api';
import { AiOutputWrapper } from './AiOutputWrapper';

interface Med { name: string; dose?: string; frequency?: string; route?: string }

interface MedicationReconciliationAIProps {
  homeMedications: Med[];
  currentMedications: Med[];
  diagnoses?: string[];
  allergies?: string[];
  context?: 'admission' | 'discharge';
  token: string;
  tenantSlug: string;
}

export const MedicationReconciliationAI: React.FC<MedicationReconciliationAIProps> = ({
  homeMedications, currentMedications, diagnoses = [], allergies = [],
  context = 'admission', token, tenantSlug,
}) => {
  const [result, setResult] = useState<any>(null);
  const [pdmpResult, setPdmpResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setPdmpResult(null);
    try {
      const [recRes, pdmpRes] = await Promise.allSettled([
        cdssApi.reconcileMedications(
          { context, home_medications: homeMedications, current_medications: currentMedications, diagnoses, allergies },
          token, tenantSlug,
        ),
        cdssApi.checkPDMP(
          { medications: [...homeMedications, ...currentMedications], controlled_substances: [] },
          token, tenantSlug,
        ),
      ]);
      if (recRes.status === 'fulfilled') setResult((recRes.value as any).data);
      if (pdmpRes.status === 'fulfilled') setPdmpResult((pdmpRes.value as any).data);
    } finally { setLoading(false); }
  };

  const severityClass = (s: string) =>
    s === 'high' ? 'text-red-400 border-red-700 bg-red-900/10'
    : s === 'medium' ? 'text-amber-400 border-amber-700 bg-amber-900/10'
    : 'text-green-400 border-green-700 bg-green-900/10';

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-gray-200">Medication Reconciliation AI</span>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Reconciling...' : 'Run Reconciliation'}
        </button>
      </div>

      {/* PDMP / controlled substance alert */}
      {pdmpResult?.risk_flags?.length > 0 && (
        <div className="border border-red-700 bg-red-900/20 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs">
            <AlertTriangle className="h-4 w-4" /> PDMP / Controlled Substance Alert
          </div>
          {pdmpResult.risk_flags.map((f: string, i: number) => (
            <p key={i} className="text-xs text-red-300">{f}</p>
          ))}
          {pdmpResult.naloxone_indicated && (
            <p className="text-xs text-amber-300 font-semibold">
              Naloxone co-prescription recommended (CDC guideline)
            </p>
          )}
        </div>
      )}

      {result && (
        <AiOutputWrapper
          label={`${context === 'admission' ? 'Admission' : 'Discharge'} Med Reconciliation`}
          confidence={result.confidence}
          abstained={result.abstained}
          abstain_reason={result.abstain_reason}
          model_id={result.model_id}
        >
          <div className="space-y-2 text-xs">
            <div className="flex gap-3 text-gray-400">
              <span>
                Discrepancies:{' '}
                <span className="text-white font-semibold">{result.total_discrepancies}</span>
              </span>
              {result.high_severity_count > 0 && (
                <span className="text-red-400 font-semibold">
                  {result.high_severity_count} HIGH severity
                </span>
              )}
              {result.requires_pharmacist_review && (
                <span className="text-amber-400">Pharmacist review required</span>
              )}
            </div>

            {result.discrepancies?.map((d: any, i: number) => (
              <div key={i} className={`border rounded-lg p-2.5 ${severityClass(d.severity)}`}>
                <div className="flex justify-between mb-0.5">
                  <span className="font-semibold">{d.medication}</span>
                  <span className="uppercase text-[10px] font-bold opacity-70">
                    {(d.type ?? '').replace(/_/g, ' ')}
                  </span>
                </div>
                {d.home_dose && (
                  <p className="opacity-70">
                    Home: {d.home_dose} → Current: {d.current_dose ?? 'not ordered'}
                  </p>
                )}
                <p className="mt-1 opacity-90">{d.action}</p>
              </div>
            ))}

            {result.recommendations?.length > 0 && (
              <div className="border border-blue-800 rounded-lg p-2.5 space-y-1">
                <p className="font-semibold text-blue-400">Recommendations</p>
                {result.recommendations.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-1 text-blue-200">
                    <CheckCircle className="h-3 w-3 shrink-0 mt-0.5" />{r}
                  </div>
                ))}
              </div>
            )}
          </div>
        </AiOutputWrapper>
      )}
    </div>
  );
};
