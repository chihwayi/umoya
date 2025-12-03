import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, Eye, CheckCircle, XCircle, Globe } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ConsentPresentationModal from './ConsentPresentationModal';

interface ConsentLibraryProps {
  patientId: string;
  appointmentId: string;
  tenantSlug: string;
  token: string;
  onSelectTemplate: (templateId: string) => void;
  onClose?: () => void;
}

const ConsentLibrary: React.FC<ConsentLibraryProps> = ({
  patientId,
  appointmentId,
  tenantSlug,
  token,
  onSelectTemplate,
  onClose,
}) => {
  const { showError } = useNotification();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showPresentationModal, setShowPresentationModal] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [filterType, filterStatus]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterType !== 'all') params.consentType = filterType;
      if (filterStatus === 'active') params.isActive = true;
      
      const response = await ehrApi.getConsentTemplates(params, token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      showError('Error', 'Failed to load consent templates');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      template.templateName?.toLowerCase().includes(search) ||
      template.title?.toLowerCase().includes(search) ||
      template.templateCode?.toLowerCase().includes(search)
    );
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'treatment': return 'from-blue-500 to-cyan-600';
      case 'surgery': return 'from-red-500 to-pink-600';
      case 'procedure': return 'from-purple-500 to-indigo-600';
      case 'hipaa': return 'from-slate-600 to-slate-700';
      case 'telehealth': return 'from-green-500 to-emerald-600';
      case 'research': return 'from-orange-500 to-amber-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getTypeIcon = (type: string) => {
    return <FileText className="w-5 h-5 text-white" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading consent library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 sm:p-6 border border-indigo-200">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Consent Template Library</h2>
        <p className="text-sm text-slate-600">Select a consent template to present to patient</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Search */}
          <div className="relative sm:col-span-3 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none"
            >
              <option value="all">All Types</option>
              <option value="treatment">Treatment</option>
              <option value="surgery">Surgery</option>
              <option value="procedure">Procedure</option>
              <option value="hipaa">HIPAA</option>
              <option value="telehealth">Telehealth</option>
              <option value="research">Research</option>
              <option value="vaccine">Vaccine</option>
              <option value="anesthesia">Anesthesia</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-600">No templates found</p>
          <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => {
                setSelectedTemplate(template);
                setShowPresentationModal(true);
              }}
              className="relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group text-left"
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${getTypeColor(template.consentType)} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
              
              {/* Content */}
              <div className="relative p-4 sm:p-6">
                {/* Icon */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  {getTypeIcon(template.consentType)}
                </div>
                
                {/* Text */}
                <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 drop-shadow-sm line-clamp-2">
                  {template.templateName}
                </h3>
                <p className="text-xs sm:text-sm text-white/90 mb-3 line-clamp-2">
                  {template.title}
                </p>
                
                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                  <span className="px-2 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                    v{template.version}
                  </span>
                  {template.languageCode && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                      <Globe className="w-3 h-3" />
                      {template.languageCode.toUpperCase()}
                    </span>
                  )}
                  {template.isDefault && (
                    <span className="px-2 py-1 bg-white/30 rounded-full backdrop-blur-sm font-semibold">
                      DEFAULT
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
                  {template.isActive ? (
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-lg" />
                  ) : (
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white/50" />
                  )}
                </div>
              </div>
              
              {/* Shimmer Effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <span>
            Showing <strong className="text-slate-900">{filteredTemplates.length}</strong> of{' '}
            <strong className="text-slate-900">{templates.length}</strong> templates
          </span>
          {filterType !== 'all' && (
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium text-xs">
              {filterType}
            </span>
          )}
        </div>
      </div>
    </div>

      {/* Consent Presentation Modal */}
      {showPresentationModal && selectedTemplate && (
        <ConsentPresentationModal
          template={selectedTemplate}
          patientId={patientId}
          appointmentId={appointmentId}
          tenantSlug={tenantSlug}
          token={token}
          onSuccess={() => {
            setShowPresentationModal(false);
            setSelectedTemplate(null);
            onSelectTemplate(selectedTemplate.id);
          }}
          onClose={() => {
            setShowPresentationModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};

export default ConsentLibrary;

