import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Baby, LogOut, ArrowLeft, BookOpen, X, ArrowRight } from 'lucide-react';
import MaternityDoctorView from '../components/MaternityDoctorView';
import { GuidelineSearchPanel } from '../components/GuidelineSearchPanel';
import { SmartFormsFloatingButton } from '../components/WHOSmartForms';
import { ehrApi } from '../services/api';
import ModalPortal from '../components/ModalPortal';

interface MaternityDoctorDashboardProps {
  embedded?: boolean;
}

const MaternityDoctorDashboard: React.FC<MaternityDoctorDashboardProps> = ({ embedded = false }) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // AI/RAG State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  const handleBack = () => {
    navigate(`/ehr/${tenantSlug}/doctor`);
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    navigate(`/ehr/${tenantSlug}`);
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen '}bg-gradient-to-br from-pink-50 via-white to-rose-50`}>
      {!embedded && (
      <div className="bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-3 bg-white/20 rounded-xl">
                <Baby className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Maternity & Obstetrics</h1>
                <p className="text-pink-100 mt-1">High-Risk Cases & Referrals</p>
              </div>
            </div>

            {/* AI Guideline Toggle */}
            <button
              onClick={() => setShowGuidelineSearch(true)}
              className="p-2 mr-4 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center space-x-2"
              title="AI Clinical Guidelines"
            >
              <BookOpen className="w-5 h-5" />
              <span className="hidden md:inline font-medium">Guidelines</span>
            </button>

            {/* User Menu */}
            {currentUser && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="font-semibold">{currentUser.firstName} {currentUser.lastName}</p>
                  <p className="text-sm text-pink-200">{currentUser.role}</p>
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
      )}

      {/* AI Guideline Search Modal */}
      {showGuidelineSearch && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-white to-pink-50 rounded-3xl shadow-2xl border border-pink-200/50 flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="sticky top-0 bg-gradient-to-r from-pink-600 to-rose-700 px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Maternity Clinical Guidelines</h3>
                    <p className="text-sm text-pink-100">AI-powered obstetric protocols & WHO guidelines</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuidelineSearch(false)}
                  className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <GuidelineSearchPanel
                  searchFn={(q) => ehrApi.searchGuidelines(`Maternity, Obstetrics, WHO ANC/PNC guidelines: ${q}`, localStorage.getItem('ehr_token')!, tenantSlug!)}
                  contextLabel="Maternity"
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MaternityDoctorView
          tenantSlug={tenantSlug!}
          token={localStorage.getItem('ehr_token') || ''}
        />
      </div>

      {/* WHO Smart Forms Floating Button */}
      <SmartFormsFloatingButton
        token={localStorage.getItem('ehr_token') || ''}
        tenantSlug={tenantSlug!}
        moduleFilter="maternity"
        position="bottom-right"
      />
    </div>
  );
};

export default MaternityDoctorDashboard;
