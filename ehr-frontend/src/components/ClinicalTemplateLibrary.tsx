import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, X, Loader2, FileText } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { clinicalTemplateApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type ClinicalTemplate = {
  id: string;
  name: string;
  category?: string;
  specialty?: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  updatedAt?: string;
};

interface ClinicalTemplateLibraryProps {
  open: boolean;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSelect: (template: ClinicalTemplate) => void | Promise<void>;
}

const ClinicalTemplateLibrary: React.FC<ClinicalTemplateLibraryProps> = ({
  open,
  tenantSlug,
  token,
  onClose,
  onSelect,
}) => {
  const { showError } = useNotification();
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!token || !tenantSlug) {
      showError('Error', 'Tenant or authentication missing. Cannot load templates.');
      return;
    }

    const loadTemplates = async () => {
      try {
        setLoading(true);
        const { data } = await clinicalTemplateApi.getTemplates(token, tenantSlug);
        setTemplates(Array.isArray(data?.templates) ? data.templates : data || []);
      } catch (error: any) {
        console.error('Failed to load clinical templates:', error);
        showError('Error', error?.response?.data?.message || 'Failed to load clinical templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [open, token, tenantSlug, showError]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((tpl) => {
      if (tpl.category) set.add(tpl.category);
    });
    return Array.from(set).sort();
  }, [templates]);

  const specialties = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((tpl) => {
      if (tpl.specialty) set.add(tpl.specialty);
    });
    return Array.from(set).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesSearch =
        !search ||
        tpl.name.toLowerCase().includes(search.toLowerCase()) ||
        (tpl.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || tpl.category === categoryFilter;
      const matchesSpecialty = specialtyFilter === 'all' || tpl.specialty === specialtyFilter;
      return matchesSearch && matchesCategory && matchesSpecialty;
    });
  }, [templates, search, categoryFilter, specialtyFilter]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Clinical Template Library</h2>
              <p className="text-sm text-slate-500">
                Browse preset documentation templates and apply them to your note.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-slate-200 px-6 py-4 space-y-3 md:flex md:items-center md:gap-4 md:space-y-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Search templates by name or description..."
              />
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="border-b border-slate-200 px-6 py-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="all">All</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Specialty</label>
                <select
                  value={specialtyFilter}
                  onChange={(e) => setSpecialtyFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="all">All</option>
                  {specialties.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center text-slate-500">
                <FileText className="mb-2 h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium">No templates found.</p>
                <p className="text-xs">Try adjusting your filters or search term.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template)}
                    className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                        {template.category && (
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            {template.category}
                          </p>
                        )}
                      </div>
                      {template.isDefault && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                          Default
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="mt-2 line-clamp-3 text-xs text-slate-500">{template.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {template.specialty && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{template.specialty}</span>
                      )}
                      {template.isActive === false && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-600">Inactive</span>
                      )}
                      {template.updatedAt && (
                        <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-6 py-4 text-right">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ClinicalTemplateLibrary;



