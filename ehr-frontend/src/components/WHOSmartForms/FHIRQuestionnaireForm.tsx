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
          className={`mb-8 glass-section rounded-xl p-6 ${depth > 0 ? 'ml-6 border-l-2 border-indigo-300/50 pl-6' : ''}`}
        >
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
            {item.text}
          </h3>
          {item.items && (
            <div className="space-y-5 mt-4">
              {item.items.map((subItem) => renderFormItem(subItem, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Display item (text/info)
    if (item.type === 'display') {
      return (
        <div key={item.linkId} className="mb-5 glass-gradient rounded-xl p-5 border border-indigo-200/50">
          <p className="text-slate-700 leading-relaxed">{item.text}</p>
        </div>
      );
    }

    // Question item
    return (
      <div key={item.linkId} className={`mb-6 glass-section rounded-xl p-5 ${depth > 0 ? 'ml-6' : ''}`}>
        <label className="block text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span>{item.text}</span>
          {item.required && <span className="text-red-500 text-lg">*</span>}
        </label>

        {renderInput(item)}

        {errorMessage && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <span>⚠</span> {errorMessage}
          </p>
        )}

        {item.items && (
          <div className="mt-5 space-y-5">
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
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={`Enter ${item.text.toLowerCase()}`}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="radio"
                  name={item.linkId}
                  checked={value === true || value === 'true'}
                  onChange={() => handleChange(item.linkId, true)}
                  disabled={readOnly}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 transition-all ${
                  (value === true || value === 'true') 
                    ? 'border-indigo-500 bg-indigo-500' 
                    : 'border-slate-300 group-hover:border-indigo-400'
                } ${readOnly ? 'opacity-50' : ''}`}>
                  {(value === true || value === 'true') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-slate-700 font-medium">Yes</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="radio"
                  name={item.linkId}
                  checked={value === false || value === 'false'}
                  onChange={() => handleChange(item.linkId, false)}
                  disabled={readOnly}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 transition-all ${
                  (value === false || value === 'false') 
                    ? 'border-indigo-500 bg-indigo-500' 
                    : 'border-slate-300 group-hover:border-indigo-400'
                } ${readOnly ? 'opacity-50' : ''}`}>
                  {(value === false || value === 'false') && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-slate-700 font-medium">No</span>
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
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        );

      case 'dateTime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={onChange}
            disabled={readOnly}
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Enter a decimal number"
          />
        );

      case 'quantity':
        return (
          <div className="flex gap-3">
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
              className="glass-input flex-1 px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="glass-input w-28 px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="glass-input w-full px-4 py-3 rounded-xl text-slate-800 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={`Enter ${item.text.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="glass-card rounded-2xl p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
          {form.title}
        </h2>
        {form.description && (
          <p className="text-slate-600 text-lg leading-relaxed">{form.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {form.items.map((item) => renderFormItem(item))}

        {!readOnly && (
          <div className="flex justify-end gap-4 pt-6 mt-8 border-t border-slate-200/50">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="glass-button-secondary px-6 py-3 text-slate-700 rounded-xl font-medium"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="glass-button px-8 py-3 text-white rounded-xl font-semibold shadow-lg"
            >
              Submit Form
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
