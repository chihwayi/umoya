import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Loader2, Plus, Search, Star, X } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { prescriptionTemplateApi } from '../services/api';
import { useNotification } from './GlobalNotification';

export interface PrescriptionTemplate {
  id: string;
  name: string;
  category: string;
  medicationName: string;
  genericName?: string | null;
  dosage: string;
  dosageUnit?: string | null;
  frequency: string;
  route?: string | null;
  duration?: string | null;
  instructions?: string | null;
  indications?: string | null;
  contraindications?: string | null;
  sideEffects?: string | null;
  specialty?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  usageCount?: number;
  updatedAt?: string;
}

const TEMPLATE_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'antibiotic', label: 'Antibiotic' },
  { value: 'pain_management', label: 'Pain Management' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'gastrointestinal', label: 'Gastrointestinal' },
  { value: 'cardiac', label: 'Cardiac' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'other', label: 'Other' },
];

interface PrescriptionTemplateLibraryProps {
  open: boolean;
  token: string;
  tenantSlug: string;
  onClose: () => void;
  onApplyTemplate: (template: PrescriptionTemplate) => void;
  onCreateTemplate?: () => void;
  onEditTemplate?: (template: PrescriptionTemplate) => void;
  refreshKey?: number;
}

const PrescriptionTemplateLibrary: React.FC<PrescriptionTemplateLibraryProps> = ({
  open,
  token,
  tenantSlug,
  onClose,
  onApplyTemplate,
  onCreateTemplate,
  onEditTemplate,
  refreshKey = 0,
}) => {
  const { showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [defaultsOnly, setDefaultsOnly] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PrescriptionTemplate | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (!showInactive && template.isActive === false) return false;
      if (defaultsOnly && !template.isDefault) return false;
      if (category && template.category !== category) return false;
      if (!debouncedSearch.trim()) return true;
      const haystack = [
        template.name,
        template.medicationName,
        template.genericName,
        template.instructions,
        template.specialty,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(debouncedSearch.toLowerCase());
    });
  }, [templates, debouncedSearch, category, showInactive, defaultsOnly]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!open) return;

    const loadTemplates = async () => {
      try {
        setLoading(true);
        const response = await prescriptionTemplateApi.getTemplates(token, tenantSlug, {
          category: category || undefined,
          isActive: showInactive ? undefined : true,
          isDefault: defaultsOnly ? true : undefined,
          search: debouncedSearch || undefined,
        });
        setTemplates(response.data || []);
      } catch (error) {
        console.error('Failed to load prescription templates', error);
        showError('Templates', 'Failed to load prescription templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [open, token, tenantSlug, category, showInactive, defaultsOnly, debouncedSearch, refreshKey, showError]);

  useEffect(() => {
    if (!selectedTemplate && filteredTemplates.length > 0) {
      setSelectedTemplate(filteredTemplates[0]);
    } else if (
      selectedTemplate &&
      !filteredTemplates.some((template) => template.id === selectedTemplate.id)
    ) {
      setSelectedTemplate(filteredTemplates[0] || null);
    }
  }, [filteredTemplates, selectedTemplate]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100001] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Prescription Template Library</h2>
              <p className="text-sm text-slate-500">
                Quickly apply curated medication plans or build new templates
              </p>
            </div>
            <div className="flex items-center gap-3">
              {onCreateTemplate && (
                <button
                  onClick={onCreateTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white text-sm font-semibold shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Template
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by medication, template name, specialty..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-pink-200 focus:border-pink-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-pink-200 focus:border-pink-400"
                >
                  <option value="">All Categories</option>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                  checked={defaultsOnly}
                  onChange={() => setDefaultsOnly((prev) => !prev)}
                />
                Defaults
              </label>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                  checked={showInactive}
                  onChange={() => setShowInactive((prev) => !prev)}
                />
                Show inactive
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
            <div className="border-r border-slate-100 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading templates...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="p-4 rounded-full bg-slate-100 mb-3">
                    <Search className="w-5 h-5 text-slate-500" />
                  </div>
                  <p className="text-slate-600 font-medium">No templates match your filters</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Try adjusting the search or create a new template
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTemplates.map((template) => {
                    const active = selectedTemplate?.id === template.id;
                    return (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`w-full text-left px-5 py-4 flex flex-col gap-2 transition ${
                          active ? 'bg-pink-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-700 px-3 py-1 rounded-full bg-white border border-slate-200">
                              {template.category.replace(/_/g, ' ')}
                            </span>
                            {template.isDefault && (
                              <span className="flex items-center gap-1 text-xs text-pink-600 font-semibold">
                                <Star className="w-4 h-4 fill-pink-100 stroke-pink-500" />
                                Default
                              </span>
                            )}
                            {!template.isActive && (
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-600">
                                Archived
                              </span>
                            )}
                          </div>
                          {template.usageCount ? (
                            <span className="text-xs text-slate-500">
                              {template.usageCount} uses
                            </span>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-900">{template.name}</p>
                          <p className="text-sm text-slate-500 line-clamp-1">
                            {template.medicationName} • {template.dosage} • {template.frequency}
                          </p>
                        </div>
                        {template.instructions && (
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {template.instructions}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 overflow-y-auto">
              {selectedTemplate ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Template
                      </p>
                      <h3 className="text-2xl font-bold text-slate-900">{selectedTemplate.name}</h3>
                      {selectedTemplate.specialty && (
                        <p className="text-sm text-slate-500 mt-1">
                          Specialty: <span className="font-medium text-slate-700">{selectedTemplate.specialty}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {onEditTemplate && (
                        <button
                          onClick={() => onEditTemplate(selectedTemplate)}
                          className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => onApplyTemplate(selectedTemplate)}
                        className="px-4 py-2 text-sm font-semibold text-white rounded-2xl bg-gradient-to-r from-pink-600 to-fuchsia-600 shadow-sm hover:shadow"
                      >
                        Apply Template
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4 text-sm text-slate-600 flex-1 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                        <p className="text-xs uppercase text-slate-500 font-semibold">Medication</p>
                        <p className="text-base font-semibold text-slate-900">
                          {selectedTemplate.medicationName}
                        </p>
                        {selectedTemplate.genericName && (
                          <p className="text-xs text-slate-500">Generic: {selectedTemplate.genericName}</p>
                        )}
                      </div>
                      <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                        <p className="text-xs uppercase text-slate-500 font-semibold">Dosage & Frequency</p>
                        <p className="text-base font-semibold text-slate-900">
                          {selectedTemplate.dosage}
                          {selectedTemplate.dosageUnit ? ` ${selectedTemplate.dosageUnit}` : ''} •{' '}
                          {selectedTemplate.frequency}
                        </p>
                        {selectedTemplate.duration && (
                          <p className="text-xs text-slate-500">Duration: {selectedTemplate.duration}</p>
                        )}
                        {selectedTemplate.route && (
                          <p className="text-xs text-slate-500 capitalize">Route: {selectedTemplate.route}</p>
                        )}
                      </div>
                    </div>

                    {selectedTemplate.instructions && (
                      <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-inner">
                        <p className="text-xs uppercase text-slate-500 font-semibold mb-2">Instructions</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{selectedTemplate.instructions}</p>
                      </div>
                    )}

                    {selectedTemplate.indications && (
                      <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-inner">
                        <p className="text-xs uppercase text-slate-500 font-semibold mb-2">Indications</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{selectedTemplate.indications}</p>
                      </div>
                    )}

                    {selectedTemplate.contraindications && (
                      <div className="p-4 rounded-2xl border border-orange-100 bg-orange-50">
                        <p className="text-xs uppercase text-orange-500 font-semibold mb-2">
                          Contraindications
                        </p>
                        <p className="text-orange-700 whitespace-pre-wrap">
                          {selectedTemplate.contraindications}
                        </p>
                      </div>
                    )}

                    {selectedTemplate.sideEffects && (
                      <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50">
                        <p className="text-xs uppercase text-amber-500 font-semibold mb-2">
                          Common Side Effects
                        </p>
                        <p className="text-amber-800 whitespace-pre-wrap">
                          {selectedTemplate.sideEffects}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500">
                  Select a template to preview its details
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default PrescriptionTemplateLibrary;

