import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, LogOut, Activity, Camera, CalendarDays } from 'lucide-react';
import TechnologistImagingWorklist from '../components/TechnologistImagingWorklist';

const TechnologistImagingDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = React.useState<any | null>(null);

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
    </div>
  );
};

export default TechnologistImagingDashboard;


