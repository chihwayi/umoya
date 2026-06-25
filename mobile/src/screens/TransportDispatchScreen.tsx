import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Truck, AlertTriangle, Clock } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const PRIORITY_COLOR: Record<string, string> = { p1: C.red, p2: C.amber, p3: C.teal };
const VEHICLE_STATUS_COLOR: Record<string, string> = {
  available: C.green, on_call: C.amber, dispatched: C.coral, maintenance: C.textMuted, offline: C.textMuted,
};

const elapsed = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function TransportDispatchScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/transport/jobs/active').then((r: any) => setJobs(r.data ?? r)),
      api.get('/transport/vehicles').then((r: any) => setVehicles(r.data ?? r)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Transport Dispatch</Text>

      {/* Fleet strip */}
      <FlatList
        data={vehicles}
        horizontal
        keyExtractor={v => v.id}
        style={{ marginBottom: 16, maxHeight: 60 }}
        renderItem={({ item }) => (
          <View style={[s.vehicleChip, { borderColor: VEHICLE_STATUS_COLOR[item.status] }]}>
            <Truck size={12} color={VEHICLE_STATUS_COLOR[item.status]} />
            <Text style={[s.vehicleText, { color: VEHICLE_STATUS_COLOR[item.status] }]}> {item.call_sign}</Text>
          </View>
        )}
      />

      <Text style={s.section}>Active Jobs ({jobs.length})</Text>
      <FlatList
        data={jobs}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[s.card, { borderLeftColor: PRIORITY_COLOR[item.priority], borderLeftWidth: 4 }]}>
            <View style={s.row}>
              <Text style={[s.priority, { color: PRIORITY_COLOR[item.priority] }]}>
                {item.priority?.toUpperCase()}
              </Text>
              <Text style={s.ref}>{item.job_ref}</Text>
              {item.call_sign && <Text style={s.callSign}>• {item.call_sign}</Text>}
              <View style={{ flex: 1 }} />
              <Clock size={12} color={C.textMuted} />
              <Text style={s.time}> {elapsed(item.call_received_at)}</Text>
            </View>
            <Text style={s.incident}>{item.incident_type}</Text>
            {item.scene_address && <Text style={s.address}>{item.scene_address}</Text>}
            {item.priority === 'p1' && (
              <View style={s.p1Alert}>
                <AlertTriangle size={12} color={C.red} />
                <Text style={s.p1Text}> P1 — 8-min response target</Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 12 },
  vehicleChip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  vehicleText: { fontFamily: FONT.uiMd, fontSize: 11 },
  section:     { fontFamily: FONT.uiSb, fontSize: 14, color: C.textSecondary, marginBottom: 10 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  priority:    { fontFamily: FONT.uiBd, fontSize: 13 },
  ref:         { fontFamily: FONT.mono, fontSize: 11, color: C.textSecondary },
  callSign:    { fontFamily: FONT.uiMd, fontSize: 11, color: C.teal },
  time:        { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  incident:    { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, marginBottom: 2 },
  address:     { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  p1Alert:     { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  p1Text:      { fontFamily: FONT.uiSb, fontSize: 11, color: C.red },
});
