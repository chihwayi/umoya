import React, { useEffect, useMemo, useRef, useState } from 'react';
import { terminologyApi } from '../services/api';
import { Search, Loader2, X } from 'lucide-react';

export interface SnomedConcept {
  conceptId: string;
  term: string;
  preferredTerm?: string;
  fullySpecifiedName?: string;
  moduleId?: string;
  definitionStatus?: string;
  semanticTag?: string;
}

export type SnomedSearchContext =
  | 'condition'
  | 'symptom'
  | 'encounter'
  | 'procedure'
  | 'medication'
  | 'substance'
  | 'specimen'
  | 'observable'
  | 'organism'
  | 'situation'
  | 'anatomy'
  | 'finding';

const CONTEXT_CONFIG: Record<
  SnomedSearchContext,
  { semanticTags?: string[]; ecl?: string }
> = {
  condition: { ecl: '<< 404684003' }, // Clinical finding
  symptom: { ecl: '<< 404684003' },
  encounter: { ecl: '<< 308335008' }, // Patient encounter/procedure
  procedure: { ecl: '<< 71388002' },
  medication: { ecl: '<< 763158003' }, // Medicinal product
  substance: { ecl: '<< 105590001' },
  specimen: { ecl: '<< 123038009' },
  observable: { ecl: '<< 363787002' },
  organism: { ecl: '<< 410607006' },
  situation: { ecl: '<< 243796009' },
  anatomy: { ecl: '<< 123037004' },
  finding: { ecl: '<< 404684003' },
};

interface SnomedConceptPickerProps {
  value: SnomedConcept | null;
  onChange: (concept: SnomedConcept | null) => void;
  token: string;
  tenantSlug: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  activeOnly?: boolean;
  required?: boolean;
  semanticTags?: string[];
  ecl?: string;
  context?: SnomedSearchContext;
}

const searchDelayMs = 300;

const SnomedConceptPicker: React.FC<SnomedConceptPickerProps> = ({
  value,
  onChange,
  token,
  tenantSlug,
  label,
  placeholder = 'Search SNOMED CT…',
  helperText,
  disabled,
  autoFocus,
  activeOnly = true,
  required = false,
  semanticTags,
  ecl,
  context,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(value?.term ?? '');
  const [results, setResults] = useState<SnomedConcept[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setSearchTerm(value?.term ?? '');
  }, [value?.conceptId, value?.term]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const effectiveSemanticTags = semanticTags ?? (context ? CONTEXT_CONFIG[context]?.semanticTags : undefined);
  const effectiveEcl = ecl ?? (context ? CONTEXT_CONFIG[context]?.ecl : undefined);

  const performSearch = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data } = await terminologyApi.searchSnomed(term, token, tenantSlug, {
        limit: 20,
        activeOnly,
        semanticTags: effectiveSemanticTags,
        ecl: effectiveEcl,
      });
      setResults(data.concepts || []);
      setHasSearched(true);
    } catch (err: any) {
      console.error('SNOMED search failed', err);
      setError(err?.response?.data?.message || 'SNOMED search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (disabled) {
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => performSearch(searchTerm), searchDelayMs);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, disabled, token, tenantSlug, activeOnly, effectiveSemanticTags, effectiveEcl]);

  const handleSelect = (concept: SnomedConcept) => {
    onChange(concept);
    setSearchTerm(concept.preferredTerm || concept.term);
    setOpen(false);
    setError(null);
  };

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    onChange(null);
    setHasSearched(false);
  };

  const resultList = useMemo(() => {
    if (!open || disabled) return null;

    return (
      <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching SNOMED…
          </div>
        ) : error ? (
          <div className="px-4 py-3 text-sm text-rose-600">{error}</div>
        ) : results.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-500">
            {hasSearched ? 'No concepts found. Try adjusting your search.' : 'Start typing to search SNOMED CT.'}
          </div>
        ) : (
          <ul className="max-h-56 overflow-y-auto py-1">
            {results.map((concept) => (
              <li
                key={concept.conceptId}
                className="cursor-pointer px-4 py-2 text-sm hover:bg-indigo-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(concept);
                }}
              >
                <div className="font-medium text-slate-900">{concept.preferredTerm || concept.term}</div>
                <div className="text-xs text-slate-500">
                  SNOMED {concept.conceptId}
                  {concept.definitionStatus ? ` • ${concept.definitionStatus.replace('_', ' ')}` : ''}
                </div>
                {concept.fullySpecifiedName && (
                  <div className="text-xs text-slate-400">{concept.fullySpecifiedName}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }, [open, disabled, loading, error, results, hasSearched]);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition">
          <Search className="mr-2 h-4 w-4 text-slate-400" />
          <input
            className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 focus:outline-none focus:ring-0"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              if (!hasSearched && searchTerm.trim().length >= 2) {
                performSearch(searchTerm);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
          />
          {value && !disabled && (
            <button
              type="button"
              className="ml-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {resultList}
      </div>

      {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
      {required && !value && (
        <p className="mt-1 text-xs text-rose-600">Please select a SNOMED CT concept.</p>
      )}
    </div>
  );
};

export default SnomedConceptPicker;





