import React, { useEffect, useState } from 'react';
import { Brain, AlertTriangle, CheckCircle } from 'lucide-react';
import { cdssApi } from '../services/api';
import { AiOutputWrapper } from './AiOutputWrapper';
import { AbstentionBanner } from './AbstentionBanner';

interface OrderSetSuggestion {
  panel_name: string;
  category: string;
  suggested_tests: string[];
  confidence: number;
  rationale: string;
  evidence_level: string;
  citations: any[];
}

interface OrderIntelligencePanelProps {
  diagnoses: string[];
  activeMediactions?: string[];
  chiefComplaint?: string;
  vitalFlags?: string[];
  patientAge?: number;
  encounterType?: string;
  token: string;
  tenantSlug: string;
  onSelectOrderSet?: (tests: string[], panelName: string) => void;
}

export const OrderIntelligencePanel: React.FC<OrderIntelligencePanelProps> = ({
  diagnoses, activeMediactions = [], chiefComplaint = '', vitalFlags = [],
  patientAge, encounterType = 'outpatient', token, tenantSlug, onSelectOrderSet,
}) => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (diagnoses.length === 0 && !chiefComplaint) return;
    setLoading(true);
    try {
      const res = await cdssApi.suggestOrderSets({
        diagnoses, active_medications: activeMediactions,
        chief_complaint: chiefComplaint, vitals_flags: vitalFlags,
        patient_age: patientAge, encounter_type: encounterType,
      }, token, tenantSlug);
      setResult(res.data);
    } catch { setResult(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [diagnoses.join(','), chiefComplaint]);

  if (!result && !loading) return null;

  const suggestions: OrderSetSuggestion[] = result?.suggestions ?? [];

  return (
    <AiOutputWrapper
      label="Order Set Suggestions"
      confidence={result?.confidence}
      abstained={result?.abstained}
      abstain_reason={result?.abstain_reason}
      model_id={result?.model_id}
    >
      <div className="space-y-2">
        {loading && <div className="text-xs text-gray-400 py-2">Analyzing clinical context...</div>}
        {result?.abstained && (
          <AbstentionBanner surface="Order Intelligence" reason={result.abstain_reason} />
        )}
        {suggestions.map((s, i) => (
          <div key={i} className="border border-indigo-100 rounded-lg p-3 bg-indigo-50/40">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <span className="text-sm font-semibold text-indigo-900">{s.panel_name}</span>
                <span className="ml-2 text-[10px] text-indigo-500 uppercase tracking-wide">{s.category}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-indigo-600 font-medium">{Math.round(s.confidence * 100)}% match</span>
                {onSelectOrderSet && (
                  <button
                    onClick={() => onSelectOrderSet(s.suggested_tests, s.panel_name)}
                    className="ml-2 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-semibold hover:bg-indigo-700"
                  >
                    Add Panel
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-1.5">{s.rationale}</p>
            <div className="flex flex-wrap gap-1">
              {s.suggested_tests.map((t, j) => (
                <span key={j} className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded text-[10px] text-indigo-800">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AiOutputWrapper>
  );
};
