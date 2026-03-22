import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Camera, CalendarDays, BookOpen, Search, X, Loader2, Settings, LayoutDashboard, Brain } from 'lucide-react';
import { GuidelineResult } from '../types/guidelines';
import { cdssApi } from '../services/api';
import GuidelineCitationCard from '../components/GuidelineCitationCard';
import TechnologistImagingWorklist from '../components/TechnologistImagingWorklist';
import AdminNavigationShell from '../components/AdminNavigationShell';

const TechnologistImagingDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
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

  const tenantBasePath = `/ehr/${tenantSlug}`;

  return (
    <AdminNavigationShell
      title="Technologist Imaging"
      subtitle="Scheduling, acquisition, and handoff queue for imaging operations"
      portalLabel="Imaging technologist workspace"
      headerTone="imaging"
      navigationItems={[
        { key: 'dashboard', label: 'Dashboard', path: `${tenantBasePath}/dashboard`, icon: LayoutDashboard, exact: true },
        { key: 'imaging-tech', label: 'Imaging Queue', path: `${tenantBasePath}/technologist/imaging`, icon: Camera, exact: true },
        { key: 'settings', label: 'Profile Settings', path: `${tenantBasePath}/settings`, icon: Settings, exact: true },
      ]}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-2xl border border-sky-200/70 bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-700 font-semibold">Technologist Control</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Imaging Workflow Studio</h2>
              <p className="text-sm text-slate-600 mt-1">
                Fast queue execution with AI protocol lookup and clean handoffs to radiologist interpretation.
              </p>
            </div>
            <button
              onClick={() => setShowGuidelineSearch(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 transition"
            >
              <Brain className="w-4 h-4" />
              Imaging Guidelines
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                accent: 'from-sky-400/20 to-blue-500/10',
              },
              {
                label: 'Schedule Density',
                description: 'Today’s time blocks',
                icon: CalendarDays,
                accent: 'from-indigo-400/20 to-violet-500/10',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent}`} />
                <div className="relative flex items-center gap-4 p-4">
                  <div className="p-3 rounded-2xl bg-white/80 text-slate-700">
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                    <p className="text-slate-800 font-medium">{stat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
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
                      <GuidelineCitationCard key={index} result={result} index={index} dark />
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
    </AdminNavigationShell>
  );
};

export default TechnologistImagingDashboard;
