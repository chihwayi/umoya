import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, LogOut, Activity, Camera, CalendarDays, BookOpen, Search, X, Loader2 } from 'lucide-react';
import { GuidelineResult } from '../types/guidelines';
import { cdssApi } from '../services/api';
import TechnologistImagingWorklist from '../components/TechnologistImagingWorklist';

const TechnologistImagingDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = React.useState<any | null>(null);

  // AI Protocol Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);
  const [guidelineQuery, setGuidelineQuery] = useState('');
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [guidelineResults, setGuidelineResults] = useState<GuidelineResult[]>([]);

  React.useEffect(() => {
    const stored = localStorage.getItem('ehr_user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  const token = React.useMemo(() => localStorage.getItem('ehr_token') || '', []);

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    navigate(`/ehr/${tenantSlug}`);
  };

  const handleGuidelineSearch = async () => {
    if (!guidelineQuery.trim()) return;
    
    setLoadingGuidelines(true);
    try {
      if (!token || !tenantSlug) return;

      const searchContext = "Radiology, Imaging Protocols, ACR Guidelines, contrast media";
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

  if (!tenantSlug) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-sky-900" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Technologist Control</p>
                <h1 className="text-3xl font-semibold tracking-tight mt-2">Imaging Workflow Studio</h1>
                <p className="text-sm text-white/80 max-w-2xl mt-2">
                  Glide through scheduling, acquisition, and handoffs with a cockpit built for fast-moving imaging teams.
                </p>
              </div>
            </div>

            {currentUser && (
              <div className="flex items-center gap-4 bg-white/10 rounded-2xl px-4 py-3 backdrop-blur">
                <div className="text-sm">
                  <p className="text-white/80">Signed in as</p>
                  <p className="font-semibold">
                    {currentUser.firstName} {currentUser.lastName}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-white/60">{currentUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                label: 'Queue Pulse',
                description: 'Real-time orders feed',
                icon: Activity,
                accent: 'from-emerald-400/20 to-emerald-500/10',
              },
              {
                label: 'Modalities Active',
                description: 'Track studies per scanner',
                icon: Camera,
                accent: 'from-pink-400/20 to-purple-500/10',
              },
              {
                label: 'Schedule Density',
                description: 'Today’s time blocks',
                icon: CalendarDays,
                accent: 'from-sky-400/20 to-blue-500/10',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg shadow-lg"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent}`} />
                <div className="relative flex items-center gap-4 p-4">
                  <div className="p-3 rounded-2xl bg-black/10">
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">{stat.label}</p>
                    <p className="text-white font-medium">{stat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative -mt-10 rounded-t-3xl bg-gradient-to-b from-white to-slate-100 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <TechnologistImagingWorklist tenantSlug={tenantSlug} token={token} currentUser={currentUser} />
        </div>
      </div>

      {/* AI Guideline Search Modal */}
      {showGuidelineSearch && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-900 to-slate-900 border-b border-indigo-500/30 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                  <BookOpen className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Imaging Protocols & Guidelines</h3>
                  <p className="text-sm text-indigo-300">ACR Guidelines & Contrast Protocols</p>
                </div>
              </div>
              <button onClick={() => setShowGuidelineSearch(false)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-hidden flex flex-col h-full bg-slate-950">
              <div className="flex gap-2 mb-6 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={guidelineQuery}
                    onChange={(e) => setGuidelineQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuidelineSearch()}
                    placeholder="Search protocols (e.g., 'CT Abdomen contrast', 'MRI Brain stroke protocol')..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-600"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleGuidelineSearch}
                  disabled={loadingGuidelines || !guidelineQuery.trim()}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loadingGuidelines ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                {loadingGuidelines ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
                    <p>Retrieving protocols...</p>
                  </div>
                ) : guidelineResults.length > 0 ? (
                  <div className="space-y-4">
                    {guidelineResults.map((result, index) => (
                      <div key={index} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-colors">
                        <div className="flex gap-3">
                          <div className="mt-1 min-w-[24px]">
                            <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-sm font-bold border border-indigo-500/20">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-indigo-200 leading-tight">
                                {result.source || 'Protocol/Guideline'}
                              </h4>
                              {result.confidence && (
                                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${
                                  result.confidence > 0.8 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  result.confidence > 0.5 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                  'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                  {Math.round(result.confidence * 100)}% Match
                                </span>
                              )}
                            </div>
                            <div className="prose prose-sm max-w-none text-slate-300 prose-invert">
                              <p className="whitespace-pre-wrap">{result.text}</p>
                              {result.recommendation && (
                                <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                                  <strong className="block text-indigo-300 text-xs uppercase tracking-wide mb-1">Recommendation</strong>
                                  <p className="text-indigo-200 text-sm m-0">{result.recommendation}</p>
                                </div>
                              )}
                            </div>
                            {result.url && (
                              <a 
                                href={result.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center mt-3 text-sm text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                              >
                                View Source Document
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-600">
                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
                      <BookOpen className="w-8 h-8 text-slate-700" />
                    </div>
                    <h4 className="text-lg font-medium text-slate-300 mb-1">No protocols found</h4>
                    <p className="max-w-sm mx-auto">
                      Search for specific imaging protocols, contrast guidelines, or ACR recommendations.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="p-3 border-t border-slate-800 bg-slate-900 text-xs text-center text-slate-500">
                AI-assisted results. Always verify with radiologist or official ACR guidelines.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnologistImagingDashboard;


