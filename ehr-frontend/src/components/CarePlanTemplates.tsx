import React, { useState, useEffect } from 'react';
import { X, FileText, Target, Activity, Plus, Search } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  condition_code?: string;
  condition_name?: string;
  template_data: any;
  is_default: boolean;
  usage_count: number;
}

interface CarePlanTemplatesProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onTemplateApplied?: () => void;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'chronic_disease', label: 'Chronic Disease' },
  { value: 'post_surgery', label: 'Post-Surgery' },
  { value: 'preventive_care', label: 'Preventive Care' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'geriatric', label: 'Geriatric' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'palliative', label: 'Palliative' },
  { value: 'general', label: 'General' },
];

const CarePlanTemplates: React.FC<CarePlanTemplatesProps> = ({
  patientId,
  tenantSlug,
  token,
  onClose,
  onTemplateApplied,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getCarePlanTemplates(selectedCategory || null, token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      showError('Error', 'Failed to load care plan templates');
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    if (!searchTerm) {
      setFilteredTemplates(templates);
      return;
    }

    const filtered = templates.filter(
      (template) =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.condition_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTemplates(filtered);
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      await ehrApi.applyCarePlanTemplate(
        templateId,
        patientId,
        {
          startDate: new Date().toISOString().split('T')[0],
        },
        token,
        tenantSlug
      );
      showSuccess('Success', 'Care plan created from template');
      if (onTemplateApplied) onTemplateApplied();
      onClose();
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to apply template');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <FileText className="w-6 h-6" />
              Care Plan Templates
            </h2>
            <p className="text-teal-100 text-sm mt-1">Choose a template to create a structured care plan</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-lg font-medium">No templates found</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-800 mb-1">{template.name}</h3>
                      <p className="text-sm text-slate-600 mb-2">{template.description}</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                          {template.category.replace(/_/g, ' ')}
                        </span>
                        {template.is_default && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            Default
                          </span>
                        )}
                        {template.condition_name && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            {template.condition_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedTemplate?.id === template.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Target className="w-4 h-4 text-teal-600" />
                          <span>{template.template_data?.goals?.length || 0} Goals</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Activity className="w-4 h-4 text-cyan-600" />
                          <span>{template.template_data?.interventions?.length || 0} Interventions</span>
                        </div>
                      </div>

                      {template.template_data?.goals && template.template_data.goals.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-slate-700 mb-2">Goals:</p>
                          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                            {template.template_data.goals.slice(0, 3).map((goal: any, idx: number) => (
                              <li key={idx}>{goal.goalText}</li>
                            ))}
                            {template.template_data.goals.length > 3 && (
                              <li className="text-slate-400">+{template.template_data.goals.length - 3} more...</li>
                            )}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyTemplate(template.id);
                        }}
                        className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 mt-4"
                      >
                        <Plus className="w-4 h-4" />
                        Apply Template
                      </button>
                    </div>
                  )}

                  {!selectedTemplate && (
                    <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
                      <span>Used {template.usage_count} times</span>
                      <span className="text-teal-600">Click to preview</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarePlanTemplates;
