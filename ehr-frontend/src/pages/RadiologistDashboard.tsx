import React from 'react';
import { useParams } from 'react-router-dom';
import { Camera, Brain, BookOpen, Search, RefreshCw, Settings, LayoutDashboard } from 'lucide-react';
import RadiologistWorklist from '../components/RadiologistWorklist';
import GuidelineCitationCard from '../components/GuidelineCitationCard';
import ImagingStudyViewerModal from '../components/ImagingStudyViewerModal';
import MedicalVisionPanel from '../components/MedicalVision/MedicalVisionPanel';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import AdminNavigationShell from '../components/AdminNavigationShell';

const RadiologistDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError } = useNotification();

  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [selectedStudyId, setSelectedStudyId] = React.useState<string | null>(null);
  const [studyDetails, setStudyDetails] = React.useState<any | null>(null);
  const [loadingStudy, setLoadingStudy] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  // CDSS State
  const [showGuidelineSearch, setShowGuidelineSearch] = React.useState(false);
  const [showVisionPanel, setShowVisionPanel] = React.useState(false);
  const [guidelineQuery, setGuidelineQuery] = React.useState('');
  const [guidelineResults, setGuidelineResults] = React.useState<any[]>([]);
  const [loadingGuidelines, setLoadingGuidelines] = React.useState(false);

  React.useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

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

  if (!tenantSlug) return null;

  const tenantBasePath = `/ehr/${tenantSlug}`;

  return (
    <AdminNavigationShell
      title="Radiology & Imaging"
      subtitle="Radiologist worklist, reporting, and AI-assisted interpretation support"
      portalLabel="Radiology workspace"
      headerTone="radiology"
      navigationItems={[
        { key: 'dashboard', label: 'Dashboard', path: `${tenantBasePath}/dashboard`, icon: LayoutDashboard, exact: true },
        { key: 'radiology', label: 'Radiology', path: `${tenantBasePath}/radiologist`, icon: Camera, exact: true },
        { key: 'settings', label: 'Profile Settings', path: `${tenantBasePath}/settings`, icon: Settings, exact: true },
      ]}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50 via-indigo-50 to-blue-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-violet-700 font-semibold">Imaging Command</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Radiologist Worklist & Reporting</h2>
              <p className="text-sm text-slate-600 mt-1">
                AI-assisted review supports faster turnaround while preserving clinician validation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGuidelineSearch((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  showGuidelineSearch ? 'bg-violet-600 text-white' : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-50'
                }`}
                title="Toggle Guideline Search"
              >
                <Brain className="w-4 h-4" />
                ACR Guidelines
              </button>
              <button
                onClick={() => setShowVisionPanel(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 transition"
                title="Open Medical Vision AI"
              >
                <Camera className="w-4 h-4" />
                AI Analysis
              </button>
            </div>
          </div>
        </section>

      {/* Guideline Search Panel */}
      {showGuidelineSearch && (
        <div className="bg-white border border-violet-200 rounded-2xl shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-4">
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
                  <GuidelineCitationCard key={index} result={result} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        <RadiologistWorklist
          tenantSlug={tenantSlug}
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
          tenantSlug={tenantSlug}
          token={token}
          onRefresh={handleRefreshStudy}
          isLoading={loadingStudy}
          loadError={loadError}
          currentUser={currentUser}
        />
      )}

      {showVisionPanel && (
        <MedicalVisionPanel
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => setShowVisionPanel(false)}
        />
      )}
      </div>
    </AdminNavigationShell>
  );
};

export default RadiologistDashboard;
