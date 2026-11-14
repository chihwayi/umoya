import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader, Lock, Stethoscope, Users } from 'lucide-react';
import { useNotification } from '../components/GlobalNotification';
import { clinicianNetworkApi } from '../services/api';
import { CnPanel, cnErrorMessage } from '../utils/clinicianNetwork';

// S287 — Panel directory: panels the doctor joined + browsable open panels.
const ClinicianNetworkDirectory: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const [panels, setPanels] = useState<CnPanel[]>([]);
  const [handle, setHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [inviteTokens, setInviteTokens] = useState<Record<string, string>>({});

  const token = localStorage.getItem('ehr_token') || '';

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    if (!tenantSlug || !token) return;
    setLoading(true);
    try {
      const [me, list] = await Promise.all([
        clinicianNetworkApi.getMe(token, tenantSlug).catch(() => ({ data: null })),
        clinicianNetworkApi.listPanels(token, tenantSlug),
      ]);
      setPanels(Array.isArray(list.data) ? list.data : []);
      setHandle(me.data?.displayHandle ?? null);
    } catch (error: any) {
      showError('Could not load panels', cnErrorMessage(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (panel: CnPanel) => {
    if (!tenantSlug || !token) return;
    setJoiningId(panel.id);
    try {
      await clinicianNetworkApi.joinPanel(
        panel.id,
        { inviteToken: inviteTokens[panel.id]?.trim() || undefined },
        token,
        tenantSlug,
      );
      showSuccess('Joined panel', `You joined ${panel.name}.`);
      await load();
    } catch (error: any) {
      showError('Could not join panel', cnErrorMessage(error, 'Please try again.'));
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const joined = panels.filter((p) => p.isJoined);
  const browse = panels.filter((p) => !p.isJoined);

  const renderPanel = (panel: CnPanel) => (
    <div key={panel.id} className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {panel.visibility === 'invite' ? (
              <Lock className="h-4 w-4 text-slate-500" />
            ) : (
              <Stethoscope className="h-4 w-4 text-slate-500" />
            )}
            <h3 className="font-semibold text-slate-900">{panel.name}</h3>
          </div>
          <p className="text-sm text-slate-600 mt-1">{panel.specialty}</p>
          {panel.description && <p className="text-sm text-slate-500 mt-1">{panel.description}</p>}
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Users className="h-3 w-3" /> {panel.memberCount} members · {panel.topicCount} topics ·{' '}
            {panel.visibility === 'open' ? 'Open' : 'Invite only'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {panel.isJoined ? (
            <Link
              to={`/ehr/${tenantSlug}/clinician-network/panels/${panel.id}`}
              className="text-sm font-medium text-teal-700 hover:text-teal-800 border border-teal-600 rounded px-3 py-1.5"
            >
              Open
            </Link>
          ) : panel.visibility === 'open' ? (
            <button
              onClick={() => handleJoin(panel)}
              disabled={joiningId === panel.id}
              className="text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded px-3 py-1.5 disabled:opacity-50"
            >
              {joiningId === panel.id ? 'Joining…' : 'Join panel'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={inviteTokens[panel.id] ?? ''}
                onChange={(e) => setInviteTokens((t) => ({ ...t, [panel.id]: e.target.value }))}
                placeholder="Invite token"
                className="text-sm border border-slate-300 rounded px-2 py-1.5 w-32"
              />
              <button
                onClick={() => handleJoin(panel)}
                disabled={joiningId === panel.id}
                className="text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded px-3 py-1.5 disabled:opacity-50"
              >
                Request to join
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Clinician Network</h1>
        <p className="text-sm text-slate-600 mt-1">
          Anonymous-to-panel case discussions with doctors at other clinics.
          {handle ? (
            <>
              {' '}You post as <span className="font-semibold text-slate-800">{handle}</span>.
            </>
          ) : (
            <> Your posting handle is created when you join your first panel.</>
          )}
        </p>

        <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-3">My panels</h2>
        {joined.length === 0 ? (
          <p className="text-sm text-slate-500">You have not joined any panels yet.</p>
        ) : (
          <div className="space-y-3">{joined.map(renderPanel)}</div>
        )}

        <h2 className="text-lg font-semibold text-slate-900 mt-8 mb-3">Browse panels</h2>
        {browse.length === 0 ? (
          <p className="text-sm text-slate-500">No other panels available.</p>
        ) : (
          <div className="space-y-3">{browse.map(renderPanel)}</div>
        )}
      </div>
    </div>
  );
};

export default ClinicianNetworkDirectory;
