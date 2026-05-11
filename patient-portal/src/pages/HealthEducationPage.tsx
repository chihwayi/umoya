import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronLeft, Copy, FileText, Image, PlayCircle, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { useTenantSlug } from '../hooks/useTenantSlug';
import { patientPortalApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

type EducationContentType = 'article' | 'video' | 'infographic' | string;

type EducationArticle = {
  id: string;
  title: string;
  category?: string;
  contentType?: EducationContentType;
  body?: string;
  language?: string;
  tags?: string[] | string | null;
  isPublished?: boolean;
  createdAt?: string;
};

type CategoryTab = {
  label: string;
  value?: string;
};

const PAGE_SIZE = 12;
const LOCALE_STORAGE_KEY = 'patient_education_locale';

const languageOptions = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'sw', label: 'Swahili', flag: '🇹🇿' },
  { value: 'sn', label: 'Shona', flag: '🇿🇼' },
  { value: 'zu', label: 'Zulu', flag: '🇿🇦' },
  { value: 'nd', label: 'Ndebele', flag: '🇿🇼' },
  { value: 'af', label: 'Afrikaans', flag: '🇿🇦' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
  { value: 'pt', label: 'Portuguese', flag: '🇵🇹' },
];

const categoryTabs: CategoryTab[] = [
  { label: 'All' },
  { label: 'Heart Health', value: 'cardiology' },
  { label: 'Diabetes', value: 'diabetes' },
  { label: 'HIV & Infectious', value: 'hiv' },
  { label: 'Maternal', value: 'maternal' },
  { label: 'Medications', value: 'pharmacy' },
  { label: 'Mental Health', value: 'mental_health' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'General', value: 'general' },
];

const contentTypeStyles: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  article: { label: 'Article', className: 'bg-blue-50 text-blue-700 border-blue-100', icon: FileText },
  video: { label: 'Video', className: 'bg-red-50 text-red-700 border-red-100', icon: PlayCircle },
  infographic: { label: 'Infographic', className: 'bg-orange-50 text-orange-700 border-orange-100', icon: Image },
};

const normalizeArticles = (payload: any): EducationArticle[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.articles)) return payload.articles;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizeTags = (tags: EducationArticle['tags']): string[] => {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
};

const titleCaseCategory = (category?: string) => {
  if (!category) return 'General';
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatDate = (value?: string) => {
  if (!value) return 'Recently published';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return 'Recently published';
  }
};

const getLanguageMeta = (language?: string) => languageOptions.find((option) => option.value === language) || languageOptions[0];

const HealthEducationPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = useTenantSlug();
  const navigate = useNavigate();
  const { articleId } = useParams<{ articleId?: string }>();
  const { showError, showSuccess } = useNotification();

  const [articles, setArticles] = useState<EducationArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<EducationArticle | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [language, setLanguage] = useState(() => localStorage.getItem(LOCALE_STORAGE_KEY) || 'en');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [articleLoading, setArticleLoading] = useState(false);

  const loadArticles = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const payload = await patientPortalApi.getEducationContent(token, tenantSlug, {
        category: activeCategory,
        language,
        limit: PAGE_SIZE,
        offset: 0,
        search: debouncedSearch,
      });
      setArticles(normalizeArticles(payload));
    } catch (err: any) {
      showError('Could not load education content', err.message || 'Please try again.');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, debouncedSearch, language, showError, tenantSlug, token]);

  const openArticle = useCallback(async (article: EducationArticle | string, updateUrl = true) => {
    if (!token) return;

    const id = typeof article === 'string' ? article : article.id;
    const initialArticle = typeof article === 'string' ? articles.find((item) => item.id === article) || null : article;
    setSelectedArticle(initialArticle);

    if (updateUrl) {
      navigate(`/${tenantSlug}/education/${id}`, { replace: false });
    }

    if (initialArticle?.body) return;

    setArticleLoading(true);
    try {
      const payload = await patientPortalApi.getEducationArticle(id, token, tenantSlug);
      setSelectedArticle(payload);
    } catch (err: any) {
      showError('Could not load article', err.message || 'Please try again.');
      setSelectedArticle(null);
      if (updateUrl || articleId) navigate(`/${tenantSlug}/education`, { replace: true });
    } finally {
      setArticleLoading(false);
    }
  }, [articleId, articles, navigate, showError, tenantSlug, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, language);
    setVisibleCount(PAGE_SIZE);
    loadArticles();
  }, [loadArticles, language]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, debouncedSearch, language]);

  useEffect(() => {
    if (articleId && !selectedArticle && !articleLoading) {
      openArticle(articleId, false);
    }
  }, [articleId, articleLoading, openArticle, selectedArticle]);

  const filteredArticles = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    if (!query) return articles;

    return articles.filter((article) => {
      const tags = normalizeTags(article.tags).join(' ').toLowerCase();
      return article.title.toLowerCase().includes(query) || tags.includes(query);
    });
  }, [articles, debouncedSearch]);

  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredArticles.length;

  const closeArticle = () => {
    setSelectedArticle(null);
    navigate(`/${tenantSlug}/education`, { replace: true });
  };

  const shareArticle = async () => {
    if (!selectedArticle) return;

    const url = `${window.location.origin}/${tenantSlug}/education/${selectedArticle.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showSuccess('Link copied', 'Article URL copied to clipboard.');
    } catch {
      showError('Could not copy link', 'Please copy the address from your browser.');
    }
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
              onChange={(event) => setLanguage(event.target.value)}
              className="bg-white border border-gray-200 rounded-full px-3 py-2 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative mt-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search articles or tags"
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

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse bg-gray-100 rounded-2xl h-40" />
            ))}
          </div>
        ) : visibleArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-emerald-400" />
            </div>
            <p className="text-gray-900 font-semibold text-lg">No articles found</p>
            <p className="text-gray-500 text-sm mt-1">Try a different category or language.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleArticles.map((article) => {
                const normalizedType = (article.contentType || 'article').toLowerCase();
                const typeStyle = contentTypeStyles[normalizedType] || contentTypeStyles.article;
                const TypeIcon = typeStyle.icon;
                const tags = normalizeTags(article.tags).slice(0, 3);

                return (
                  <button
                    key={article.id}
                    onClick={() => openArticle(article)}
                    className="text-left bg-white rounded-2xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${typeStyle.className}`}>
                          <TypeIcon className="w-3.5 h-3.5" />
                          {typeStyle.label}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {titleCaseCategory(article.category)}
                        </span>
                      </div>
                    </div>
                    <h2 className="text-base font-semibold text-gray-900 mt-2 line-clamp-2">{article.title}</h2>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-5">
                      <span className="text-xs text-gray-400">{formatDate(article.createdAt)}</span>
                      <ArrowRight className="w-4 h-4 text-emerald-600" />
                    </div>
                  </button>
                );
              })}
            </div>

            {canLoadMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {(selectedArticle || articleLoading) && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4 md:hidden" />
            <div className="flex items-start justify-between gap-4 px-6 pt-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedArticle?.title || 'Loading article'}
                </h2>
                {selectedArticle && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {titleCaseCategory(selectedArticle.category)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getLanguageMeta(selectedArticle.language || language).flag} {getLanguageMeta(selectedArticle.language || language).label}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(selectedArticle.createdAt)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={closeArticle}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {articleLoading && !selectedArticle?.body ? (
              <div className="px-6 pb-8 mt-4 space-y-3">
                <div className="animate-pulse bg-gray-100 rounded-xl h-4 w-full" />
                <div className="animate-pulse bg-gray-100 rounded-xl h-4 w-11/12" />
                <div className="animate-pulse bg-gray-100 rounded-xl h-4 w-4/5" />
              </div>
            ) : (
              <div
                className="text-sm text-gray-700 leading-relaxed px-6 pb-8 mt-4 space-y-3"
                dangerouslySetInnerHTML={{ __html: selectedArticle?.body || '' }}
              />
            )}

            {selectedArticle && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
                <button
                  onClick={shareArticle}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Share article
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthEducationPage;
