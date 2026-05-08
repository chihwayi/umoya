import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Camera, CalendarDays, BookOpen, X, Settings, LayoutDashboard, Brain } from 'lucide-react';
import { cdssApi, ehrApi } from '../services/api';
import { GuidelineSearchPanel } from '../components/GuidelineSearchPanel';
import TechnologistImagingWorklist from '../components/TechnologistImagingWorklist';
import AdminNavigationShell from '../components/AdminNavigationShell';

const TechnologistImagingDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [currentUser, setCurrentUser] = React.useState<any | null>(null);
  const [draftPostVisitCount, setDraftPostVisitCount] = React.useState(0);

  // AI Protocol Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

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

  React.useEffect(() => {
    if (!tenantSlug || !token) return undefined;

    let cancelled = false;
    const loadDraftSessions = async () => {
      try {
        const response = await ehrApi.listPostVisitSessions(token, tenantSlug, {
          status: 'draft_ready',
          limit: 5,
        });
        if (!cancelled) {
          const data = response.data;
          setDraftPostVisitCount(data?.total ?? data?.sessions?.length ?? 0);
        }
      } catch {
        if (!cancelled) setDraftPostVisitCount(0);
      }
    };

    loadDraftSessions();
    const timer = setInterval(loadDraftSessions, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tenantSlug, token]);

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
        { key: 'imaging-tech', label: 'Imaging Queue', path: `${tenantBasePath}/technologist/imaging`, icon: Camera, exact: true, moduleKey: 'radiology' },
        {
          key: 'post-visit-reviews',
          label: `Post-Visit Reviews${draftPostVisitCount ? ` (${draftPostVisitCount})` : ''}`,
          path: `${tenantBasePath}/post-visit/doctor`,
          icon: BookOpen,
          exact: false,
          moduleKey: 'patient_portal',
        },
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
              <GuidelineSearchPanel
                searchFn={(q) => cdssApi.searchGuidelines(`Medical imaging, radiology technologist: ${q}`, token, tenantSlug!)}
                contextLabel="Imaging Protocols"
                className="h-full bg-slate-900 border-0"
                onMinimize={() => setShowGuidelineSearch(false)}
              />
            </div>
          </div>
        </div>
      )}
    </AdminNavigationShell>
  );
};

export default TechnologistImagingDashboard;
