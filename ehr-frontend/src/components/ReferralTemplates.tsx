import React, { useState, useEffect } from 'react';
import { FileText, X, CheckCircle } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface ReferralTemplatesProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onTemplateApplied: (referralId: string) => void;
}

const ReferralTemplates: React.FC<ReferralTemplatesProps> = ({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
  onTemplateApplied,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getReferralTemplates({}, token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error: any) {
      showError('Error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      setApplying(templateId);
      const response = await ehrApi.applyReferralTemplate(templateId, patientId, {}, token, tenantSlug);
      showSuccess('Success', 'Template applied! Referral created as draft.');
      onTemplateApplied(response.data.id);
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to apply template');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <FileText className="w-6 h-6" />
                Referral Templates
              </h2>
              <p className="text-blue-100 text-sm mt-1">Choose a template for {patientName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-lg font-medium">No templates available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => {
                const templateData = typeof template.template_data === 'string'
                  ? JSON.parse(template.template_data)
                  : template.template_data;

                return (
                  <div
                    key={template.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-1">{template.name}</h3>
                        {template.specialty && (
                          <p className="text-sm text-slate-600">{template.specialty}</p>
                        )}
                      </div>
                      {template.is_default && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mb-4 space-y-1">
                      <p><span className="font-medium">Type:</span> {template.referral_type}</p>
                      {templateData.priority && (
                        <p><span className="font-medium">Priority:</span> {templateData.priority}</p>
                      )}
                      {templateData.reason && (
                        <p className="text-xs mt-2 text-slate-500">{templateData.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleApplyTemplate(template.id)}
                      disabled={applying === template.id}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {applying === template.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Applying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Use Template
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralTemplates;


import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface ReferralTemplatesProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onTemplateApplied: (referralId: string) => void;
}

const ReferralTemplates: React.FC<ReferralTemplatesProps> = ({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
  onTemplateApplied,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getReferralTemplates({}, token, tenantSlug);
      setTemplates(response.data || []);
    } catch (error: any) {
      showError('Error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      setApplying(templateId);
      const response = await ehrApi.applyReferralTemplate(templateId, patientId, {}, token, tenantSlug);
      showSuccess('Success', 'Template applied! Referral created as draft.');
      onTemplateApplied(response.data.id);
    } catch (error: any) {
      showError('Error', error.response?.data?.message || 'Failed to apply template');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <FileText className="w-6 h-6" />
                Referral Templates
              </h2>
              <p className="text-blue-100 text-sm mt-1">Choose a template for {patientName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-lg font-medium">No templates available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => {
                const templateData = typeof template.template_data === 'string'
                  ? JSON.parse(template.template_data)
                  : template.template_data;

                return (
                  <div
                    key={template.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-1">{template.name}</h3>
                        {template.specialty && (
                          <p className="text-sm text-slate-600">{template.specialty}</p>
                        )}
                      </div>
                      {template.is_default && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mb-4 space-y-1">
                      <p><span className="font-medium">Type:</span> {template.referral_type}</p>
                      {templateData.priority && (
                        <p><span className="font-medium">Priority:</span> {templateData.priority}</p>
                      )}
                      {templateData.reason && (
                        <p className="text-xs mt-2 text-slate-500">{templateData.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleApplyTemplate(template.id)}
                      disabled={applying === template.id}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {applying === template.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Applying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Use Template
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralTemplates;

