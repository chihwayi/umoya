import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { voiceApi } from '../services/api';
import type { ClinicalStructuredData } from '../types/voice';

type Phase = 'idle' | 'recording' | 'transcribing' | 'parsing' | 'done' | 'error';

interface Props {
  language?: string;
  patientId?: string;
  encounterId?: string;
  onParsed?: (structured: ClinicalStructuredData, transcript: string) => void;
}

export function VoiceDictationFab({ language = 'en', patientId, encounterId, onParsed }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setErrorMsg(t('voice.error_mic'));
        setPhase('error');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setPhase('recording');
    } catch {
      setErrorMsg(t('voice.error_mic'));
      setPhase('error');
    }
  }, [t]);

  const stopAndProcess = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setPhase('transcribing');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('no uri');

      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

      const { data: transcribeResult } = await voiceApi.transcribe(audioBase64, language, { patientId, encounterId });

      setPhase('parsing');
      const { data: structured } = await voiceApi.parseClinical(transcribeResult.transcriptId, transcribeResult.text);

      setPhase('done');
      onParsed?.(structured, transcribeResult.text);

      setTimeout(() => setPhase('idle'), 2000);
    } catch {
      setErrorMsg(t('voice.error_generic'));
      setPhase('error');
    }
  }, [language, patientId, encounterId, onParsed, t]);

  const handlePress = useCallback(() => {
    if (phase === 'idle' || phase === 'done' || phase === 'error') startRecording();
    else if (phase === 'recording') stopAndProcess();
  }, [phase, startRecording, stopAndProcess]);

  const fabColor =
    phase === 'recording' ? C.red :
    phase === 'done' ? C.green :
    phase === 'error' ? C.amber :
    C.teal;

  const label =
    phase === 'recording' ? t('voice.tap_to_stop') :
    phase === 'transcribing' ? t('voice.transcribing') :
    phase === 'parsing' ? t('voice.parsing') :
    phase === 'done' ? t('voice.review_notice') :
    phase === 'error' ? (errorMsg ?? t('voice.error_generic')) :
    t('voice.tap_to_dictate');

  const busy = phase === 'transcribing' || phase === 'parsing';

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.fab, { backgroundColor: fabColor }, SHADOW.sm]}
        onPress={handlePress}
        disabled={busy}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={C.text} size="small" />
        ) : (
          <Text style={styles.icon}>{phase === 'recording' ? '⏹' : '🎙'}</Text>
        )}
      </Pressable>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: C.textMuted,
    textAlign: 'center',
    maxWidth: 120,
  },
});
