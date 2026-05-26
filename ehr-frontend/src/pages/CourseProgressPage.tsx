import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader, ChevronLeft, Users, CheckCircle, Clock } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { healthEducationApi } from '../services/api';

interface ProgressItem {
  patient_id: string;
  patient_name?: string;
  enrollment_id: string;
  enrolled_at: string;
  completed_at?: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percent: number;
}

const CourseProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenantSlug, courseId } = useParams<{ tenantSlug: string; courseId: string }>();
  const { showError } = useNotification();
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'in-progress' | 'completed'>('all');

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    if (courseId && tenantSlug && token) {
      loadProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, tenantSlug, token]);

  const loadProgress = async () => {
    if (!courseId || !tenantSlug || !token) return;
    setLoading(true);
    try {
      const res = await healthEducationApi.getCourseProgress(courseId, token, tenantSlug);
      const data = res.data || {};
      setCourseTitle(data.course_title || '');
      setProgress(data.progress || []);
    } catch (error: any) {
      showError('Error loading progress', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProgress = progress.filter((item) => {
    if (filterTab === 'completed') return item.completed_at;
    if (filterTab === 'in-progress') return !item.completed_at;
    return true;
  });

  const stats = {
    total: progress.length,
    completed: progress.filter((p) => p.completed_at).length,
    inProgress: progress.filter((p) => !p.completed_at).length,
    averageProgress: progress.length > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.progress_percent, 0) / progress.length)
      : 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-600">Loading progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <button
            onClick={() => navigate(`/ehr/${tenantSlug}/health-education/${courseId}`)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2 flex items-center gap-1"
          >
            <ChevronLeft size={16} /> Back to Course
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Course Progress</h1>
          <p className="text-sm text-slate-600 mt-1">{courseTitle}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
            <p className="text-sm text-slate-600 mt-1">Total Enrolled</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-sm text-slate-600 mt-1">Completed</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="text-3xl font-bold text-amber-600">{stats.inProgress}</div>
            <p className="text-sm text-slate-600 mt-1">In Progress</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="text-3xl font-bold text-blue-600">{stats.averageProgress}%</div>
            <p className="text-sm text-slate-600 mt-1">Avg Progress</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {(['all', 'in-progress', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                filterTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'all' && 'All Patients'}
              {tab === 'in-progress' && 'In Progress'}
              {tab === 'completed' && 'Completed'}
            </button>
          ))}
        </div>

        {/* Progress Table */}
        {filteredProgress.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 mb-2">No patients in this category</p>
            <p className="text-sm text-slate-500">
              {filterTab === 'completed' && 'No patients have completed this course yet.'}
              {filterTab === 'in-progress' && 'No patients have started this course yet.'}
              {filterTab === 'all' && 'No patients are enrolled in this course.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Lessons</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Enrolled</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredProgress.map((item) => (
                    <tr key={item.enrollment_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{item.patient_name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.patient_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-xs">
                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${item.progress_percent}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-slate-900 min-w-fit">
                            {item.progress_percent}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700">
                          {item.completed_lessons} / {item.total_lessons}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          {new Date(item.enrolled_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.completed_at ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="text-sm font-medium text-green-700">Completed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">In Progress</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseProgressPage;
