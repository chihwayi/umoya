import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { terminologyApi } from '../services/api';

export interface ICD10Code {
  code: string;
  description: string;
  category?: string;
  category_description?: string;
  billable?: boolean;
}

interface ICD10PickerProps {
  value: string;
  onChange: (code: string, description: string) => void;
  token: string;
  tenantSlug: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
}

const ICD10Picker: React.FC<ICD10PickerProps> = ({
  value,
  onChange,
  token,
  tenantSlug,
  label,
  placeholder = 'Search ICD-10 codes...',
  helperText,
  required = false,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(value || '');
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ICD10Code[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Search ICD-10 codes via API
  useEffect(() => {
    const searchIcd10 = async () => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await terminologyApi.searchIcd10(searchTerm, token, tenantSlug, {
          limit: 20,
          billableOnly: true, // Only show billable codes
        });
        setSearchResults(response.data.codes || []);
      } catch (error) {
        console.error('Failed to search ICD-10 codes:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchIcd10, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, token, tenantSlug]);

  const handleSelect = (icd: ICD10Code) => {
    onChange(icd.code, icd.description);
    setSearchTerm(icd.code);
    setOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    onChange('', '');
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-200 transition">
          <Search className="mr-2 h-4 w-4 text-slate-400" />
          <input
            className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 focus:outline-none focus:ring-0"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
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

        {/* Dropdown */}
        {open && !disabled && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
            {isSearching ? (
              <div className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching ICD-10 codes...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {searchTerm.length < 2 ? 'Type at least 2 characters to search' : 'No ICD-10 codes found. Try different keywords.'}
              </div>
            ) : (
              <ul className="max-h-64 overflow-y-auto py-1">
                {searchResults.map((icd, index) => (
                  <li
                    key={`${icd.code}-${index}`}
                    className="cursor-pointer px-4 py-2 text-sm hover:bg-red-50 transition"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelect(icd);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">{icd.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            {icd.code}
                          </span>
                          {icd.category_description && (
                            <span className="text-xs text-slate-500">{icd.category_description}</span>
                          )}
                          {icd.billable && (
                            <span className="text-xs text-green-600 font-semibold">✓ Billable</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
      {required && !value && (
        <p className="mt-1 text-xs text-rose-600">ICD-10 code is required for billing.</p>
      )}
    </div>
  );
};

export default ICD10Picker;


