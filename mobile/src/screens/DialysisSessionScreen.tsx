import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Activity, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function DialysisSessionScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/dialysis/hd-sessions/${patientId}`)
      .then((r: any) => setSessions(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>HD Session History</Text>
      <Text style={s.sub}>{patientName}</Text>
      <FlatList
        data={sessions}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Activity size={14} color={C.teal} />
              <Text style={s.date}> {item.session_date}</Text>
              {item.kt_v_adequate === true && <CheckCircle size={14} color={C.green} style={s.ml} />}
              {item.kt_v_adequate === false && <AlertTriangle size={14} color={C.coral} style={s.ml} />}
            </View>
            <View style={s.metrics}>
              <Text style={s.metric}>Kt/V: <Text style={[s.val, { color: item.kt_v_adequate ? C.green : C.coral }]}>{item.kt_v_measured ?? '—'}</Text></Text>
              <Text style={s.metric}>UF: <Text style={s.val}>{item.uf_volume_ml ? `${item.uf_volume_ml} ml` : '—'}</Text></Text>
              <Text style={s.metric}>Duration: <Text style={s.val}>{item.duration_hours ? `${parseFloat(item.duration_hours).toFixed(1)}h` : '—'}</Text></Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:       { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  date:      { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, flex: 1 },
  ml:        { marginLeft: 4 },
  metrics:   { flexDirection: 'row', gap: 20 },
  metric:    { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  val:       { fontFamily: FONT.uiSb, color: C.text },
});
