import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { api } from '../services/api';
import { MessagesService } from '../services/messages';

interface Consultation {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string;
  patient_number: string;
  doctor_name: string;
  status: string;
  scheduled_start_time: string;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: C.blue, waiting: C.amber, in_progress: C.green, active: C.green,
};

// Nurses support and coordinate telehealth (getting patients set up, flagging
// delays) but the telemedicine data model ties a call to exactly one doctor
// participant — there's no nurse-participant role to join the video call itself.
export default function NurseTelemedicineQueueScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems]     = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/telemedicine/consultations?status=waiting&limit=30'),
      api.get('/telemedicine/consultations?status=scheduled&limit=30'),
    ])
      .then(([w, sch]: any[]) => {
        const waiting = (w.data ?? w)?.consultations ?? [];
        const scheduled = (sch.data ?? sch)?.consultations ?? [];
        setItems([...waiting, ...scheduled]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const notifyDoctor = async (c: Consultation) => {
    if (!c.doctor_id) return;
    setNotifying(c.id);
    try {
      await MessagesService.send({
        recipient_id: c.doctor_id,
        subject: `Telehealth: ${c.patient_name ?? 'Patient'} is waiting`,
        body: `${c.patient_name ?? 'Patient'} (${c.patient_number ?? '—'}) is in the telehealth waiting room for their scheduled call.`,
        priority: 'urgent',
      });
      Alert.alert('Sent', 'Doctor has been notified.');
    } catch {
      Alert.alert('Error', 'Could not send notification.');
    } finally {
      setNotifying(null);
    }
  };

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Telemedicine Queue"
        subtitle={loading ? 'Loading…' : `${items.length} in queue`}
        accent={C.purple}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.purple} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {items.length === 0 ? (
            <Text style={s.empty}>No patients waiting or scheduled for telehealth right now.</Text>
          ) : items.map(c => {
            const color = STATUS_COLOR[c.status] ?? C.blue;
            return (
              <View key={c.id} style={[s.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{c.patient_name ?? 'Patient'}</Text>
                    <Text style={s.meta}>Dr. {c.doctor_name ?? '—'} · {c.scheduled_start_time ? new Date(c.scheduled_start_time).toLocaleString() : '—'}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}50` }]}>
                    <Text style={[s.statusText, { color }]}>{c.status.toUpperCase()}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={s.notifyBtn}
                  onPress={() => notifyDoctor(c)}
                  disabled={notifying === c.id || !c.doctor_id}
                >
                  {notifying === c.id
                    ? <ActivityIndicator color={C.purple} />
                    : <><Icon name="escalate" size={14} color={C.purple} /><Text style={s.notifyText}>Notify Doctor</Text></>
                  }
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:    { padding: 16, gap: 12, paddingBottom: 40 },
  empty:      { fontFamily: FONT.uiMd, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, borderWidth: 1, borderColor: C.border, gap: 10, ...SHADOW.sm },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name:       { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  meta:       { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statusPill: { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: FONT.uiBd, fontSize: 10, letterSpacing: 0.4 },
  notifyBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${C.purple}18`, borderWidth: 1, borderColor: `${C.purple}40`, borderRadius: RADIUS.pill, paddingVertical: 10 },
  notifyText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.purple },
});
