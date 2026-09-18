import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  LiveKitRoom,
  useTracks,
  useLocalParticipant,
  useRemoteParticipants,
  useConnectionState,
  VideoTrack,
  isTrackReference,
} from '@livekit/react-native';
import { Track, ConnectionState } from 'livekit-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon } from '../ui/Icon';

interface NativeCallStageProps {
  serverUrl: string;
  token: string;
  remoteName?: string;
  onEnd: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const CallInner: React.FC<{ remoteName?: string; onEnd: () => void }> = ({ remoteName, onEnd }) => {
  const insets = useSafeAreaInsets();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();

  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const remoteCamera = tracks.find(t => isTrackReference(t) && !t.participant.isLocal);
  const localCamera = tracks.find(t => isTrackReference(t) && t.participant.isLocal);

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

  const connected = connectionState === ConnectionState.Connected;

  return (
    <View style={nc.stage}>
      {/* Main tile */}
      {remoteCamera ? (
        <VideoTrack trackRef={remoteCamera} style={nc.mainVideo} />
      ) : (
        <View style={nc.waiting}>
          <View style={nc.waitingRing}>
            <Icon name="telehealth" size={36} color="#c4b5fd" />
          </View>
          <Text style={nc.waitingText}>
            {remoteParticipants.length > 0
              ? 'Connecting video…'
              : `Waiting for ${remoteName || 'the other participant'} to join…`}
          </Text>
        </View>
      )}

      {/* Self-view PIP */}
      {localCamera && (
        <View style={nc.pip}>
          <VideoTrack trackRef={localCamera} style={nc.pipVideo} mirror />
        </View>
      )}

      {/* Top status chip */}
      <View style={[nc.topOverlay, { top: insets.top + 12 }]}>
        <View style={[nc.chip, connected ? nc.chipGood : nc.chipConnecting]}>
          <Text style={nc.chipText}>{connected ? formatDuration(elapsed) : 'Connecting…'}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={[nc.controls, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[nc.btn, !isMicrophoneEnabled && nc.btnOff]}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          <Icon name={isMicrophoneEnabled ? 'pulse' : 'escalate'} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[nc.btn, !isCameraEnabled && nc.btnOff]}
          onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          <Icon name={isCameraEnabled ? 'telehealth' : 'rounds'} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={nc.btnEnd} onPress={onEnd}>
          <Icon name="escalate" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const NativeCallStage: React.FC<NativeCallStageProps> = ({ serverUrl, token, remoteName, onEnd }) => {
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio
      video
      onDisconnected={onEnd}
    >
      <CallInner remoteName={remoteName} onEnd={onEnd} />
    </LiveKitRoom>
  );
};

const nc = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#0b0620' },
  mainVideo: { flex: 1 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  waitingRing: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(196,181,253,0.35)',
  },
  waitingText: { fontFamily: FONT.uiMd, fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  pip: {
    position: 'absolute', bottom: 110, right: 20, width: 110, height: 150,
    borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)',
    ...SHADOW.heavy,
  },
  pipVideo: { flex: 1 },
  topOverlay: { position: 'absolute', left: 16, right: 16, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.pill, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipGood: {},
  chipConnecting: {},
  chipText: { fontFamily: FONT.uiBd, fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    paddingTop: 16, backgroundColor: 'rgba(15,8,33,0.55)',
  },
  btn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  btnOff: { backgroundColor: 'rgba(239,68,68,0.85)' },
  btnEnd: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.red, ...SHADOW.heavy,
  },
});
