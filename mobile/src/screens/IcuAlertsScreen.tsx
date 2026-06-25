import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';

const SEVERITY_COLOR: Record<string, string> = {
  critical: C.red,
  high:     C.coral,
  stable:   C.teal,
};

export default function IcuAlertsScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/icu/ai/sofa-alerts/active')
      .then((r: any) => setAlerts(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const acknowledge = async (id: string) => {
    try {
      await api.patch(`/icu/ai/sofa-alerts/${id}/acknowledge`, {});
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {
      Alert.alert('Error', 'Could not acknowledge alert.');
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>ICU Active Alerts</Text>
      <Text style={s.sub}>{alerts.length} active deterioration alert{alerts.length !== 1 ? 's' : ''}</Text>

      {alerts.length === 0 && (
        <View style={s.emptyBox}>
          <Icon name="check" size={32} color={C.green} />
          <Text style={s.emptyText}>No active alerts</Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[s.card, { borderLeftColor: SEVERITY_COLOR[item.alert_severity] ?? C.coral, borderLeftWidth: 4 }]}>
            <View style={s.row}>
              <Icon name="alert-triangle" size={16} color={SEVERITY_COLOR[item.alert_severity] ?? C.coral} />
              <Text style={s.name}> Bed {item.bed_number ?? item.bed_code} — {item.first_name} {item.last_name}</Text>
            </View>
            <Text style={[s.severity, { color: SEVERITY_COLOR[item.alert_severity] ?? C.coral }]}>
              {item.alert_severity?.toUpperCase()} — SOFA {item.score_now} (Δ +{item.delta})
            </Text>
            <Text style={s.ts}>{new Date(item.created_at).toLocaleTimeString()}</Text>
            <TouchableOpacity style={s.ackBtn} onPress={() => acknowledge(item.id)}>
              <Text style={s.ackText}>Acknowledge</Text>
            </TouchableOpacity>
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
  emptyBox:  { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontFamily: FONT.uiMd, fontSize: 16, color: C.textMuted },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  name:      { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  severity:  { fontFamily: FONT.uiSb, fontSize: 13 },
  ts:        { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 4 },
  ackBtn:    { marginTop: 12, backgroundColor: C.teal + '22', borderRadius: RADIUS.pill, paddingVertical: 8, alignItems: 'center' },
  ackText:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.teal },
});
