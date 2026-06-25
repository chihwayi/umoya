import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { User, Activity } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const K_COLOR: Record<number, string> = { 0: C.textMuted, 1: C.blue, 2: C.teal, 3: C.green, 4: C.amber };

export default function ProstheticsScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/prosthetics/prescriptions/${patientId}`)
      .then((r: any) => setPrescriptions(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Prosthetic Devices</Text>
      <Text style={s.sub}>{patientName}</Text>

      {prescriptions.length === 0 && <Text style={s.empty}>No devices prescribed yet.</Text>}

      {prescriptions.map((p: any) => (
        <View key={p.id} style={s.card}>
          <View style={s.row}>
            <User size={14} color={C.teal} />
            <Text style={s.device}> {p.device_type}</Text>
          </View>
          <Text style={s.category}>{p.device_category?.replace(/_/g,' ')}</Text>
          {p.prescribed_k_level != null && (
            <View style={[s.badge, { backgroundColor: (K_COLOR[p.prescribed_k_level] ?? C.textMuted) + '22' }]}>
              <Text style={[s.badgeText, { color: K_COLOR[p.prescribed_k_level] ?? C.textMuted }]}>
                K{p.prescribed_k_level}
              </Text>
            </View>
          )}
          <Text style={[s.status, { color: p.status === 'delivered' ? C.green : p.status === 'rejected' ? C.coral : C.amber }]}>
            {p.status?.toUpperCase().replace(/_/g,' ')}
          </Text>
          <Text style={s.date}>Prescribed: {p.prescribed_date}</Text>
          {p.delivery_date && <Text style={s.date}>Delivered: {p.delivery_date}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:       { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  device:    { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  category:  { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  badge:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill, marginBottom: 6 },
  badgeText: { fontFamily: FONT.uiSb, fontSize: 12 },
  status:    { fontFamily: FONT.uiSb, fontSize: 12, marginBottom: 4 },
  date:      { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
});
