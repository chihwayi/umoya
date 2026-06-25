import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Heart, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const CATEGORY_COLOR: Record<string, string> = {
  cyanotic: C.coral, acyanotic: C.teal, complex: C.amber, acquired: C.blue,
};

export default function PaedCardiologyScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [echos, setEchos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/paed-cardiology/echo/${patientId}`)
      .then((r: any) => setEchos(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const latest = echos[0];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Paediatric Cardiology</Text>
      <Text style={s.sub}>{patientName}</Text>

      {latest && (
        <View style={s.card}>
          <View style={s.row}><Heart size={16} color={C.teal} /><Text style={s.cardTitle}> Latest Echo — {latest.echo_date}</Text></View>

          <View style={s.metricRow}>
            <View style={s.metric}>
              <Text style={s.metricLabel}>LV EF</Text>
              <Text style={[s.metricVal, { color: latest.lv_ef_pct < 50 ? C.coral : C.teal }]}>
                {latest.lv_ef_pct != null ? `${latest.lv_ef_pct}%` : '—'}
              </Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLabel}>LV SF</Text>
              <Text style={[s.metricVal, { color: latest.lv_sf_pct < 28 || latest.lv_sf_pct > 44 ? C.coral : C.green }]}>
                {latest.lv_sf_pct != null ? `${latest.lv_sf_pct}%` : '—'}
              </Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLabel}>PA Systolic</Text>
              <Text style={[s.metricVal, { color: latest.pulmonary_hypertension ? C.coral : C.text }]}>
                {latest.pa_systolic_pressure_mmhg != null ? `${latest.pa_systolic_pressure_mmhg} mmHg` : '—'}
              </Text>
            </View>
          </View>

          {latest.pulmonary_hypertension && (
            <View style={s.alertBox}>
              <AlertTriangle size={14} color={C.coral} />
              <Text style={s.alertText}> Pulmonary hypertension detected</Text>
            </View>
          )}

          <View style={s.defectRow}>
            {([['PDA', latest.pda_present], ['ASD', latest.asd_present], ['VSD', latest.vsd_present]] as [string, boolean][]).map(([label, present]) => (
              <View key={label} style={[s.defectChip, { backgroundColor: present ? C.coral + '22' : C.surface }]}>
                <Text style={[s.defectText, { color: present ? C.coral : C.textMuted }]}>{label}</Text>
              </View>
            ))}
          </View>

          {latest.conclusion && <Text style={s.conclusion}>{latest.conclusion}</Text>}
        </View>
      )}

      {echos.length === 0 && <Text style={s.empty}>No echo reports on file.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  empty:       { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, ...SHADOW.card },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary },
  metricRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  metric:      { alignItems: 'center' },
  metricLabel: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginBottom: 4 },
  metricVal:   { fontFamily: FONT.uiBd, fontSize: 20 },
  alertBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.coral + '22', borderRadius: RADIUS.sm, padding: 10, marginBottom: 12 },
  alertText:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.coral },
  defectRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  defectChip:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.pill },
  defectText:  { fontFamily: FONT.uiSb, fontSize: 12 },
  conclusion:  { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, lineHeight: 18 },
});
