import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
  useConnectionState,
  useIsRecording,
  ParticipantTile,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, ScreenShare, ScreenShareOff,
  PhoneOff, Circle, Square, User, Wifi, WifiOff,
} from 'lucide-react';
import './TelehealthCallStage.css';

interface TelehealthCallStageProps {
  remoteName?: string;
  isRecording: boolean;
  recordingBusy: boolean;
  onToggleRecording: () => void;
  onLeave: () => void;
  /** Guests can't start/stop recording — only the doctor who owns the call can. */
  canControlRecording?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const TelehealthCallStage: React.FC<TelehealthCallStageProps> = ({
  remoteName, isRecording, recordingBusy, onToggleRecording, onLeave, canControlRecording = true,
}) => {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();
  const liveKitIsRecording = useIsRecording();

  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false },
  );

  const remoteScreenShare = tracks.find(t => !t.participant.isLocal && t.source === Track.Source.ScreenShare);
  const localScreenShare = tracks.find(t => t.participant.isLocal && t.source === Track.Source.ScreenShare);
  const mainScreenShare = remoteScreenShare || localScreenShare;

  const remoteCamera = tracks.find(t => !t.participant.isLocal && t.source === Track.Source.Camera);
  const localCamera = tracks.find(t => t.participant.isLocal && t.source === Track.Source.Camera);

  const mainTrack = mainScreenShare || remoteCamera;
  const hasRemote = remoteParticipants.length > 0;

  // Call duration timer — starts once actually connected.
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    if (!startedAt.current) startedAt.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startedAt.current as number)) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectionState]);

  const quality = connectionState === ConnectionState.Connected ? 'good' : 'connecting';

  return (
    <div className="th-stage">
      <RoomAudioRenderer />

      {/* Main stage */}
      <div className="th-main">
        {mainTrack ? (
          <ParticipantTile trackRef={mainTrack} disableSpeakingIndicator={!!mainScreenShare} className="th-main-tile" />
        ) : (
          <div className="th-waiting">
            <div className="th-waiting-ring">
              <User size={40} color="#c4b5fd" />
            </div>
            <p className="th-waiting-title">
              {hasRemote ? 'Connecting video…' : `Waiting for ${remoteName || 'the other participant'} to join…`}
            </p>
          </div>
        )}
      </div>

      {/* Self-view PIP */}
      {localCamera && !mainScreenShare && (
        <div className="th-pip">
          <ParticipantTile trackRef={localCamera} disableSpeakingIndicator className="th-pip-tile" />
        </div>
      )}

      {/* Top overlay: connection + timer + recording badge */}
      <div className="th-top-overlay">
        <div className={`th-chip th-chip-${quality}`}>
          {quality === 'good' ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{quality === 'good' ? formatDuration(elapsed) : 'Connecting…'}</span>
        </div>
        {(isRecording || liveKitIsRecording) && (
          <div className="th-chip th-chip-rec">
            <span className="th-rec-dot" />
            <span>REC {formatDuration(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Floating control bar */}
      <div className="th-controls">
        <button
          className={`th-btn ${isMicrophoneEnabled ? '' : 'th-btn-off'}`}
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button
          className={`th-btn ${isCameraEnabled ? '' : 'th-btn-off'}`}
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? <VideoIcon size={18} /> : <VideoOff size={18} />}
        </button>
        <button
          className={`th-btn ${isScreenShareEnabled ? 'th-btn-active' : ''}`}
          onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
          title={isScreenShareEnabled ? 'Stop screen share' : 'Share screen'}
        >
          {isScreenShareEnabled ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
        </button>
        {canControlRecording && (
          <button
            className={`th-btn th-btn-record ${isRecording ? 'th-btn-recording' : ''}`}
            onClick={onToggleRecording}
            disabled={recordingBusy}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <Square size={16} fill="currentColor" /> : <Circle size={18} fill="currentColor" />}
          </button>
        )}
        <button className="th-btn th-btn-end" onClick={onLeave} title="End call">
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
};
