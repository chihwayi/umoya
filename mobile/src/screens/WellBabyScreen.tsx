import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Baby, TrendingDown, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const NUTRITION_COLOR: Record<string, string> = {
  normal:       C.green,
  mild_wasting: C.amber,
  mam:          C.coral,
  sam:          C.red,
  overweight:   C.amber,
  obese:        C.coral,
};

const MILESTONE_COLOR: Record<string, string> = {
  on_track:     C.green,
  monitor:      C.amber,
  refer:        C.coral,
  urgent_refer: C.red,
};

export default function WellBabyScreen({ route }: { route: any }) {
  const patientId = route?.params?.patientId;
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    api.get(`/well-baby/patients/${patientId}/visits`)
      .then((r: any) => setVisits(r.data ?? r))
      .catch(() => Alert.alert('Error', 'Could not load WBC history.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Baby size={20} color={C.teal} />
        <Text style={s.heading}>Well-Baby Visits</Text>
      </View>

      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={s.empty}>No WBC visits recorded.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} activeOpacity={0.85}>
            <View style={s.row}>
              <Text style={s.visitType}>{item.visit_type?.replace(/_/g, ' ').toUpperCase()}</Text>
              <Text style={s.date}>{item.visit_date}</Text>
            </View>

            {item.weight_kg != null && (
              <View style={s.row}>
                <Text style={s.label}>Weight:</Text>
                <Text style={s.value}>{item.weight_kg} kg</Text>
                {item.wfa_zscore != null && (
                  <Text style={[
                    s.zscore,
                    { color: item.wfa_zscore < -3 ? C.red : item.wfa_zscore < -2 ? C.coral : item.wfa_zscore < -1 ? C.amber : C.green },
                  ]}>
                    z={item.wfa_zscore}
                  </Text>
                )}
                {item.wfa_zscore != null && item.wfa_zscore < -2 && <TrendingDown size={14} color={C.coral} />}
              </View>
            )}

            {item.nutrition_status && (
              <View style={[s.badge, { backgroundColor: `${NUTRITION_COLOR[item.nutrition_status] ?? C.green}22` }]}>
                <Text style={[s.badgeText, { color: NUTRITION_COLOR[item.nutrition_status] ?? C.green }]}>
                  {item.nutrition_status.toUpperCase().replace(/_/g, ' ')}
                </Text>
              </View>
            )}

            {item.cdss_growth_alert && (
              <View style={s.alertBox}>
                <AlertTriangle size={12} color={C.coral} />
                <Text style={s.alertText}>{item.cdss_growth_alert}</Text>
              </View>
            )}

            {item.next_visit_due && (
              <Text style={s.nextDue}>Next visit due: {item.next_visit_due}</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  heading:   { fontFamily: FONT.uiBd, fontSize: 20, color: C.text },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  visitType: { fontFamily: FONT.uiSb, fontSize: 11, color: C.teal, letterSpacing: 0.5 },
  date:      { fontFamily: FONT.mono, fontSize: 12, color: C.textMuted, marginLeft: 'auto' },
  label:     { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  value:     { fontFamily: FONT.uiSb, fontSize: 13, color: C.text },
  zscore:    { fontFamily: FONT.mono, fontSize: 12, fontWeight: '700' },
  badge:     { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontFamily: FONT.uiSb, fontSize: 11, letterSpacing: 0.4 },
  alertBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6, backgroundColor: `${C.coral}11`, borderRadius: 6, padding: 6 },
  alertText: { fontFamily: FONT.ui, fontSize: 11, color: C.coral, flex: 1 },
  nextDue:   { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 6 },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
