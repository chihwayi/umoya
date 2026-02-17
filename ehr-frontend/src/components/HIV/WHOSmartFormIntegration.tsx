/**
 * WHO Smart Form Integration Component for HIV Module
 * 
 * Wrapper component that integrates WHO Smart Forms into HIV workflow
 * Handles form loading, submission, and data mapping
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, FileText, CheckCircle } from 'lucide-react';
import { FHIRQuestionnaireForm } from '../WHOSmartForms/FHIRQuestionnaireForm';
import { whoSmartGuidelinesService, SmartForm } from '../../services/who-smart-guidelines.service';
import { useNotification } from '../GlobalNotification';

interface WHOSmartFormIntegrationProps {
  formId: string;
  patientId: string;
  token: string;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: (formData: Record<string, any>) => void;
  title?: string;
  initialValues?: Record<string, any>;
}

export const WHOSmartFormIntegration: React.FC<WHOSmartFormIntegrationProps> = ({
  formId,
  patientId,
  token,
  tenantSlug,
  onClose,
  onSuccess,
  title,
  initialValues = {},
}) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SmartForm | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
        onClose();
      }
    } catch (error: any) {
      console.error('Error loading WHO Smart Form:', error);
      showError('Error', `Failed to load WHO Smart Form: ${error.message || 'Unknown error'}`);
      onClose();
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
      onClose();
    } catch (error: any) {
      console.error('Error submitting WHO Smart Form:', error);
      showError('Error', `Failed to submit form: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-slate-600">Loading WHO Smart Form...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {title || form.title}
              </h2>
              {form.description && (
                <p className="text-sm text-slate-600 mt-1">{form.description}</p>
              )}
              <button
                onClick={onClose}
                className="mt-2 inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900"
                disabled={submitting}
              >
                ← Back to regular form
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={submitting}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <FHIRQuestionnaireForm
            form={form}
            onSubmit={handleSubmit}
            onCancel={onClose}
            initialValues={initialValues}
          />
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>WHO Smart Guidelines Form - {form.fhirResourceId}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

