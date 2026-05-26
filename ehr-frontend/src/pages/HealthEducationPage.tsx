import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, BookOpen, Users, BarChart3, Loader } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { healthEducationApi } from '../services/api';

interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  targetAudience?: string;
  published: boolean;
  enrolled_count: number;
  module_count: number;
  lesson_count: number;
  createdAt?: string;
  updated_at?: string;
}

const HealthEducationPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showSuccess, showError } = useNotification();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    targetAudience: 'all',
    defaultLanguageCode: 'en',
  });

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCourses = async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const res = await healthEducationApi.listCourses(token, tenantSlug);
      setCourses(res.data || []);
    } catch (error: any) {
      showError('Could not load courses', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!formData.title.trim()) {
      showError('Validation', 'Course title is required.');
      return;
    }
    if (!tenantSlug || !token) return;

    setCreating(true);
    try {
      const res = await healthEducationApi.createCourse(formData, token, tenantSlug);
      showSuccess('Course created', `${formData.title} is ready for content.`);
      setFormData({
        title: '',
        description: '',
        category: 'general',
        targetAudience: 'all',
        defaultLanguageCode: 'en',
      });
      setShowNewForm(false);
      await loadCourses();
      // Navigate to editor
      if (res.data?.id) {
        navigate(`/ehr/${tenantSlug}/health-education/${res.data.id}`);
      }
    } catch (error: any) {
      showError('Could not create course', error.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Health Education</h1>
              <p className="text-sm text-slate-600 mt-1">Create, manage and assign patient education courses</p>
            </div>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus size={18} />
              New Course
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* New Course Form */}
        {showNewForm && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Course</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. HIV Prevention & Management"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="general">General</option>
                  <option value="hiv">HIV</option>
                  <option value="maternal">Maternal</option>
                  <option value="diabetes">Diabetes</option>
                  <option value="nutrition">Nutrition</option>
                  <option value="mental_health">Mental Health</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All Patients</option>
                  <option value="hiv_positive">HIV Positive</option>
                  <option value="anc">Antenatal Care</option>
                  <option value="paediatric">Paediatric</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Language</label>
                <select
                  value={formData.defaultLanguageCode}
                  onChange={(e) => setFormData({ ...formData, defaultLanguageCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="en">English</option>
                  <option value="sn">Shona</option>
                  <option value="nd">Ndebele</option>
                </select>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief course overview..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateCourse}
                disabled={creating || !formData.title.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
              >
                {creating && <Loader size={16} className="animate-spin" />}
                Create Course
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  setFormData({
                    title: '',
                    description: '',
                    category: 'general',
                    targetAudience: 'all',
                    defaultLanguageCode: 'en',
                  });
                }}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-slate-200 rounded-lg h-48" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={40} className="text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No courses yet</h3>
            <p className="text-slate-600 mb-6">Create your first health education course to get started.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus size={18} />
              Create First Course
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => navigate(`/ehr/${tenantSlug}/health-education/${course.id}`)}
                className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer overflow-hidden"
              >
                <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 flex-1 line-clamp-2">{course.title}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                        course.published
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {course.published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  {course.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">{course.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-1">
                      <BarChart3 size={16} />
                      {course.module_count} modules
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen size={16} />
                      {course.lesson_count} lessons
                    </div>
                    <div className="flex items-center gap-1">
                      <Users size={16} />
                      {course.enrolled_count} enrolled
                    </div>
                  </div>

                  {course.category && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                        {course.category}
                      </span>
                      {course.targetAudience && (
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                          {course.targetAudience === 'all' ? 'All patients' : course.targetAudience}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/ehr/${tenantSlug}/health-education/${course.id}/progress`);
                    }}
                    className="mt-4 w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                  >
                    View Progress
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthEducationPage;
