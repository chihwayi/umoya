import React, { useState, useEffect } from 'react';
import { Search, FileText, Filter, Send, Calendar, X, CheckCircle, AlertCircle, Info, Plus } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import QuestionnaireDesigner from './QuestionnaireDesigner';

interface Questionnaire {
  code: string;
  name: string;
  description: string;
  category: string;
  version?: string;
  questionCount: number;
  minScore: number;
  maxScore: number;
}

interface QuestionnaireLibraryProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onClose?: () => void;
  onAssigned?: () => void;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'quality_of_life', label: 'Quality of Life' },
  { value: 'symptom_tracking', label: 'Symptom Tracking' },
  { value: 'disease_specific', label: 'Disease Specific' },
];

const QuestionnaireLibrary: React.FC<QuestionnaireLibraryProps> = ({
  patientId,
  tenantSlug,
  token,
  onClose,
  onAssigned,
}) => {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [filteredQuestionnaires, setFilteredQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    dueDate: '',
    notes: '',
    autoImport: true,
  });
  const [assigning, setAssigning] = useState(false);
  const [showDesigner, setShowDesigner] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  useEffect(() => {
    filterQuestionnaires();
  }, [questionnaires, searchTerm, selectedCategory]);

  const loadQuestionnaires = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.browseQuestionnaireLibrary(token, tenantSlug, {
        category: selectedCategory || undefined,
        search: searchTerm || undefined,
      });
      setQuestionnaires(response.data || []);
    } catch (error: any) {
      console.error('Failed to load questionnaire library:', error);
      showError('Error', 'Failed to load questionnaire library. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterQuestionnaires = () => {
    let filtered = [...questionnaires];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        q =>
          q.name.toLowerCase().includes(term) ||
          q.code.toLowerCase().includes(term) ||
          q.description.toLowerCase().includes(term),
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(q => q.category === selectedCategory);
    }

    setFilteredQuestionnaires(filtered);
  };

  const handleAssign = async () => {
    if (!selectedQuestionnaire) return;

    try {
      setAssigning(true);
      await ehrApi.assignQuestionnaireByCode(
        patientId,
        selectedQuestionnaire.code,
        token,
        tenantSlug,
        {
          autoImport: assignForm.autoImport,
          dueDate: assignForm.dueDate || undefined,
          notes: assignForm.notes || undefined,
        },
      );
      showSuccess('Success', `Questionnaire "${selectedQuestionnaire.name}" assigned successfully!`);
      setShowAssignModal(false);
      setSelectedQuestionnaire(null);
      setAssignForm({ dueDate: '', notes: '', autoImport: true });
      if (onAssigned) {
        onAssigned();
      }
    } catch (error: any) {
      console.error('Failed to assign questionnaire:', error);
      showError('Error', error.response?.data?.message || 'Failed to assign questionnaire. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      mental_health: 'bg-purple-100 text-purple-800 border-purple-300',
      quality_of_life: 'bg-blue-100 text-blue-800 border-blue-300',
      symptom_tracking: 'bg-orange-100 text-orange-800 border-orange-300',
      disease_specific: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category.replace(/_/g, ' ');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-900">Questionnaire Library</h2>
              <p className="text-sm text-slate-600">Browse and assign questionnaires to patients</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDesigner(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" />
              Create New
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search questionnaires..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                loadQuestionnaires();
              }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              loadQuestionnaires();
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-2 text-slate-500">Loading questionnaires...</p>
          </div>
        ) : filteredQuestionnaires.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500">No questionnaires found.</p>
            {searchTerm && (
              <p className="text-sm text-slate-400 mt-2">Try adjusting your search terms.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQuestionnaires.map((questionnaire) => (
              <div
                key={questionnaire.code}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedQuestionnaire(questionnaire);
                  setShowAssignModal(true);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-900 mb-1">{questionnaire.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getCategoryColor(questionnaire.category)}`}>
                        {getCategoryLabel(questionnaire.category)}
                      </span>
                      {questionnaire.version && (
                        <span className="text-xs text-slate-500">v{questionnaire.version}</span>
                      )}
                    </div>
                  </div>
                  <Send className="w-5 h-5 text-purple-600 flex-shrink-0" />
                </div>
                <p className="text-sm text-slate-600 mb-3">{questionnaire.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {questionnaire.questionCount} questions
                  </span>
                  <span>
                    Score: {questionnaire.minScore}-{questionnaire.maxScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedQuestionnaire && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Assign Questionnaire</h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedQuestionnaire(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="font-semibold text-slate-900 mb-1">{selectedQuestionnaire.name}</p>
                <p className="text-sm text-slate-600">{selectedQuestionnaire.description}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={assignForm.dueDate}
                    onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any notes for the patient..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoImport"
                    checked={assignForm.autoImport}
                    onChange={(e) => setAssignForm({ ...assignForm, autoImport: e.target.checked })}
                    className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-600"
                  />
                  <label htmlFor="autoImport" className="text-sm text-slate-700">
                    Auto-import from library if not in database
                  </label>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedQuestionnaire(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Assign Questionnaire
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questionnaire Designer Modal */}
      {showDesigner && (
        <QuestionnaireDesigner
          onClose={() => {
            setShowDesigner(false);
            loadQuestionnaires(); // Reload to show new questionnaire
          }}
          onSave={async (template) => {
            try {
              await ehrApi.createQuestionnaireTemplate(template, token, tenantSlug);
              showSuccess('Success', 'Questionnaire created successfully!');
              setShowDesigner(false);
              loadQuestionnaires();
            } catch (error: any) {
              throw new Error(error.response?.data?.message || 'Failed to create questionnaire');
            }
          }}
          tenantSlug={tenantSlug}
          token={token}
        />
      )}
    </div>
  );
};

export default QuestionnaireLibrary;

