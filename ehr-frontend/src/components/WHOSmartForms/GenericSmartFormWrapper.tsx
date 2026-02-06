/**
 * Generic WHO Smart Form Wrapper
 * 
 * A reusable component that can integrate any WHO Smart Form into any module
 */

import React, { useState } from 'react';
import { FileText, X, Loader2, CheckCircle } from 'lucide-react';
import { FHIRQuestionnaireForm } from './FHIRQuestionnaireForm';
import { whoSmartGuidelinesService, SmartForm } from '../../services/who-smart-guidelines.service';
import { useNotification } from '../GlobalNotification';

interface GenericSmartFormWrapperProps {
  formId: string;
  patientId?: string;
  token: string;
  tenantSlug: string;
  onClose?: () => void;
  onSuccess: (formData: Record<string, any>) => void;
  title?: string;
  description?: string;
  initialValues?: Record<string, any>;
  showAsModal?: boolean;
}

export const GenericSmartFormWrapper: React.FC<GenericSmartFormWrapperProps> = ({
  formId,
  patientId,
  token,
  tenantSlug,
  onClose,
  onSuccess,
  title,
  description,
  initialValues = {},
  showAsModal = true,
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SmartForm | null>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const formData = await whoSmartGuidelinesService.getSmartForm(formId, token, tenantSlug);
      if (formData) {
        setForm(formData);
      } else {
        showError('Error', `WHO Smart Form "${formId}" not found`);
        if (onClose) onClose();
      }
    } catch (error: any) {
      console.error('Error loading WHO Smart Form:', error);
      showError('Error', `Failed to load WHO Smart Form: ${error.message || 'Unknown error'}`);
      if (onClose) onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (answers: Record<string, any>) => {
    try {
      setSubmitting(true);
      
      // Add metadata
      const formData = {
        ...answers,
        _metadata: {
          formId,
          patientId,
          submittedAt: new Date().toISOString(),
          source: 'who_smart_guidelines',
        },
      };

      // Call success callback with form data
      onSuccess(formData);
      
      showSuccess('Success', 'WHO Smart Form submitted successfully');
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Error submitting WHO Smart Form:', error);
      showError('Error', `Failed to submit form: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-6 glass-card rounded-2xl p-8">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-200 rounded-full"></div>
          </div>
          <p className="text-slate-700 font-medium">Loading WHO Smart Form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  const formContent = (
    <div className="space-y-4">
      {(title || form.title) && (
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-900">
            {title || form.title}
          </h2>
          {(description || form.description) && (
            <p className="text-sm text-slate-600 mt-1">{description || form.description}</p>
          )}
        </div>
      )}

      <FHIRQuestionnaireForm
        form={form}
        onSubmit={handleSubmit}
        onCancel={onClose}
        initialValues={initialValues}
      />
    </div>
  );

  if (showAsModal) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
        <div className="glass-modal rounded-3xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b border-white/20 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {title || form.title}
                </h2>
                {(description || form.description) && (
                  <p className="text-sm text-slate-600 mt-1">{description || form.description}</p>
                )}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="glass-button-secondary p-3 rounded-xl transition-all hover:scale-110"
                disabled={submitting}
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            )}
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
            <FHIRQuestionnaireForm
              form={form}
              onSubmit={handleSubmit}
              onCancel={onClose}
              initialValues={initialValues}
            />
          </div>

          {/* Footer Info */}
          <div className="px-8 py-4 glass-gradient border-t border-white/20">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium">WHO Smart Guidelines Form</span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-mono text-slate-500">{form.fhirResourceId}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return formContent;
};


