import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus, ChevronDown, ChevronUp, Edit2, BarChart3,
  Loader, Save, Eye, EyeOff,
} from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { healthEducationApi } from '../services/api';
import LessonEditorModal from '../components/LessonEditorModal';
import TranslationModal from '../components/TranslationModal';
import QuizBuilderModal from '../components/QuizBuilderModal';

interface Module {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  module_id: string;
  order_index: number;
  content_type: string;
  duration_minutes?: number;
  translations?: any[];
}

interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  published: boolean;
  modules?: Module[];
  enrolled_count?: number;
  lesson_count?: number;
}

const CourseEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantSlug, courseId } = useParams<{ tenantSlug: string; courseId: string }>();
  const { showSuccess, showError } = useNotification();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [lessonEditorOpen, setLessonEditorOpen] = useState(false);
  const [selectedModuleForLesson, setSelectedModuleForLesson] = useState<string>('');
  const [translationModalOpen, setTranslationModalOpen] = useState(false);
  const [selectedLessonForTranslation, setSelectedLessonForTranslation] = useState<string>('');
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false);
  const [selectedLessonForQuiz, setSelectedLessonForQuiz] = useState<string>('');

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    if (courseId && tenantSlug && token) {
      loadCourseAndModules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, tenantSlug, token]);

  const loadCourseAndModules = async () => {
    if (!courseId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const [courseRes, modulesRes] = await Promise.all([
        healthEducationApi.getCourse(courseId, token, tenantSlug),
        healthEducationApi.getModules(courseId, token, tenantSlug),
      ]);
      setCourse(courseRes.data);
      setModules(modulesRes.data || []);
    } catch (error: any) {
      showError('Error loading course', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!courseId || !tenantSlug || !token) return;
    setPublishing(true);
    try {
      const publish = course?.published ? healthEducationApi.unpublishCourse : healthEducationApi.publishCourse;
      await publish(courseId, token, tenantSlug);
      showSuccess(
        'Course updated',
        `Course is now ${course?.published ? 'unpublished' : 'published'}.`
      );
      await loadCourseAndModules();
    } catch (error: any) {
      showError('Publish failed', error.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleAddModule = async () => {
    if (!newModuleTitle.trim() || !courseId || !tenantSlug || !token) return;
    try {
      await healthEducationApi.addModule(courseId, { title: newModuleTitle }, token, tenantSlug);
      showSuccess('Module added', newModuleTitle);
      setNewModuleTitle('');
      setAddingModule(false);
      await loadCourseAndModules();
    } catch (error: any) {
      showError('Could not add module', error.message);
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

  const handleReorderModule = async (moduleId: string, direction: 'up' | 'down') => {
    if (!tenantSlug || !token) return;
    try {
      await healthEducationApi.reorderModule(moduleId, { direction }, token, tenantSlug);
      await loadCourseAndModules();
    } catch (error: any) {
      showError('Could not reorder module', error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading course editor...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Course not found</p>
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/health-education`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/health-education`)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 flex items-center gap-1"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-bold text-slate-900">{course.title}</h1>
              <p className="text-sm text-slate-600 mt-1">{course.description}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/ehr/${tenantSlug}/health-education/${courseId}/progress`)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                <BarChart3 size={18} />
                Progress
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                  course.published
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {publishing ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Publishing...
                  </>
                ) : course.published ? (
                  <>
                    <Eye size={18} />
                    Published
                  </>
                ) : (
                  <>
                    <EyeOff size={18} />
                    Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Modules Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Course Content</h2>
            {!addingModule && (
              <button
                onClick={() => setAddingModule(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus size={18} />
                Add Module
              </button>
            )}
          </div>

          {/* Add Module Form */}
          {addingModule && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Module title..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddModule}
                  disabled={!newModuleTitle.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm"
                >
                  Create Module
                </button>
                <button
                  onClick={() => {
                    setAddingModule(false);
                    setNewModuleTitle('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Modules List */}
          {modules.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              <p className="text-slate-600">No modules yet. Add your first module to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((module) => (
                <div key={module.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => toggleModuleExpanded(module.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      {expandedModules.has(module.id) ? (
                        <ChevronDown size={18} className="text-slate-600" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-600 transform -rotate-90" />
                      )}
                      <div>
                        <h3 className="font-semibold text-slate-900">{module.title}</h3>
                        <p className="text-xs text-slate-600">{(module.lessons || []).length} lessons</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderModule(module.id, 'up');
                        }}
                        className="p-1 text-slate-600 hover:text-slate-900"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderModule(module.id, 'down');
                        }}
                        className="p-1 text-slate-600 hover:text-slate-900"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {expandedModules.has(module.id) && (
                    <div className="border-t border-slate-200 bg-slate-50 p-6">
                      <div className="space-y-3 mb-4">
                        {(module.lessons || []).map((lesson) => (
                          <div key={lesson.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">Lesson {lesson.order_index + 1}</p>
                              <p className="text-xs text-slate-600">{lesson.content_type}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedLessonForTranslation(lesson.id);
                                  setTranslationModalOpen(true);
                                }}
                                className="p-2 text-slate-600 hover:text-slate-900"
                                title="Add translations"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedLessonForQuiz(lesson.id);
                                  setQuizBuilderOpen(true);
                                }}
                                className="p-2 text-slate-600 hover:text-slate-900"
                                title="Add/edit quiz"
                              >
                                <Save size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedModuleForLesson(module.id);
                          setLessonEditorOpen(true);
                        }}
                        className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors font-medium text-sm"
                      >
                        Add Lesson
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {lessonEditorOpen && (
        <LessonEditorModal
          moduleId={selectedModuleForLesson}
          onClose={() => {
            setLessonEditorOpen(false);
            setSelectedModuleForLesson('');
            loadCourseAndModules();
          }}
        />
      )}

      {translationModalOpen && (
        <TranslationModal
          lessonId={selectedLessonForTranslation}
          onClose={() => {
            setTranslationModalOpen(false);
            setSelectedLessonForTranslation('');
            loadCourseAndModules();
          }}
        />
      )}

      {quizBuilderOpen && (
        <QuizBuilderModal
          lessonId={selectedLessonForQuiz}
          onClose={() => {
            setQuizBuilderOpen(false);
            setSelectedLessonForQuiz('');
            loadCourseAndModules();
          }}
        />
      )}
    </div>
  );
};

export default CourseEditorPage;
