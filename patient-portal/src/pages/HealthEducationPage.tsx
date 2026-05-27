import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronLeft, Search } from 'lucide-react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const LOCALE_STORAGE_KEY = 'patient_education_locale';

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili' },
  { value: 'sn', label: 'Shona' },
  { value: 'zu', label: 'Zulu' },
  { value: 'nd', label: 'Ndebele' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
];

const categoryTabs = [
  { label: 'All' },
  { label: 'HIV', value: 'hiv' },
  { label: 'TB', value: 'tb' },
  { label: 'Maternal', value: 'maternal' },
  { label: 'Diabetes', value: 'diabetes' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Mental Health', value: 'mental_health' },
  { label: 'General', value: 'general' },
];

interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  target_audience?: string;
  completed_lessons?: number;
  total_lessons?: number;
  progressPct?: number;
  completed_at?: string | null;
}

const HealthEducationPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const { showError } = useNotification();

  const [enrolled, setEnrolled] = useState<Course[]>([]);
  const [browsable, setBrowsable] = useState<Course[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [language, setLanguage] = useState(() => localStorage.getItem(LOCALE_STORAGE_KEY) || 'en');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCourses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await patientPortalApi.getMyEducationCourses(token, tenantSlug, language);
      setEnrolled(res?.enrolled ?? []);
      setBrowsable(res?.browsable ?? []);
    } catch (err: any) {
      showError('Could not load education courses', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug, language, showError]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, language);
    loadCourses();
  }, [loadCourses, language]);

  const filterCourses = (courses: Course[]) => {
    const q = search.toLowerCase();
    return courses.filter((c) => {
      const matchSearch = !q || c.title.toLowerCase().includes(q);
      const matchCat = !activeCategory || c.category?.toLowerCase() === activeCategory;
      return matchSearch && matchCat;
    });
  };

  const filteredEnrolled = useMemo(() => filterCourses(enrolled), [enrolled, search, activeCategory]);
  const filteredBrowsable = useMemo(() => filterCourses(browsable), [browsable, search, activeCategory]);

  const openCourse = (courseId: string) => {
    navigate(`/${tenantSlug}/education/${courseId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Link
                to={`/${tenantSlug}/dashboard`}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Health Education</h1>
                <p className="text-sm text-gray-600">Trusted health information in your language</p>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-white border border-gray-200 rounded-full px-3 py-2 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {languageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="relative mt-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses"
              className="bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 w-full text-sm placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pt-4 pb-1">
            {categoryTabs.map((tab) => {
              const active = activeCategory === tab.value;
              return (
                <button
                  key={tab.label}
                  onClick={() => setActiveCategory(tab.value)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-40" />
            ))}
          </div>
        ) : (
          <>
            {/* Enrolled courses */}
            {filteredEnrolled.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-700 mb-3">My Courses</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredEnrolled.map((course) => {
                    const pct = course.progressPct ?? 0;
                    return (
                      <button
                        key={course.id}
                        onClick={() => openCourse(course.id)}
                        className="text-left bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-emerald-200 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {course.category ?? 'general'}
                          </span>
                          {course.completed_at && (
                            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                              Complete ✓
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{course.title}</h3>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{course.completed_lessons ?? 0}/{course.total_lessons ?? 0} lessons</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end mt-3">
                          <ArrowRight className="w-4 h-4 text-emerald-600" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Browsable courses */}
            {filteredBrowsable.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-700 mb-3">Explore Courses</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBrowsable.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => openCourse(course.id)}
                      className="text-left bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all"
                    >
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {course.category ?? 'general'}
                      </span>
                      <h3 className="text-base font-semibold text-gray-900 mt-2 line-clamp-2">{course.title}</h3>
                      {course.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{course.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-indigo-600 font-semibold">Start Course</span>
                        <ArrowRight className="w-4 h-4 text-indigo-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {filteredEnrolled.length === 0 && filteredBrowsable.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="w-10 h-10 text-emerald-400" />
                </div>
                <p className="text-gray-900 font-semibold text-lg">No courses found</p>
                <p className="text-gray-500 text-sm mt-1">Try a different category or language.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default HealthEducationPage;
