import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { useTenantSlug } from '../hooks/useTenantSlug';
import {
  FileText, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Save, Loader, Check
} from 'lucide-react';
import { format } from 'date-fns';

interface Question {
  number: number;
  text: string;
  type: 'number' | 'text' | 'choice' | 'scale' | 'boolean';
  required: boolean;
  options?: Array<{ value: string | number; label: string }>;
  min?: number;
  max?: number;
}

interface Questionnaire {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  status: string;
  questions: Question[];
  responses?: any[];
}

const QuestionnaireCompletionPage: React.FC = () => {
  const { questionnaireId, tenantSlug: urlTenantSlug } = useParams<{ questionnaireId: string; tenantSlug: string }>();
  const navigate = useNavigate();
  const { token, patient } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [responses, setResponses] = useState<Record<number, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    if (questionnaireId) {
      loadQuestionnaire();
    }
  }, [questionnaireId]);

  const loadQuestionnaire = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await patientPortalApi.getQuestionnaire(questionnaireId!, token!, tenantSlug);
      setQuestionnaire(data);
      
      // If already completed, load existing responses
      if (data.status === 'completed' && data.responses) {
        const existingResponses: Record<number, any> = {};
        data.responses.forEach((r: any) => {
          existingResponses[r.question_number] = r.response_value;
        });
        setResponses(existingResponses);
      }
    } catch (err: any) {
      console.error('Error loading questionnaire:', err);
      setError(err.message || 'Failed to load questionnaire');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionNumber: number, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [questionNumber]: value,
    }));
  };

  const validateResponses = (): boolean => {
    if (!questionnaire) return false;

    for (const question of questionnaire.questions) {
      if (question.required && (responses[question.number] === undefined || responses[question.number] === '')) {
        setError(`Question ${question.number} is required`);
        setCurrentQuestionIndex(questionnaire.questions.findIndex((q) => q.number === question.number));
        return false;
      }

      // Validate number range
      if (question.type === 'number' || question.type === 'scale') {
        const numValue = Number(responses[question.number]);
        if (question.min !== undefined && numValue < question.min) {
          setError(`Question ${question.number} must be at least ${question.min}`);
          return false;
        }
        if (question.max !== undefined && numValue > question.max) {
          setError(`Question ${question.number} must be at most ${question.max}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!questionnaire) return;

    if (!validateResponses()) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Format responses for API
      const formattedResponses = questionnaire.questions
        .filter((q) => responses[q.number] !== undefined && responses[q.number] !== '')
        .map((q) => ({
          questionNumber: q.number,
          questionText: q.text,
          responseValue: responses[q.number],
          responseType: q.type,
        }));

      const result = await patientPortalApi.submitQuestionnaire(
        questionnaireId!,
        formattedResponses,
        token!,
        tenantSlug,
      );

      // Store result for display
      setSuccess(true);
      setQuestionnaire((prev) => prev ? { ...prev, status: 'completed', finalScore: result.finalScore } : null);
      
      // Redirect after 4 seconds to allow patient to see the score
      setTimeout(() => {
        navigate(`/${tenantSlug}/questionnaires`);
      }, 4000);
    } catch (err: any) {
      console.error('Error submitting questionnaire:', err);
      setError(err.message || 'Failed to submit questionnaire');
    } finally {
      setSubmitting(false);
    }
  };

  const getCompletionPercentage = (): number => {
    if (!questionnaire) return 0;
    const answered = questionnaire.questions.filter((q) => responses[q.number] !== undefined && responses[q.number] !== '').length;
    return Math.round((answered / questionnaire.questions.length) * 100);
  };

  const renderQuestion = (question: Question) => {
    const currentValue = responses[question.number];

    switch (question.type) {
      case 'scale':
        if (question.options) {
          return (
            <div className="space-y-3">
              {question.options.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    currentValue === option.value
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.number}`}
                    value={option.value}
                    checked={currentValue === option.value}
                    onChange={(e) => handleResponseChange(question.number, option.value)}
                    className="w-5 h-5 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="flex-1 font-medium text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          );
        }
        // Scale without options falls through to number input
        return (
          <input
            type="number"
            min={question.min}
            max={question.max}
            value={currentValue || ''}
            onChange={(e) => handleResponseChange(question.number, e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            placeholder={`Enter a number${question.min !== undefined ? ` (${question.min}-${question.max})` : ''}`}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            min={question.min}
            max={question.max}
            value={currentValue || ''}
            onChange={(e) => handleResponseChange(question.number, e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            placeholder={`Enter a number${question.min !== undefined ? ` (${question.min}-${question.max})` : ''}`}
          />
        );

      case 'text':
        return (
          <textarea
            value={currentValue || ''}
            onChange={(e) => handleResponseChange(question.number, e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
            placeholder="Enter your response..."
          />
        );

      case 'boolean':
        return (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.number}`}
                value="true"
                checked={currentValue === 'true' || currentValue === true}
                onChange={(e) => handleResponseChange(question.number, true)}
                className="w-5 h-5 text-purple-600 focus:ring-purple-500"
              />
              <span className="font-medium text-gray-900">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.number}`}
                value="false"
                checked={currentValue === 'false' || currentValue === false}
                onChange={(e) => handleResponseChange(question.number, false)}
                className="w-5 h-5 text-purple-600 focus:ring-purple-500"
              />
              <span className="font-medium text-gray-900">No</span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading questionnaire...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-200">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Questionnaire Not Found</h2>
            <p className="text-gray-600 mb-6">{error || 'The questionnaire you are looking for does not exist.'}</p>
            <Link
              to={`/${tenantSlug}/questionnaires`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Questionnaires
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const getScoreInterpretation = (code: string, score: number) => {
    if (code === 'PHQ9') {
      if (score >= 20) return { label: 'Severe Depression', color: 'text-red-600', bg: 'bg-red-50' };
      if (score >= 15) return { label: 'Moderately Severe', color: 'text-orange-600', bg: 'bg-orange-50' };
      if (score >= 10) return { label: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      if (score >= 5) return { label: 'Mild', color: 'text-blue-600', bg: 'bg-blue-50' };
      return { label: 'Minimal', color: 'text-green-600', bg: 'bg-green-50' };
    }
    if (code === 'GAD7') {
      if (score >= 15) return { label: 'Severe Anxiety', color: 'text-red-600', bg: 'bg-red-50' };
      if (score >= 10) return { label: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      if (score >= 5) return { label: 'Mild', color: 'text-blue-600', bg: 'bg-blue-50' };
      return { label: 'Minimal', color: 'text-green-600', bg: 'bg-green-50' };
    }
    return null;
  };

  if (success) {
    const finalScore = (questionnaire as any)?.finalScore;
    const interpretation = questionnaire?.code && finalScore !== undefined 
      ? getScoreInterpretation(questionnaire.code, finalScore) 
      : null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-200">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Questionnaire Submitted Successfully!</h2>
            <p className="text-gray-600 mb-6">Thank you for completing the questionnaire. Your responses have been saved and shared with your care team.</p>
            
            {finalScore !== undefined && (
              <div className={`mt-6 p-6 rounded-xl border-2 ${interpretation?.bg || 'bg-gray-50'} border-gray-200`}>
                <div className="text-sm text-gray-600 mb-2">Your Score</div>
                <div className="text-4xl font-bold text-gray-900 mb-2">{finalScore}</div>
                {interpretation && (
                  <div className={`text-lg font-semibold ${interpretation.color}`}>
                    {interpretation.label}
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-3">
                  Your care team will review your responses and may contact you if follow-up is needed.
                </p>
              </div>
            )}

            <p className="text-sm text-gray-500 mt-6">Redirecting to questionnaires page in a few seconds...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questionnaire.questions[currentQuestionIndex];
  const completionPercentage = getCompletionPercentage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to={`/${tenantSlug}/questionnaires`}
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-4 font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Questionnaires
          </Link>
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{questionnaire.name}</h1>
                {questionnaire.description && (
                  <p className="text-gray-600 text-sm mt-1">{questionnaire.description}</p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Progress</span>
                <span className="font-semibold text-gray-900">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span>Question {currentQuestionIndex + 1} of {questionnaire.questions.length}</span>
                <span>{questionnaire.questions.filter((q) => responses[q.number] !== undefined && responses[q.number] !== '').length} answered</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Question Display */}
        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-200 mb-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-semibold">
                Question {currentQuestion.number}
              </span>
              {currentQuestion.required && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">Required</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{currentQuestion.text}</h2>
          </div>

          <div className="mb-6">{renderQuestion(currentQuestion)}</div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                if (currentQuestionIndex > 0) {
                  setCurrentQuestionIndex(currentQuestionIndex - 1);
                  setError('');
                }
              }}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            {currentQuestionIndex < questionnaire.questions.length - 1 ? (
              <button
                onClick={() => {
                  setCurrentQuestionIndex(currentQuestionIndex + 1);
                  setError('');
                }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Submit
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Question List (Mini Navigation) */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">All Questions</h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {questionnaire.questions.map((q, index) => {
              const isAnswered = responses[q.number] !== undefined && responses[q.number] !== '';
              const isCurrent = index === currentQuestionIndex;
              return (
                <button
                  key={q.number}
                  onClick={() => {
                    setCurrentQuestionIndex(index);
                    setError('');
                  }}
                  className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                    isCurrent
                      ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                      : isAnswered
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {q.number}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireCompletionPage;

