import React, { useState, useEffect } from 'react';
import { FileCode, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { terminologyApi } from '../services/api';

interface Icd10Mapping {
  conceptId: string;
  targetCode: string;
  targetDisplay: string;
  mapGroup: number;
  mapPriority: number;
  mapRule?: string;
  mapAdvice?: string;
  mapStatus?: string;
  mapCategoryId?: string;
  active: boolean;
  effectiveTime?: string;
  mapSource?: string;
}

interface Icd10SuggestionsProps {
  snomedConceptId: string | null;
  token: string;
  tenantSlug: string;
  onSelect?: (code: string, display: string) => void;
  className?: string;
}

const Icd10Suggestions: React.FC<Icd10SuggestionsProps> = ({
  snomedConceptId,
  token,
  tenantSlug,
  onSelect,
  className = '',
}) => {
  const [mappings, setMappings] = useState<Icd10Mapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!snomedConceptId || !token || !tenantSlug) {
      setMappings([]);
      setError(null);
      return;
    }

    const fetchMappings = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await terminologyApi.getIcd10Mappings(
          snomedConceptId,
          token,
          tenantSlug,
          { primaryOnly: false, includeInactive: false, limit: 10 }
        );
        setMappings(response.data || []);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError('ICD-10 mapping tables not provisioned for this tenant');
        } else if (err?.response?.status === 400) {
          setError('Invalid SNOMED concept ID');
        } else {
          setError('Unable to fetch ICD-10 mappings');
        }
        setMappings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMappings();
  }, [snomedConceptId, token, tenantSlug]);

  if (!snomedConceptId) {
    return null;
  }

  const handleSelect = (mapping: Icd10Mapping) => {
    setSelectedCode(mapping.targetCode);
    if (onSelect) {
      onSelect(mapping.targetCode, mapping.targetDisplay);
    }
  };

  const getPriorityBadgeColor = (priority: number) => {
    if (priority === 1) return 'bg-green-100 text-green-800 border-green-300';
    if (priority === 2) return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  const getStatusBadge = (mapping: Icd10Mapping) => {
    if (mapping.mapStatus === 'APPROVED' || mapping.mapPriority === 1) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-300">
          Primary
        </span>
      );
    }
    if (mapping.mapStatus === 'PENDING') {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
          Pending
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700">
            ICD-10 Code Suggestions
          </span>
          {mappings.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
              {mappings.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="p-4 pt-0">
          {loading && (
            <div className="text-sm text-slate-600 py-4 text-center">
              Loading ICD-10 mappings...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Unable to load ICD-10 mappings</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && mappings.length === 0 && (
            <div className="text-sm text-slate-500 py-4 text-center">
              No ICD-10 mappings found for this SNOMED concept
            </div>
          )}

          {!loading && !error && mappings.length > 0 && (
            <div className="space-y-2">
              {mappings.map((mapping, idx) => (
                <button
                  key={`${mapping.targetCode}-${idx}`}
                  onClick={() => handleSelect(mapping)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedCode === mapping.targetCode
                      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-semibold text-indigo-700">
                          {mapping.targetCode}
                        </code>
                        {getStatusBadge(mapping)}
                        {mapping.mapPriority > 1 && (
                          <span
                            className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getPriorityBadgeColor(
                              mapping.mapPriority
                            )}`}
                          >
                            Priority {mapping.mapPriority}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-2">
                        {mapping.targetDisplay}
                      </p>
                      {mapping.mapAdvice && (
                        <p className="text-xs text-slate-500 mt-1 italic">
                          {mapping.mapAdvice}
                        </p>
                      )}
                    </div>
                    {selectedCode === mapping.targetCode && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
              <p className="text-xs text-slate-500 mt-2 px-2">
                <strong>Note:</strong> ICD-10 mappings are provided for reference. Verify codes against current coding guidelines.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Icd10Suggestions;

