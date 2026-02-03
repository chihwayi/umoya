import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, LogOut, User, Brain, BookOpen, Search, RefreshCw } from 'lucide-react';
import RadiologistWorklist from '../components/RadiologistWorklist';
import ImagingStudyViewerModal from '../components/ImagingStudyViewerModal';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

const RadiologistDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();

  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [selectedStudyId, setSelectedStudyId] = React.useState<string | null>(null);
  const [studyDetails, setStudyDetails] = React.useState<any | null>(null);
  const [loadingStudy, setLoadingStudy] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = React.useState(false);
  const [guidelineQuery, setGuidelineQuery] = React.useState('');
  const [guidelineResults, setGuidelineResults] = React.useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = React.useState(false);

  React.useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    navigate(`/ehr/${tenantSlug}`);
  };

  const token = React.useMemo(() => localStorage.getItem('ehr_token') || '', []);

  const loadStudyDetails = React.useCallback(
    async (studyId: string) => {
      if (!tenantSlug) return;
      try {
        setLoadingStudy(true);
        setLoadError(false);
        const { data } = await ehrApi.getImagingStudy(tenantSlug, token, studyId);
        setStudyDetails(data);
      } catch (error) {
        console.error('Failed to load study', error);
        showError('Error', 'Failed to load study details');
        setLoadError(true);
      } finally {
        setLoadingStudy(false);
      }
    },
    [showError, tenantSlug, token],
  );

  const handleOpenStudy = React.useCallback(
    async (study: any) => {
      setSelectedStudyId(study.id);
      setStudyDetails(null);
      setViewerOpen(true);
      await loadStudyDetails(study.id);
    },
    [loadStudyDetails],
  );

  const handleRefreshStudy = React.useCallback(async () => {
    if (selectedStudyId) {
      await loadStudyDetails(selectedStudyId);
    }
  }, [loadStudyDetails, selectedStudyId]);

  const handleCloseViewer = React.useCallback(() => {
    setViewerOpen(false);
    setStudyDetails(null);
    setSelectedStudyId(null);
    setLoadError(false);
  }, []);

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) {
        showError('Session Expired', 'Please login again.');
        return;
      }
      
      // Use specific context for Radiology
      const searchContext = "Radiology, medical imaging protocols, ACR appropriateness criteria";
      const finalQuery = `${searchContext}: ${guidelineQuery}`;

      const response = await cdssApi.searchGuidelines(finalQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (e) {
      console.error('Guideline search failed:', e);
      showError('Error', 'Failed to search guidelines');
    } finally {
      setLoadingGuidelines(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Radiology & Imaging</h1>
                <p className="text-purple-100 mt-1">Radiologist Worklist & Reporting</p>
              </div>
            </div>

            {/* User Menu */}
            {currentUser && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
                  className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                    showGuidelineSearch ? 'bg-white text-purple-700 shadow-sm' : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}
                  title="Toggle Guideline Search"
                >
                  <Brain className="w-5 h-5" />
                  <span className="hidden sm:inline text-sm font-medium">ACR Guidelines</span>
                </button>
                <div className="text-right">
                  <p className="font-semibold">{currentUser.firstName} {currentUser.lastName}</p>
                  <p className="text-sm text-purple-200">{currentUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guideline Search Panel */}
      {showGuidelineSearch && (
        <div className="bg-white border-b border-purple-200 shadow-inner animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={guidelineQuery}
                  onChange={(e) => setGuidelineQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                  placeholder="Search ACR Appropriateness Criteria or imaging protocols..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <button
                onClick={handleGuidelineSearch}
                disabled={loadingGuidelines}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingGuidelines ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
                Search Guidelines
              </button>
            </div>

            {guidelineResults.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {guidelineResults.slice(0, 2).map((result: any, index: number) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      {result.source}
                    </h4>
                    <p className="text-sm text-slate-700 mb-2">{result.text}</p>
                    {result.recommendation && (
                      <div className="mt-2 p-2 bg-white border border-purple-100 rounded text-sm text-purple-800">
                        <strong>Recommendation:</strong> {result.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RadiologistWorklist
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
          userId={currentUser?.id}
          onOpenStudy={handleOpenStudy}
        />
      </div>

      {viewerOpen && (
        <ImagingStudyViewerModal
          isOpen={viewerOpen}
          onClose={handleCloseViewer}
          study={loadingStudy ? null : studyDetails}
          tenantSlug={tenantSlug!}
          token={token}
          onRefresh={handleRefreshStudy}
          isLoading={loadingStudy}
          loadError={loadError}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default RadiologistDashboard;

