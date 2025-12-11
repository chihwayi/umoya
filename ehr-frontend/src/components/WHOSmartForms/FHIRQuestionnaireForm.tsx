/**
 * FHIR Questionnaire Form Component
 * 
 * Renders WHO Smart Guidelines Questionnaires as dynamic forms
 */

import React, { useState, useEffect } from 'react';
import { SmartForm, FormItem } from '../../services/who-smart-guidelines.service';

interface FHIRQuestionnaireFormProps {
  form: SmartForm;
  onSubmit: (answers: Record<string, any>) => void;
  onCancel?: () => void;
  initialValues?: Record<string, any>;
  readOnly?: boolean;
}

interface FormState {
  answers: Record<string, any>;
  errors: Record<string, string>;
  visibleItems: Set<string>;
}

export const FHIRQuestionnaireForm: React.FC<FHIRQuestionnaireFormProps> = ({
  form,
  onSubmit,
  onCancel,
  initialValues = {},
  readOnly = false,
}) => {
  const [formState, setFormState] = useState<FormState>({
    answers: { ...initialValues },
    errors: {},
    visibleItems: new Set(),
  });

  // Initialize visible items based on enableWhen conditions
  useEffect(() => {
    const visible = new Set<string>();
    
    const checkVisibility = (items: FormItem[]) => {
      items.forEach((item) => {
        let isVisible = true;
        
        if (item.enableWhen && item.enableWhen.length > 0) {
          isVisible = item.enableWhen.every((condition) => {
            const answer = formState.answers[condition.question];
            return evaluateCondition(answer, condition.operator, condition.value);
          });
        }
        
        if (isVisible) {
          visible.add(item.linkId);
          if (item.items) {
            checkVisibility(item.items);
          }
        }
      });
    };
    
    checkVisibility(form.items);
    setFormState((prev) => ({ ...prev, visibleItems: visible }));
  }, [form.items, formState.answers]);

  const evaluateCondition = (
    answer: any,
    operator: string,
    expectedValue: any
  ): boolean => {
    switch (operator) {
      case '=':
        return answer === expectedValue || String(answer) === String(expectedValue);
      case '!=':
        return answer !== expectedValue && String(answer) !== String(expectedValue);
      case '>':
        return Number(answer) > Number(expectedValue);
      case '<':
        return Number(answer) < Number(expectedValue);
      case '>=':
        return Number(answer) >= Number(expectedValue);
      case '<=':
        return Number(answer) <= Number(expectedValue);
      case 'exists':
        return answer !== undefined && answer !== null && answer !== '';
      default:
        return true;
    }
  };

  const handleChange = (linkId: string, value: any) => {
    setFormState((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [linkId]: value,
      },
      errors: {
        ...prev.errors,
        [linkId]: '', // Clear error on change
      },
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    const validateItem = (item: FormItem) => {
      if (!formState.visibleItems.has(item.linkId)) {
        return; // Skip hidden items
      }
      
      if (item.required && !formState.answers[item.linkId]) {
        errors[item.linkId] = `${item.text} is required`;
      }
      
      if (item.items) {
        item.items.forEach(validateItem);
      }
    };
    
    form.items.forEach(validateItem);
    
    setFormState((prev) => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    onSubmit(formState.answers);
  };

  const renderFormItem = (item: FormItem, depth: number = 0): React.ReactNode => {
    if (!formState.visibleItems.has(item.linkId)) {
      return null;
    }

    const hasError = !!formState.answers[item.linkId];
    const errorMessage = formState.errors[item.linkId];

    // Group item (section)
    if (item.type === 'group') {
      return (
        <div
          key={item.linkId}
          className={`mb-6 ${depth > 0 ? 'ml-6 border-l-2 border-indigo-200 pl-4' : ''}`}
        >
          <h3 className="text-lg font-semibold text-slate-800 mb-4">{item.text}</h3>
          {item.items && (
            <div className="space-y-4">
              {item.items.map((subItem) => renderFormItem(subItem, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Display item (text/info)
    if (item.type === 'display') {
      return (
        <div key={item.linkId} className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-slate-700">{item.text}</p>
        </div>
      );
    }

    // Question item
    return (
      <div key={item.linkId} className={`mb-4 ${depth > 0 ? 'ml-6' : ''}`}>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {item.text}
          {item.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {renderInput(item)}

        {errorMessage && (
          <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
        )}

        {item.items && (
          <div className="mt-4 space-y-4">
            {item.items.map((subItem) => renderFormItem(subItem, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderInput = (item: FormItem): React.ReactNode => {
    const value = formState.answers[item.linkId] || '';
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      handleChange(item.linkId, e.target.value);
    };

    switch (item.type) {
      case 'string':
      case 'url':
        return (
          <input
            type="text"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder={`Enter ${item.text.toLowerCase()}`}
          />
        );

      case 'text':
        return (
          <textarea
            value={value}
            onChange={onChange}
            disabled={readOnly}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder={`Enter ${item.text.toLowerCase()}`}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name={item.linkId}
                checked={value === true || value === 'true'}
                onChange={() => handleChange(item.linkId, true)}
                disabled={readOnly}
                className="mr-2"
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name={item.linkId}
                checked={value === false || value === 'false'}
                onChange={() => handleChange(item.linkId, false)}
                disabled={readOnly}
                className="mr-2"
              />
              <span>No</span>
            </label>
          </div>
        );

      case 'choice':
      case 'open-choice':
        return (
          <select
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
          >
            <option value="">Select an option</option>
            {item.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        );

      case 'dateTime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        );

      case 'integer':
        return (
          <input
            type="number"
            step="1"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder="Enter a number"
          />
        );

      case 'decimal':
        return (
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder="Enter a decimal number"
          />
        );

      case 'quantity':
        return (
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={value?.value || ''}
              onChange={(e) =>
                handleChange(item.linkId, {
                  ...value,
                  value: e.target.value,
                })
              }
              disabled={readOnly}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              placeholder="Value"
            />
            <input
              type="text"
              value={value?.unit || ''}
              onChange={(e) =>
                handleChange(item.linkId, {
                  ...value,
                  unit: e.target.value,
                })
              }
              disabled={readOnly}
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              placeholder="Unit"
            />
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
            placeholder={`Enter ${item.text.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{form.title}</h2>
        {form.description && (
          <p className="mt-2 text-slate-600">{form.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {form.items.map((item) => renderFormItem(item))}

        {!readOnly && (
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Submit
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
