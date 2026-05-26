import React, { useState } from 'react';
import { X, Loader, Plus, Trash2 } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { healthEducationApi } from '../services/api';
import { useParams } from 'react-router-dom';

interface QuizBuilderModalProps {
  lessonId: string;
  onClose: () => void;
}

interface Question {
  text: string;
  options: Array<{ text: string; isCorrect: boolean }>;
}

const QuizBuilderModal: React.FC<QuizBuilderModalProps> = ({ lessonId, onClose }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [creating, setCreating] = useState(false);
  const [quizFormData, setQuizFormData] = useState({
    passThreshold: 70,
    maxAttempts: 3,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQIndex, setEditingQIndex] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState<Question>({
    text: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
  });

  const handleAddQuestion = () => {
    if (!newQuestion.text.trim()) {
      showError('Validation', 'Question text is required.');
      return;
    }
    if (newQuestion.options.some(o => !o.text.trim())) {
      showError('Validation', 'All options must have text.');
      return;
    }
    if (!newQuestion.options.some(o => o.isCorrect)) {
      showError('Validation', 'At least one option must be marked as correct.');
      return;
    }

    if (editingQIndex !== null) {
      const updated = [...questions];
      updated[editingQIndex] = newQuestion;
      setQuestions(updated);
      setEditingQIndex(null);
    } else {
      setQuestions([...questions, newQuestion]);
    }

    setNewQuestion({
      text: '',
      options: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
      ],
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleEditQuestion = (index: number) => {
    setNewQuestion(questions[index]);
    setEditingQIndex(index);
  };

  const handleCreateQuiz = async () => {
    if (questions.length === 0) {
      showError('Validation', 'Add at least one question.');
      return;
    }
    if (!tenantSlug || !token || !lessonId) return;

    setCreating(true);
    try {
      // Create quiz
      const quizRes = await healthEducationApi.createQuiz(lessonId, quizFormData, token, tenantSlug);
      const quizId = quizRes.data?.id;

      if (!quizId) throw new Error('No quiz ID returned');

      // Add questions
      for (const question of questions) {
        await healthEducationApi.addQuizQuestion(
          quizId,
          {
            questionText: question.text,
            options: question.options,
          },
          token,
          tenantSlug
        );
      }

      showSuccess('Quiz created', `${questions.length} questions added.`);
      onClose();
    } catch (error: any) {
      showError('Could not create quiz', error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Create Knowledge Check Quiz</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-600 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quiz Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pass Threshold (%)</label>
              <input
                type="number"
                value={quizFormData.passThreshold}
                onChange={(e) => setQuizFormData({ ...quizFormData, passThreshold: parseInt(e.target.value) || 70 })}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Attempts</label>
              <input
                type="number"
                value={quizFormData.maxAttempts}
                onChange={(e) => setQuizFormData({ ...quizFormData, maxAttempts: parseInt(e.target.value) || 3 })}
                min="1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Questions List */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Questions ({questions.length})</h3>
            <div className="space-y-3 mb-4">
              {questions.map((q, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-slate-900">{idx + 1}. {q.text}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditQuestion(idx)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemoveQuestion(idx)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    {q.options.map((opt, oidx) => (
                      <div key={oidx}>
                        {opt.isCorrect && <span className="font-semibold text-green-700">✓ </span>}
                        {opt.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Question Editor */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {editingQIndex !== null ? 'Edit Question' : 'Add Question'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question Text *</label>
                <textarea
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                  placeholder="Enter question..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Answer Options *</label>
                <div className="space-y-2">
                  {newQuestion.options.map((option, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) => {
                          const updated = [...newQuestion.options];
                          updated[idx].text = e.target.value;
                          setNewQuestion({ ...newQuestion, options: updated });
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer hover:bg-slate-50">
                        <input
                          type="radio"
                          checked={option.isCorrect}
                          onChange={() => {
                            const updated = newQuestion.options.map((o, i) => ({
                              ...o,
                              isCorrect: i === idx,
                            }));
                            setNewQuestion({ ...newQuestion, options: updated });
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-slate-700">Correct</span>
                      </label>
                      {newQuestion.options.length > 2 && (
                        <button
                          onClick={() => {
                            const updated = newQuestion.options.filter((_, i) => i !== idx);
                            setNewQuestion({ ...newQuestion, options: updated });
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const updated = [...newQuestion.options, { text: '', isCorrect: false }];
                    setNewQuestion({ ...newQuestion, options: updated });
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus size={14} /> Add Option
                </button>
              </div>

              <button
                onClick={handleAddQuestion}
                disabled={!newQuestion.text.trim()}
                className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors font-medium"
              >
                {editingQIndex !== null ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleCreateQuiz}
            disabled={creating || questions.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {creating && <Loader size={16} className="animate-spin" />}
            Create Quiz
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizBuilderModal;
