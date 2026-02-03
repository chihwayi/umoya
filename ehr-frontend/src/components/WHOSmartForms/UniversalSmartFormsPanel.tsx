/**
 * Universal WHO Smart Forms Panel
 * 
 * A comprehensive panel that can be integrated into ANY module/dashboard
 * Provides access to all available WHO Smart Forms with filtering and search
 */

import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, Activity, TestTube, User, Stethoscope, Baby, Heart, X, ChevronRight, CheckCircle } from 'lucide-react';
import { GenericSmartFormWrapper } from './GenericSmartFormWrapper';
import { whoSmartGuidelinesService, SmartForm as SmartFormType } from '../../services/who-smart-guidelines.service';
import { useNotification } from '../GlobalNotification';

interface UniversalSmartFormsPanelProps {
  patientId?: string;
  patientName?: string;
  token: string;
  tenantSlug: string;
  onFormSubmit?: (formId: string, formData: Record<string, any>) => void;
  onClose?: () => void;
  moduleFilter?: 'hiv' | 'tb' | 'maternity' | 'clinical' | 'all';
  showAsModal?: boolean;
}

type FormCategory = 'testing' | 'registration' | 'care' | 'maternity' | 'history' | 'screening' | 'treatment' | 'referral' | 'other';

const FORM_CATEGORIES: Record<string, FormCategory> = {
  'B1': 'history',
  'B6': 'history',
  'B7': 'testing',
  'B8': 'care',
  'A2': 'registration',
  'A5': 'registration',
  'D1': 'history',
  'D2': 'care',
  'D3': 'care',
  'D4': 'screening',
  'D8': 'history',
  'D10': 'care',
  'D15': 'care',
  'E1': 'maternity',
  'E4': 'testing',
  'F2': 'care',
  'F3': 'history',
  'F6': 'screening',
  'F8': 'testing',
  'F16': 'treatment',
  'F20': 'care',
  'H1': 'care',
  'H2': 'care',
  'I1': 'referral',
  'I6': 'referral',
};

const getFormCategory = (formId: string): FormCategory => {
  const match = formId.match(/\.([A-Z]\d+)/);
  if (match) {
    const code = match[1];
    return FORM_CATEGORIES[code] || 'other';
  }
  return 'other';
};

const getCategoryIcon = (category: FormCategory) => {
  switch (category) {
    case 'testing': return TestTube;
    case 'registration': return User;
    case 'care': return Stethoscope;
    case 'maternity': return Baby;
    case 'history': return FileText;
    case 'screening': return Activity;
    case 'treatment': return Heart;
    case 'referral': return ChevronRight;
    default: return FileText;
  }
};

const getCategoryColor = (category: FormCategory) => {
  switch (category) {
    case 'testing': return 'from-blue-500 to-cyan-500';
    case 'registration': return 'from-green-500 to-emerald-500';
    case 'care': return 'from-purple-500 to-indigo-500';
    case 'maternity': return 'from-pink-500 to-rose-500';
    case 'history': return 'from-slate-500 to-gray-500';
    case 'screening': return 'from-amber-500 to-orange-500';
    case 'treatment': return 'from-red-500 to-pink-500';
    case 'referral': return 'from-violet-500 to-purple-500';
    default: return 'from-gray-500 to-slate-500';
  }
};

export const UniversalSmartFormsPanel: React.FC<UniversalSmartFormsPanelProps> = ({
  patientId,
  patientName,
  token,
  tenantSlug,
  onFormSubmit,
  onClose,
  moduleFilter = 'all',
  showAsModal = false,
}) => {
  const { showSuccess, showError } = useNotification();
  const [forms, setForms] = useState<SmartFormType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FormCategory | 'all'>('all');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Set<FormCategory>>(new Set());

  useEffect(() => {
    loadForms();
  }, [token, tenantSlug]);

  const loadForms = async () => {
    try {
      setLoading(true);
      const formsList = await whoSmartGuidelinesService.listSmartForms(token, tenantSlug);
      
      // Filter by module if specified
      let filteredForms = formsList;
      if (moduleFilter !== 'all') {
        filteredForms = formsList.filter(form => {
          const formId = form.id.toLowerCase();
          if (moduleFilter === 'hiv') {
            // All HIV-related forms
            return formId.includes('hiv');
          }
          if (moduleFilter === 'tb') {
            // TB screening forms
            return formId.includes('tb') || formId.includes('d4');
          }
          if (moduleFilter === 'maternity') {
            // Maternity/PMTCT forms (E* and F* series)
            return formId.match(/\.(e|f)\d/i) !== null;
          }
          if (moduleFilter === 'clinical') {
            // General clinical forms useful for all specialties:
            // - D1, D8: History taking
            // - D2: Vital signs (universal)
            // - D14: Comorbidities & coinfections (diabetes, hypertension, etc.)
            // - D16: Other screenings (general health)
            // - D19: Vaccines (universal)
            // - D20: Diagnostics (lab orders, imaging)
            // - D21: Treatment options
            // - D23: Prescriptions
            // - D24: Counseling
            // - D26: Sexual & reproductive health
            // - D28: Other services
            // - D29: Follow-up scheduling
            // - C1, C3: Care visit reason and history
            return formId.match(/\.(d1|d2|d8|d14|d16|d19|d20|d21|d23|d24|d26|d28|d29|c1|c3)/i) !== null;
          }
          return true;
        });
      }
      
      setForms(filteredForms);
      
      // Extract categories
      const cats = new Set<FormCategory>();
      filteredForms.forEach(form => {
        const cat = getFormCategory(form.id);
        cats.add(cat);
      });
      setCategories(cats);
    } catch (error: any) {
      console.error('Error loading Smart Forms:', error);
      showError(`Failed to load forms: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
  };

  const handleFormSuccess = (formData: Record<string, any>) => {
    if (onFormSubmit && selectedFormId) {
      onFormSubmit(selectedFormId, formData);
    }
    setSelectedFormId(null);
    if (onClose) {
      onClose();
    }
  };

  const filteredForms = forms.filter(form => {
    const matchesSearch = !searchTerm || 
      form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || getFormCategory(form.id) === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  if (selectedFormId) {
    const selectedForm = forms.find(f => f.id === selectedFormId);
    return (
      <GenericSmartFormWrapper
        formId={selectedFormId}
        patientId={patientId}
        token={token}
        tenantSlug={tenantSlug}
        onClose={() => setSelectedFormId(null)}
        onSuccess={handleFormSuccess}
        title={selectedForm?.title}
        description={selectedForm?.description}
        showAsModal={showAsModal}
      />
    );
  }

  const panelContent = (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Activity className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">WHO Smart Forms</h3>
            <p className="text-sm text-slate-600">
              {forms.length} form{forms.length !== 1 ? 's' : ''} available
              {patientName && ` • ${patientName}`}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({forms.length})
          </button>
          {Array.from(categories).map(category => {
            const Icon = getCategoryIcon(category);
            const count = forms.filter(f => getFormCategory(f.id) === category).length;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Forms List */}
      {loading ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-indigo-400 mx-auto animate-spin mb-4" />
          <p className="text-slate-600">Loading WHO Smart Forms...</p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">No forms found</p>
          <p className="text-sm text-slate-500 mt-1">
            {searchTerm ? 'Try a different search term' : 'No forms available for this module'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          {filteredForms.map(form => {
            const category = getFormCategory(form.id);
            const Icon = getCategoryIcon(category);
            const colorClass = getCategoryColor(category);
            
            return (
              <button
                key={form.id}
                onClick={() => handleFormSelect(form.id)}
                className="text-left p-4 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 text-${category === 'testing' ? 'blue' : category === 'care' ? 'purple' : 'indigo'}-600`} />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700 mb-1">
                  {form.title}
                </h4>
                {form.description && (
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                    {form.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                    {form.id}
                  </span>
                  <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded capitalize">
                    {category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (showAsModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
          <div className="p-6 border-b border-slate-200">
            {panelContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
      {panelContent}
    </div>
  );
};


