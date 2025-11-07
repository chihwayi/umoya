import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, LogOut, User } from 'lucide-react';
import RadiologistWorklist from '../components/RadiologistWorklist';
import ImagingStudyViewerModal from '../components/ImagingStudyViewerModal';
import { ehrApi } from '../services/api';
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
        showError('Failed to load study details');
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

