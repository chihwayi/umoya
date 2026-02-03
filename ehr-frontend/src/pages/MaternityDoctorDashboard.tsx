import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Baby, LogOut, ArrowLeft, Search, BookOpen, X, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import MaternityDoctorView from '../components/MaternityDoctorView';
import { SmartFormsFloatingButton } from '../components/WHOSmartForms';
import { cdssApi } from '../services/api';
import { GuidelineResult } from '../types/guidelines';
import ModalPortal from '../components/ModalPortal';

const MaternityDoctorDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // AI/RAG State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [guidelineResults, setGuidelineResults] = useState<GuidelineResult[]>([]);

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

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    
    setLoadingGuidelines(true);
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) {
         return;
      }

      // Add context for maternity
      const searchContext = "Maternity, Obstetrics, WHO ANC/PNC guidelines";
      const finalQuery = `${searchContext}: ${guidelineQuery}`;

      const response = await cdssApi.searchGuidelines(finalQuery, token, tenantSlug);
      if (response.data && response.data.citations) {
        setGuidelineResults(response.data.citations);
      } else {
        setGuidelineResults([]);
      }
    } catch (error) {
      console.error('Error searching guidelines:', error);
    } finally {
      setLoadingGuidelines(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
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
              
              <div className="p-6 border-b border-pink-100 bg-white">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
                  <input
                    type="text"
                    value={guidelineQuery}
                    onChange={(e) => setGuidelineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                    placeholder="Search WHO guidelines, complication protocols (e.g., 'Severe Pre-eclampsia', 'PPH management')..."
                    className="w-full pl-12 pr-24 py-4 bg-pink-50/50 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all text-lg placeholder:text-slate-400"
                    autoFocus
                  />
                  <button
                    onClick={handleGuidelineSearch}
                    disabled={loadingGuidelines || !guidelineQuery.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {loadingGuidelines ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        Search <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {guidelineResults.length > 0 ? (
                  <div className="space-y-4">
                    {guidelineResults.map((result, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100 hover:shadow-md transition-shadow group">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-slate-900 leading-tight flex items-center gap-2">
                            <div className="w-1 h-6 bg-pink-500 rounded-full"></div>
                            {result.source || 'Clinical Guideline'}
                          </h4>
                          {result.confidence && (
                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                              result.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              result.confidence > 0.5 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {Math.round(result.confidence * 100)}% Match
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap mb-4 pl-3">{result.text}</p>
                        
                        {result.recommendation && (
                          <div className="mb-4 ml-3 p-4 bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-100 rounded-xl">
                            <h5 className="text-xs font-bold text-pink-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                              <Sparkles className="w-3 h-3" />
                              Key Recommendation
                            </h5>
                            <p className="text-sm font-medium text-slate-800">{result.recommendation}</p>
                          </div>
                        )}

                        {result.url && (
                          <div className="ml-3 flex justify-end">
                            <a 
                              href={result.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center text-sm font-medium text-pink-600 hover:text-pink-700 hover:underline bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              View Source Protocol <ArrowRight className="w-4 h-4 ml-1.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mb-6">
                      <Search className="w-10 h-10 text-pink-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Search Clinical Guidelines</h3>
                    <p className="max-w-md mx-auto text-slate-500">
                      Access evidence-based maternity protocols, WHO guidelines, and complication management strategies.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-white text-xs text-center text-slate-500 flex items-center justify-center gap-2">
                <Sparkles className="w-3 h-3 text-pink-400" />
                <span>AI-assisted results. Always verify with standard clinical protocols.</span>
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

