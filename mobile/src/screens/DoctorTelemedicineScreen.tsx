import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import { NativeCallStage } from '../components/telemedicine/NativeCallStage';

interface Consultation {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_number: string;
  status: string;
  scheduled_start_time: string;
  consultation_type: string;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: C.blue, waiting: C.amber, in_progress: C.green,
  active: C.green, completed: C.textMuted, cancelled: C.red, no_show: C.red,
};

// ─── Main screen ────────────────────────────────────────────────────────────

export default function DoctorTelemedicineScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuthStore();
  const pickedPatient = route.params as { patientId?: string; patientName?: string } | undefined;

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [inCall, setInCall]       = useState<{ serverUrl: string; token: string; consultationId: string; patientName?: string } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const load = useCallback(() => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    api.get(`/telemedicine/consultations?doctorId=${user.id}&limit=30`)
      .then((r: any) => setConsultations((r.data ?? r)?.consultations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (pickedPatient?.patientId) setScheduling(true);
  }, [pickedPatient?.patientId]);

  const join = async (c: Consultation) => {
    setConnecting(c.id);
    try {
      await api.post(`/telemedicine/consultations/${c.id}/join`, { userId: user?.id, role: 'doctor' }).catch(() => {});
      const tokenRes: any = await api.get(`/telemedicine/consultations/${c.id}/token?role=doctor`);
      const tokenData = tokenRes.data ?? tokenRes;
      const serverUrl = tokenData?.meetingUrl;
      const token = tokenData?.token;
      if (!serverUrl || !token) throw new Error('missing meeting access');
      setInCall({ serverUrl, token, consultationId: c.id, patientName: c.patient_name });
    } catch {
      Alert.alert('Cannot Join Call', 'Unable to connect to this telehealth session.');
    } finally {
      setConnecting(null);
    }
  };

  const endCall = async () => {
    if (!inCall) return;
    try { await api.post(`/telemedicine/consultations/${inCall.consultationId}/end`, {}); } catch {}
    setInCall(null);
    load();
  };

  const scheduleConsultation = async () => {
    if (!pickedPatient?.patientId || !scheduleDate) {
      Alert.alert('Required', 'Pick a patient and enter a date/time (YYYY-MM-DD HH:mm).');
      return;
    }
    setSavingSchedule(true);
    try {
      const iso = new Date(scheduleDate.replace(' ', 'T')).toISOString();
      await api.post('/telemedicine/consultations', {
        patientId: pickedPatient.patientId,
        doctorId: user?.id,
        consultationType: 'video',
        scheduledStartTime: iso,
      });
      setScheduling(false);
      setScheduleDate('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not schedule consultation.');
    } finally {
      setSavingSchedule(false);
    }
  };

  if (inCall) {
    return (
      <NativeCallStage
        serverUrl={inCall.serverUrl}
        token={inCall.token}
        remoteName={inCall.patientName}
        onEnd={endCall}
      />
    );
  }

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Telemedicine"
        subtitle={loading ? 'Loading…' : `${consultations.length} consultations`}
        accent={C.teal}
        onBack={() => navigation.goBack()}
        rightSlot={
          <TouchableOpacity onPress={() => navigation.navigate('PatientPicker', { targetRoute: 'DoctorTelemedicine', title: 'Schedule Telehealth Call' })}>
            <Icon name="plus" size={20} color={C.teal} />
          </TouchableOpacity>
        }
      />

      {scheduling && pickedPatient?.patientId && (
        <View style={s.scheduleCard}>
          <Text style={s.scheduleTitle}>Schedule call with {pickedPatient.patientName}</Text>
          <TextInput
            style={s.input}
            placeholder="YYYY-MM-DD HH:mm"
            placeholderTextColor={C.textMuted}
            value={scheduleDate}
            onChangeText={setScheduleDate}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[s.primaryBtn, { flex: 1 }]} onPress={scheduleConsultation} disabled={savingSchedule}>
              {savingSchedule ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Schedule</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setScheduling(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.teal} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {consultations.length === 0 ? (
            <Text style={s.empty}>No telehealth consultations scheduled.</Text>
          ) : consultations.map(c => {
            const color = STATUS_COLOR[c.status] ?? C.blue;
            const canJoin = ['scheduled', 'waiting', 'active', 'in_progress'].includes(c.status);
            return (
              <View key={c.id} style={[s.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.patientName}>{c.patient_name ?? 'Patient'}</Text>
                    <Text style={s.meta}>
                      {c.patient_number ?? '—'} · {c.scheduled_start_time ? new Date(c.scheduled_start_time).toLocaleString() : '—'}
                    </Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}50` }]}>
                    <Text style={[s.statusText, { color }]}>{c.status.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>
                {canJoin && (
                  <TouchableOpacity style={s.joinBtn} onPress={() => join(c)} disabled={connecting === c.id}>
                    {connecting === c.id
                      ? <ActivityIndicator color="#fff" />
                      : <><Icon name="telehealth" size={16} color="#fff" /><Text style={s.joinText}>Join Call</Text></>
                    }
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:     { padding: 16, gap: 12, paddingBottom: 40 },
  empty:       { fontFamily: FONT.uiMd, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, borderWidth: 1, borderColor: C.border, gap: 10, ...SHADOW.sm },
  cardRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  patientName: { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  meta:        { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statusPill:  { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontFamily: FONT.uiBd, fontSize: 10, letterSpacing: 0.4 },
  joinBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 11 },
  joinText:    { fontFamily: FONT.uiBd, fontSize: 14, color: '#fff' },
  scheduleCard:{ margin: 16, marginBottom: 0, backgroundColor: C.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
  scheduleTitle: { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  input:       { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, padding: 10, fontFamily: FONT.uiMd, fontSize: 14, color: C.text, backgroundColor: C.card },
  primaryBtn:  { backgroundColor: C.teal, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONT.uiBd, fontSize: 14, color: '#fff' },
  cancelBtn:   { paddingHorizontal: 16, justifyContent: 'center' },
  cancelBtnText: { fontFamily: FONT.uiMd, fontSize: 14, color: C.textMuted },
});
