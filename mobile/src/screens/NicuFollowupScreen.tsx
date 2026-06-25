import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Brain } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const DELAY_COLOR = (score: number | null) =>
  score == null ? C.textMuted : score < 70 ? C.red : score < 85 ? C.coral : C.green;

export default function NicuFollowupScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [correctedAge, setCorrectedAge] = useState<any>(null);
  const [bayley, setBayley] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/nicu-followup/corrected-age/${patientId}`).then((r: any) => setCorrectedAge(r.data ?? r)),
      api.get(`/nicu-followup/bayley/${patientId}`).then((r: any) => setBayley(r.data ?? r)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const latest = bayley[bayley.length - 1];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>NICU Follow-up</Text>
      <Text style={s.sub}>{patientName}</Text>

      {correctedAge && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Corrected Age</Text>
          <Text style={s.big}>{correctedAge.corrected_age_months} months</Text>
          <Text style={s.detail}>Chronological: {correctedAge.chronological_age_days} days</Text>
        </View>
      )}

      {latest && (
        <View style={s.card}>
          <View style={s.row}>
            <Brain size={14} color={C.teal} />
            <Text style={s.sectionTitle}> Latest Bayley-III ({latest.corrected_age_months}m CA)</Text>
          </View>
          <View style={s.scores}>
            <View style={s.scoreItem}>
              <Text style={s.scoreLbl}>Cognitive</Text>
              <Text style={[s.scoreNum, { color: DELAY_COLOR(latest.cognitive_composite) }]}>
                {latest.cognitive_composite ?? '—'}
              </Text>
            </View>
            <View style={s.scoreItem}>
              <Text style={s.scoreLbl}>Language</Text>
              <Text style={[s.scoreNum, { color: DELAY_COLOR(latest.language_composite) }]}>
                {latest.language_composite ?? '—'}
              </Text>
            </View>
            <View style={s.scoreItem}>
              <Text style={s.scoreLbl}>Motor</Text>
              <Text style={[s.scoreNum, { color: DELAY_COLOR(latest.motor_composite) }]}>
                {latest.motor_composite ?? '—'}
              </Text>
            </View>
          </View>
          {latest.any_significant_delay && (
            <Text style={s.delayAlert}>⚠ Significant developmental delay identified — referral required</Text>
          )}
        </View>
      )}

      {bayley.length === 0 && (
        <View style={s.card}>
          <Text style={s.detail}>No Bayley-III assessments recorded</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:      { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:          { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:         { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  sectionTitle: { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  big:          { fontFamily: FONT.uiBd, fontSize: 28, color: C.teal },
  detail:       { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  row:          { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  scores:       { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  scoreItem:    { alignItems: 'center' },
  scoreLbl:     { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginBottom: 4 },
  scoreNum:     { fontFamily: FONT.uiBd, fontSize: 24 },
  delayAlert:   { fontFamily: FONT.uiSb, fontSize: 12, color: C.coral, marginTop: 10 },
});
