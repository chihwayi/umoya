import React, { useState } from 'react';
import { X, Plus, Trash2, GripVertical, Save, Eye, FileText, Settings } from 'lucide-react';
import { useNotification } from './GlobalNotification';

interface Question {
  number: number;
  text: string;
  type: 'number' | 'text' | 'choice' | 'scale' | 'boolean';
  required: boolean;
  options?: Array<{ value: string | number; label: string }>;
  min?: number;
  max?: number;
  scoring?: {
    method: 'direct' | 'reverse' | 'weighted';
    weight?: number;
  };
}

interface QuestionnaireTemplate {
  code: string;
  name: string;
  description: string;
  category: string;
  version?: string;
  questions: Question[];
  scoring: {
    algorithm: 'sum' | 'average' | 'weighted' | 'custom';
    minScore: number;
    maxScore: number;
    thresholds?: Array<{
      label: string;
      min: number;
      max: number;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
}

interface QuestionnaireDesignerProps {
  onClose: () => void;
  onSave: (template: QuestionnaireTemplate) => void;
  initialTemplate?: QuestionnaireTemplate;
  tenantSlug: string;
  token: string;
}

const QuestionnaireDesigner: React.FC<QuestionnaireDesignerProps> = ({
  onClose,
  onSave,
  initialTemplate,
  tenantSlug,
  token,
}) => {
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState<'design' | 'preview'>('design');
  const [saving, setSaving] = useState(false);

  const [template, setTemplate] = useState<QuestionnaireTemplate>(
    initialTemplate || {
      code: '',
      name: '',
      description: '',
      category: 'general',
      version: '1.0',
      questions: [],
      scoring: {
        algorithm: 'sum',
        minScore: 0,
        maxScore: 100,
      },
    }
  );

  const categories = [
    'mental_health',
    'physical_health',
    'symptom_tracking',
    'quality_of_life',
    'disease_specific',
    'general',
  ];

  const questionTypes = [
    { value: 'scale', label: 'Scale (Multiple Choice)' },
    { value: 'choice', label: 'Single Choice' },
    { value: 'number', label: 'Number Input' },
    { value: 'text', label: 'Text Input' },
    { value: 'boolean', label: 'Yes/No' },
  ];

  const addQuestion = () => {
    const newQuestion: Question = {
      number: template.questions.length + 1,
      text: '',
      type: 'scale',
      required: true,
      options: [
        { value: 0, label: 'Option 1' },
        { value: 1, label: 'Option 2' },
      ],
      scoring: { method: 'direct' },
    };
    setTemplate({
      ...template,
      questions: [...template.questions, newQuestion],
    });
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...template.questions];
    updated[index] = { ...updated[index], ...updates };
    setTemplate({ ...template, questions: updated });
  };

  const removeQuestion = (index: number) => {
    const updated = template.questions.filter((_, i) => i !== index);
    // Renumber questions
    updated.forEach((q, i) => {
      q.number = i + 1;
    });
    setTemplate({ ...template, questions: updated });
  };

  const addOption = (questionIndex: number) => {
    const question = template.questions[questionIndex];
    if (question.options) {
      const newValue = question.options.length;
      updateQuestion(questionIndex, {
        options: [...question.options, { value: newValue, label: `Option ${newValue + 1}` }],
      });
    }
  };

  const updateOption = (questionIndex: number, optionIndex: number, updates: Partial<{ value: string | number; label: string }>) => {
    const question = template.questions[questionIndex];
    if (question.options) {
      const updated = [...question.options];
      updated[optionIndex] = { ...updated[optionIndex], ...updates };
      updateQuestion(questionIndex, { options: updated });
    }
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = template.questions[questionIndex];
    if (question.options && question.options.length > 2) {
      const updated = question.options.filter((_, i) => i !== optionIndex);
      updateQuestion(questionIndex, { options: updated });
    }
  };

  const handleSave = async () => {
    // Validation
    if (!template.code.trim()) {
      showError('Validation Error', 'Questionnaire code is required');
      return;
    }
    if (!template.name.trim()) {
      showError('Validation Error', 'Questionnaire name is required');
      return;
    }
    if (template.questions.length === 0) {
      showError('Validation Error', 'At least one question is required');
      return;
    }

    // Validate all questions
    for (const q of template.questions) {
      if (!q.text.trim()) {
        showError('Validation Error', `Question ${q.number} must have text`);
        return;
      }
      if ((q.type === 'scale' || q.type === 'choice') && (!q.options || q.options.length < 2)) {
        showError('Validation Error', `Question ${q.number} must have at least 2 options`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(template);
      showSuccess('Success', 'Questionnaire saved successfully!');
      onClose();
    } catch (error: any) {
      showError('Error', error.message || 'Failed to save questionnaire');
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    return (
      <div className="space-y-6 p-6 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{template.name || 'Untitled Questionnaire'}</h2>
          {template.description && (
            <p className="text-gray-600 mb-4">{template.description}</p>
          )}
          <div className="space-y-6">
            {template.questions.map((q, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start gap-3 mb-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {q.number}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-2">{q.text || 'Question text...'}</p>
                    {q.required && (
                      <span className="text-xs text-red-600 font-semibold">Required</span>
                    )}
                  </div>
                </div>
                {q.type === 'scale' || q.type === 'choice' ? (
                  <div className="space-y-2 ml-11">
                    {q.options?.map((opt, optIdx) => (
                      <label key={optIdx} className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-purple-300 cursor-pointer">
                        <input
                          type={q.type === 'choice' ? 'radio' : 'radio'}
                          name={`preview-q-${idx}`}
                          className="w-5 h-5 text-purple-600"
                          disabled
                        />
                        <span className="text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                ) : q.type === 'number' ? (
                  <div className="ml-11">
                    <input
                      type="number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter a number"
                      disabled
                    />
                  </div>
                ) : q.type === 'text' ? (
                  <div className="ml-11">
                    <textarea
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter your answer"
                      rows={3}
                      disabled
                    />
                  </div>
                ) : q.type === 'boolean' ? (
                  <div className="ml-11 space-y-2">
                    <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer">
                      <input type="radio" name={`preview-bool-${idx}`} className="w-5 h-5" disabled />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer">
                      <input type="radio" name={`preview-bool-${idx}`} className="w-5 h-5" disabled />
                      <span>No</span>
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              {initialTemplate ? 'Edit Questionnaire' : 'Create New Questionnaire'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('design')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'design'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Design
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'preview'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            Preview
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'design' ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Questionnaire Code *
                    </label>
                    <input
                      type="text"
                      value={template.code}
                      onChange={(e) => setTemplate({ ...template, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="e.g., CUSTOM_PAIN_SCALE"
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique identifier (uppercase, no spaces)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={template.name}
                      onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="e.g., Custom Pain Assessment"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={template.description}
                      onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      rows={2}
                      placeholder="Brief description of what this questionnaire measures"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={template.category}
                      onChange={(e) => setTemplate({ ...template, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Version
                    </label>
                    <input
                      type="text"
                      value={template.version}
                      onChange={(e) => setTemplate({ ...template, version: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="1.0"
                    />
                  </div>
                </div>
              </div>

              {/* Scoring Settings */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Scoring Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Algorithm
                    </label>
                    <select
                      value={template.scoring.algorithm}
                      onChange={(e) => setTemplate({
                        ...template,
                        scoring: { ...template.scoring, algorithm: e.target.value as any },
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    >
                      <option value="sum">Sum</option>
                      <option value="average">Average</option>
                      <option value="weighted">Weighted</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Min Score
                    </label>
                    <input
                      type="number"
                      value={template.scoring.minScore}
                      onChange={(e) => setTemplate({
                        ...template,
                        scoring: { ...template.scoring, minScore: Number(e.target.value) },
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Max Score
                    </label>
                    <input
                      type="number"
                      value={template.scoring.maxScore}
                      onChange={(e) => setTemplate({
                        ...template,
                        scoring: { ...template.scoring, maxScore: Number(e.target.value) },
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Questions ({template.questions.length})</h3>
                  <button
                    onClick={addQuestion}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Add Question
                  </button>
                </div>

                <div className="space-y-4">
                  {template.questions.map((question, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border-2 border-gray-200">
                      <div className="flex items-start gap-3 mb-4">
                        <GripVertical className="w-5 h-5 text-gray-400 mt-2" />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                              {question.number}
                            </span>
                            <input
                              type="text"
                              value={question.text}
                              onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              placeholder="Enter question text..."
                            />
                            <button
                              onClick={() => removeQuestion(idx)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Type
                              </label>
                              <select
                                value={question.type}
                                onChange={(e) => {
                                  const newType = e.target.value as Question['type'];
                                  const updates: Partial<Question> = { type: newType };
                                  if (newType === 'scale' || newType === 'choice') {
                                    updates.options = [
                                      { value: 0, label: 'Option 1' },
                                      { value: 1, label: 'Option 2' },
                                    ];
                                  } else {
                                    updates.options = undefined;
                                  }
                                  updateQuestion(idx, updates);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                              >
                                {questionTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={question.required}
                                onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                                className="w-5 h-5 text-purple-600"
                              />
                              <label className="text-sm font-semibold text-gray-700">Required</label>
                            </div>
                            {(question.type === 'number') && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Min</label>
                                  <input
                                    type="number"
                                    value={question.min || ''}
                                    onChange={(e) => updateQuestion(idx, { min: Number(e.target.value) })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Max</label>
                                  <input
                                    type="number"
                                    value={question.max || ''}
                                    onChange={(e) => updateQuestion(idx, { max: Number(e.target.value) })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Options for scale/choice */}
                          {(question.type === 'scale' || question.type === 'choice') && (
                            <div className="ml-11 space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-gray-700">Options</label>
                                <button
                                  onClick={() => addOption(idx)}
                                  className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
                                >
                                  + Add Option
                                </button>
                              </div>
                              {question.options?.map((option, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={option.value}
                                    onChange={(e) => updateOption(idx, optIdx, { value: Number(e.target.value) })}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="Value"
                                  />
                                  <input
                                    type="text"
                                    value={option.label}
                                    onChange={(e) => updateOption(idx, optIdx, { label: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="Option label"
                                  />
                                  {question.options && question.options.length > 2 && (
                                    <button
                                      onClick={() => removeOption(idx, optIdx)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {template.questions.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-4">No questions yet. Click "Add Question" to get started.</p>
                      <button
                        onClick={addQuestion}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add First Question
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            renderPreview()
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Questionnaire'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireDesigner;

