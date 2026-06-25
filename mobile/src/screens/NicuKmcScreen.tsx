import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Icon } from '../components/ui/Icon';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function NicuKmcScreen({ route }: { route: any }) {
  const { admissionId, patientName } = route.params;
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [startedAt, setStartedAt]   = useState<Date | null>(null);
  const [saving, setSaving]         = useState(false);

  async function handleStart() {
    setSaving(true);
    try {
      const r: any = await api.post(`/nicu/admissions/${admissionId}/kmc/start`, {});
      setSessionId(r.data?.id ?? r.id);
      setStartedAt(new Date());
      Alert.alert('KMC Started', 'Session timer started. Tap "End KMC" when done.');
    } catch {
      Alert.alert('Error', 'Could not start KMC session.');
    } finally { setSaving(false); }
  }

  async function handleStop() {
    if (!sessionId) return;
    setSaving(true);
    try {
      await api.patch(`/nicu/kmc/${sessionId}/stop`, { fedDuringKmc: false });
      const mins = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 60000) : 0;
      Alert.alert('KMC Ended', `Session recorded: ${mins} minutes.`);
      setSessionId(null);
      setStartedAt(null);
    } catch {
      Alert.alert('Error', 'Could not stop KMC session.');
    } finally { setSaving(false); }
  }

  return (
    <View style={s.container}>
      <Icon name="heart" size={32} color={C.coral} />
      <Text style={s.heading}>Kangaroo Mother Care</Text>
      <Text style={s.sub}>{patientName}</Text>

      {startedAt && (
        <View style={s.timerCard}>
          <Text style={s.timerLabel}>Session in progress</Text>
          <Text style={s.timerValue}>
            Started {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.btn, sessionId ? s.btnStop : s.btnStart, saving && { opacity: 0.5 }]}
        onPress={sessionId ? handleStop : handleStart}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>{sessionId ? 'End KMC' : 'Start KMC'}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading:    { fontFamily: FONT.uiBd, fontSize: 24, color: C.text, marginBottom: 4 },
  sub:        { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary, marginBottom: 32 },
  timerCard:  { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 20, alignItems: 'center', marginBottom: 24, ...SHADOW.teal, width: '100%' },
  timerLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.teal, marginBottom: 4 },
  timerValue: { fontFamily: FONT.mono, fontSize: 18, color: C.text },
  btn:        { borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  btnStart:   { backgroundColor: C.teal },
  btnStop:    { backgroundColor: C.coral },
  btnText:    { fontFamily: FONT.uiBd, fontSize: 16, color: '#fff' },
});
