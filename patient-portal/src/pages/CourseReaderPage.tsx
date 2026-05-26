import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, CheckCircle, Clock, FileText, PlayCircle, Loader } from 'lucide-react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  content_type: string;
  duration_minutes?: number;
  completed_at?: string;
  quiz_id?: string;
  quiz_passed?: boolean;
  translation?: {
    title: string;
    content_body: string;
  };
}

interface Course {
  id: string;
  title: string;
  description?: string;
  modules: Module[];
  completed_at?: string;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  options: Array<{ id: string; text: string }>;
}

interface Quiz {
  id: string;
  pass_threshold: number;
  questions: QuizQuestion[];
}

const CourseReaderPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const { courseId } = useParams<{ courseId: string }>();
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useNotification();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  useEffect(() => {
    if (courseId && tenantSlug && token) {
      loadCourse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, tenantSlug, token, i18n.language]);

  const loadCourse = async () => {
    if (!courseId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const res = await patientPortalApi.getEducationCourse(courseId, token, tenantSlug, i18n.language);
      setCourse(res);
      // Expand first module by default
      if (res?.modules?.[0]) {
        setExpandedModules(new Set([res.modules[0].id]));
      }
    } catch (error: any) {
      showError('Error loading course', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleExpanded = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleMarkLessonComplete = async () => {
    if (!selectedLesson || !tenantSlug || !token) return;
    setCompletingLesson(true);
    try {
      await patientPortalApi.markLessonComplete(selectedLesson.id, token, tenantSlug);
      showSuccess('Lesson marked complete', selectedLesson.title);
      await loadCourse();
    } catch (error: any) {
      showError('Could not mark lesson complete', error.message);
    } finally {
      setCompletingLesson(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!quiz || !selectedLesson || !tenantSlug || !token) return;
    if (Object.keys(quizAnswers).length !== quiz.questions.length) {
      showError('Validation', 'Please answer all questions.');
      return;
    }

    setQuizSubmitting(true);
    try {
      const answers = Object.entries(quizAnswers).map(([questionId, selectedOptionId]) => ({
        questionId,
        selectedOptionId,
      }));
      const result = await patientPortalApi.submitQuizAttempt(quiz.id, answers, token, tenantSlug);
      const passed = result.passed ?? (result.score >= quiz.pass_threshold);
      if (passed) {
        showSuccess('Quiz passed!', `Score: ${result.score}%`);
      } else {
        showError('Quiz failed', `Score: ${result.score}%. Pass threshold: ${quiz.pass_threshold}%`);
      }
      setQuizModalOpen(false);
      setQuizAnswers({});
      await loadCourse();
    } catch (error: any) {
      showError('Could not submit quiz', error.message);
    } finally {
      setQuizSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Course not found</p>
          <button
            onClick={() => navigate(`/${tenantSlug}/education`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Education
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate(`/${tenantSlug}/education`)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 flex items-center gap-1"
          >
            <ChevronLeft size={16} /> {t('education.back', 'Back to Education')}
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900">{course.title}</h1>
              <p className="text-sm text-slate-600 mt-1">{course.description}</p>
            </div>
            {course.completed_at && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle size={20} className="text-green-600" />
                <span className="text-sm font-semibold text-green-700">{t('education.complete', 'Complete')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Course Content */}
          <div className="md:col-span-2 space-y-4">
            {selectedLesson ? (
              // Lesson View
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <button
                    onClick={() => setSelectedLesson(null)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-3 flex items-center gap-1"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedLesson.translation?.title || selectedLesson.title}</h2>
                  {selectedLesson.duration_minutes && (
                    <p className="text-sm text-slate-600 mt-2">{selectedLesson.duration_minutes} minutes</p>
                  )}
                </div>

                <div className="p-6">
                  {selectedLesson.content_type === 'text' && (
                    <div className="prose prose-sm max-w-none text-slate-700">
                      <ReactMarkdown>{selectedLesson.translation?.content_body || ''}</ReactMarkdown>
                    </div>
                  )}
                  {selectedLesson.content_type === 'video_url' && (
                    <div className="bg-slate-100 rounded-lg p-8 text-center">
                      <PlayCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 mb-4">Video content</p>
                      <a
                        href={selectedLesson.translation?.content_body}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Open Video
                      </a>
                    </div>
                  )}
                  {selectedLesson.content_type === 'pdf_url' && (
                    <div className="bg-slate-100 rounded-lg p-8 text-center">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-600 mb-4">PDF document</p>
                      <a
                        href={selectedLesson.translation?.content_body}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {t('education.openPdf', 'Open PDF document')}
                      </a>
                    </div>
                  )}

                  {/* Quiz Section */}
                  {selectedLesson.quiz_id && !selectedLesson.quiz_passed && (
                    <div className="mt-8 p-6 bg-amber-50 rounded-lg border border-amber-200">
                      <h3 className="font-semibold text-slate-900 mb-2">{t('education.quiz', 'Knowledge Check')}</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        {t('education.passThreshold', 'Pass mark: {{pct}}%', { pct: 70 })}
                      </p>
                      <button
                        onClick={() => setQuizModalOpen(true)}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm"
                      >
                        {t('education.quiz', 'Take Quiz')}
                      </button>
                    </div>
                  )}

                  {selectedLesson.quiz_passed && (
                    <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={20} className="text-green-600" />
                        <h3 className="font-semibold text-green-700">{t('education.quizPassed', 'Passed')}</h3>
                      </div>
                      <p className="text-sm text-green-600">{t('education.complete', 'You have passed this quiz')}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-8 flex gap-3">
                    {!selectedLesson.completed_at && (
                      <button
                        onClick={handleMarkLessonComplete}
                        disabled={completingLesson}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        {completingLesson && <Loader size={16} className="animate-spin" />}
                        {t('education.markComplete', 'Mark as Complete')}
                      </button>
                    )}
                    {selectedLesson.completed_at && (
                      <div className="flex-1 px-4 py-3 bg-green-100 text-green-700 rounded-lg font-medium flex items-center justify-center gap-2">
                        <CheckCircle size={16} />
                        {t('education.complete', 'Complete')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Module List
              <div className="space-y-3">
                {course.modules.map((module) => (
                  <div key={module.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => toggleModuleExpanded(module.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <h3 className="font-semibold text-slate-900">{module.title}</h3>
                      <ChevronDown
                        size={20}
                        className={`text-slate-600 transition-transform ${expandedModules.has(module.id) ? '' : '-rotate-90'}`}
                      />
                    </button>

                    {expandedModules.has(module.id) && (
                      <div className="border-t border-slate-200 bg-slate-50 p-6 space-y-2">
                        {module.lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => setSelectedLesson(lesson)}
                            className="w-full text-left px-4 py-3 bg-white rounded-lg border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all flex items-center justify-between gap-3"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{lesson.translation?.title || lesson.title}</p>
                              <p className="text-xs text-slate-600">{lesson.content_type}</p>
                            </div>
                            {lesson.completed_at ? (
                              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                            ) : (
                              <Clock size={18} className="text-amber-600 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Course Progress */}
          <div>
            <div className="bg-white rounded-lg border border-slate-200 p-6 sticky top-24">
              <h3 className="font-bold text-slate-900 mb-4">{t('education.progress', 'Progress')}</h3>
              {/* Calculate progress */}
              {course.modules && (
                <div className="space-y-4">
                  {course.modules.map((module) => {
                    const completed = module.lessons.filter(l => l.completed_at).length;
                    const total = module.lessons.length;
                    return (
                      <div key={module.id}>
                        <p className="text-sm font-medium text-slate-900 mb-2">{module.title}</p>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {completed} / {total} lessons
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Modal */}
      {quizModalOpen && quiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">{t('education.quiz', 'Knowledge Check')}</h2>
              <p className="text-sm text-slate-600 mt-1">
                {t('education.passThreshold', 'Pass mark: {{pct}}%', { pct: quiz.pass_threshold })}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {quiz.questions.map((question, idx) => (
                <div key={question.id}>
                  <p className="font-medium text-slate-900 mb-3">
                    {idx + 1}. {question.question_text}
                  </p>
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label key={option.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="radio"
                          name={question.id}
                          value={option.id}
                          checked={quizAnswers[question.id] === option.id}
                          onChange={() => setQuizAnswers({ ...quizAnswers, [question.id]: option.id })}
                          className="w-4 h-4"
                        />
                        <span className="text-slate-700">{option.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={handleSubmitQuiz}
                disabled={quizSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {quizSubmitting ? 'Submitting...' : t('education.submitQuiz', 'Submit Answers')}
              </button>
              <button
                onClick={() => {
                  setQuizModalOpen(false);
                  setQuizAnswers({});
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseReaderPage;
