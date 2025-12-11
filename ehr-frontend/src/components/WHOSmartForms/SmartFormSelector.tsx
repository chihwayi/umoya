/**
 * Smart Form Selector Component
 * 
 * Allows users to select and load WHO Smart Forms
 */

import React, { useState, useEffect } from 'react';
import { whoSmartGuidelinesService, GuidelineInfo } from '../../services/who-smart-guidelines.service';
import { FHIRQuestionnaireForm } from './FHIRQuestionnaireForm';
import { SmartForm } from '../../services/who-smart-guidelines.service';

interface SmartFormSelectorProps {
  token: string;
  tenantSlug: string;
  onFormSubmit?: (formId: string, answers: Record<string, any>) => void;
  onFormCancel?: () => void;
  selectedFormId?: string;
}

export const SmartFormSelector: React.FC<SmartFormSelectorProps> = ({
  token,
  tenantSlug,
  onFormSubmit,
  onFormCancel,
  selectedFormId,
}) => {
  const [forms, setForms] = useState<GuidelineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<SmartForm | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
  }, []);

  useEffect(() => {
    if (selectedFormId) {
      loadForm(selectedFormId);
    }
  }, [selectedFormId]);

  const loadForms = async () => {
    try {
      setLoading(true);
      setError(null);
      const availableForms = await whoSmartGuidelinesService.listSmartForms(token, tenantSlug);
      setForms(availableForms);
    } catch (err: any) {
      setError(`Failed to load Smart Forms: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadForm = async (formId: string) => {
    try {
      setLoadingForm(true);
      setError(null);
      const form = await whoSmartGuidelinesService.getSmartForm(formId, token, tenantSlug);
      if (form) {
        setSelectedForm(form);
      } else {
        setError(`Smart Form "${formId}" not found`);
      }
    } catch (err: any) {
      setError(`Failed to load Smart Form: ${err.message}`);
    } finally {
      setLoadingForm(false);
    }
  };

  const handleFormSubmit = (answers: Record<string, any>) => {
    if (selectedForm && onFormSubmit) {
      onFormSubmit(selectedForm.id, answers);
    }
  };

  const handleFormCancel = () => {
    setSelectedForm(null);
    if (onFormCancel) {
      onFormCancel();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-slate-600">Loading Smart Forms...</span>
      </div>
    );
  }

  if (error && !selectedForm) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadForms}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (selectedForm) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handleFormCancel}
            className="text-sm text-slate-600 hover:text-slate-800 flex items-center"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Forms
          </button>
        </div>
        {loadingForm ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-slate-600">Loading form...</span>
          </div>
        ) : (
          <FHIRQuestionnaireForm
            form={selectedForm}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        )}
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <p className="text-blue-800 mb-2">No Smart Forms available</p>
        <p className="text-sm text-blue-600">
          Contact SMART_DAKS@who.int to get WHO Smart Guidelines FHIR resources
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4">WHO Smart Forms</h2>
      <p className="text-sm text-slate-600 mb-6">
        Select a Smart Form to fill out. These forms are based on WHO Smart Guidelines.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forms.map((form) => (
          <button
            key={form.id}
            onClick={() => loadForm(form.id)}
            className="text-left p-4 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            <h3 className="font-semibold text-slate-900 mb-1">{form.title}</h3>
            {form.description && (
              <p className="text-sm text-slate-600 line-clamp-2">{form.description}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
