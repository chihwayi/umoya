import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';

export interface ICD10Code {
  code: string;
  description: string;
  category?: string;
}

// Common ED diagnoses - expandable list
const COMMON_ICD10_CODES: ICD10Code[] = [
  // Cardiovascular
  { code: 'I21.0', description: 'ST elevation myocardial infarction (STEMI)', category: 'Cardiovascular' },
  { code: 'I21.4', description: 'Non-ST elevation myocardial infarction (NSTEMI)', category: 'Cardiovascular' },
  { code: 'I20.0', description: 'Unstable angina', category: 'Cardiovascular' },
  { code: 'I46.9', description: 'Cardiac arrest', category: 'Cardiovascular' },
  { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular' },
  
  // Respiratory
  { code: 'J18.9', description: 'Pneumonia, unspecified', category: 'Respiratory' },
  { code: 'J44.1', description: 'COPD with exacerbation', category: 'Respiratory' },
  { code: 'J45.901', description: 'Asthma exacerbation', category: 'Respiratory' },
  { code: 'J96.00', description: 'Acute respiratory failure', category: 'Respiratory' },
  { code: 'R06.02', description: 'Shortness of breath', category: 'Respiratory' },
  
  // Neurological
  { code: 'I63.9', description: 'Cerebral infarction (stroke)', category: 'Neurological' },
  { code: 'I61.9', description: 'Intracerebral hemorrhage', category: 'Neurological' },
  { code: 'G40.909', description: 'Seizure, unspecified', category: 'Neurological' },
  { code: 'R55', description: 'Syncope and collapse', category: 'Neurological' },
  { code: 'R51', description: 'Headache', category: 'Neurological' },
  
  // Gastrointestinal
  { code: 'K92.2', description: 'Gastrointestinal hemorrhage', category: 'Gastrointestinal' },
  { code: 'K35.80', description: 'Acute appendicitis', category: 'Gastrointestinal' },
  { code: 'K85.9', description: 'Acute pancreatitis', category: 'Gastrointestinal' },
  { code: 'A09', description: 'Gastroenteritis', category: 'Gastrointestinal' },
  { code: 'R10.9', description: 'Abdominal pain, unspecified', category: 'Gastrointestinal' },
  
  // Trauma
  { code: 'S06.0X0A', description: 'Concussion, initial encounter', category: 'Trauma' },
  { code: 'S42.001A', description: 'Fracture of clavicle, initial encounter', category: 'Trauma' },
  { code: 'S82.001A', description: 'Fracture of tibia, initial encounter', category: 'Trauma' },
  { code: 'S72.001A', description: 'Fracture of femur, initial encounter', category: 'Trauma' },
  { code: 'T14.90', description: 'Injury, unspecified', category: 'Trauma' },
  
  // Infectious Disease
  { code: 'A41.9', description: 'Sepsis, unspecified', category: 'Infectious' },
  { code: 'J02.9', description: 'Acute pharyngitis', category: 'Infectious' },
  { code: 'N39.0', description: 'Urinary tract infection', category: 'Infectious' },
  { code: 'L03.90', description: 'Cellulitis, unspecified', category: 'Infectious' },
  
  // Other Common
  { code: 'R07.9', description: 'Chest pain, unspecified', category: 'Symptoms' },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'Symptoms' },
  { code: 'R11.0', description: 'Nausea', category: 'Symptoms' },
  { code: 'R11.10', description: 'Vomiting, unspecified', category: 'Symptoms' },
  { code: 'R42', description: 'Dizziness', category: 'Symptoms' },
  { code: 'E11.65', description: 'Type 2 diabetes with hyperglycemia', category: 'Endocrine' },
  { code: 'N17.9', description: 'Acute renal failure', category: 'Renal' },
];

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

  const filteredCodes = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const term = searchTerm.toLowerCase();
    return COMMON_ICD10_CODES.filter(
      (icd) =>
        icd.code.toLowerCase().includes(term) ||
        icd.description.toLowerCase().includes(term) ||
        icd.category?.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [searchTerm]);

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
            {filteredCodes.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {searchTerm.length < 2 ? 'Type at least 2 characters to search' : 'No ICD-10 codes found. Try different keywords.'}
              </div>
            ) : (
              <ul className="max-h-64 overflow-y-auto py-1">
                {filteredCodes.map((icd, index) => (
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
                          {icd.category && (
                            <span className="text-xs text-slate-500">{icd.category}</span>
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

