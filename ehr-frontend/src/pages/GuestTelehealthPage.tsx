import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Video, AlertCircle } from 'lucide-react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles/components';
import { TelehealthCallStage } from '../components/telemedicine/TelehealthCallStage';
import { ehrApi } from '../services/api';

const GuestTelehealthPage: React.FC = () => {
  const { tenantSlug, consultationId, guestToken } = useParams<{
    tenantSlug: string; consultationId: string; guestToken: string;
  }>();

  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<{ token: string; meetingUrl: string } | null>(null);
  const [ended, setEnded] = useState(false);

  const handleJoin = async () => {
    if (!consultationId || !guestToken || !tenantSlug) return;
    setJoining(true);
    setError(null);
    try {
      const res = await ehrApi.joinTelemedicineAsGuest(consultationId, guestToken, name.trim() || 'Guest', tenantSlug);
      setAccess({ token: res.data.token, meetingUrl: res.data.meetingUrl });
    } catch (err: any) {
      setError(err.response?.data?.message || 'This guest link is invalid or has expired.');
    } finally {
      setJoining(false);
    }
  };

  if (ended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
        <div className="text-center">
          <Video className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Call ended</h1>
          <p className="text-white/60">You can close this window now.</p>
        </div>
      </div>
    );
  }

  if (access) {
    return (
      <div className="h-screen w-screen bg-black">
        <LiveKitRoom
          token={access.token}
          serverUrl={access.meetingUrl}
          connect
          audio
          video
          onDisconnected={() => setEnded(true)}
          style={{ height: '100%' }}
        >
          <TelehealthCallStage
            isRecording={false}
            recordingBusy={false}
            onToggleRecording={() => {}}
            canControlRecording={false}
            onLeave={() => setEnded(true)}
          />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-white/10">
        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
          <Video className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Join Video Consultation</h1>
        <p className="text-white/60 mb-6 text-sm">
          You've been invited to a secure Umoya telehealth call. Enter your name to join.
        </p>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          maxLength={60}
          className="w-full px-4 py-3 mb-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2"
        >
          <Video className="w-5 h-5" />
          {joining ? 'Connecting…' : 'Join Call'}
        </button>

        <p className="text-white/30 text-xs mt-6">
          This link only works for this one call and expires automatically. Umoya — secure, self-hosted telehealth.
        </p>
      </div>
    </div>
  );
};

export default GuestTelehealthPage;
