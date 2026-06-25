import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '../components/ui/Icon';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const TERRITORY_COLOR: Record<string, string> = {
  anterior:  C.coral,
  inferior:  C.amber,
  lateral:   C.amber,
  posterior: C.amber,
  rvmi:      C.coral,
  diffuse:   C.red,
  none:      C.teal,
};

const RISK_COLOR: Record<string, string> = {
  low:       C.green,
  moderate:  C.amber,
  high:      C.coral,
  very_high: C.red,
};

const COMPLEXITY_COLOR: Record<string, string> = {
  low:          C.green,
  intermediate: C.amber,
  high:         C.coral,
};

export default function CathLabAiScreen({ route }: { route: any }) {
  const { caseId } = route.params;
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/cathlab/ai/case/${caseId}/summary`)
      .then((r: any) => setSummary(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>No AI data for this case.</Text>
      </View>
    );
  }

  const { ecg, contrast_risk, dapt, syntax } = summary;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>CathLab AI Summary</Text>

      {ecg && (
        <View style={[s.card, { borderLeftColor: TERRITORY_COLOR[ecg.territory ?? 'none'], borderLeftWidth: 4 }]}>
          <View style={s.row}>
            <Icon name="pulse" size={16} color={TERRITORY_COLOR[ecg.territory ?? 'none']} />
            <Text style={s.cardTitle}> ECG Interpretation</Text>
          </View>
          <Text style={[s.value, { color: TERRITORY_COLOR[ecg.territory ?? 'none'] }]}>
            {ecg.territory?.toUpperCase() ?? 'NORMAL'}
          </Text>
          {ecg.max_st_elev_mm != null && (
            <Text style={s.sub}>Max ST elevation: {ecg.max_st_elev_mm} mm</Text>
          )}
          {ecg.ai_impression ? <Text style={s.impression}>{ecg.ai_impression}</Text> : null}
        </View>
      )}

      {contrast_risk && (
        <View style={[s.card, { borderLeftColor: RISK_COLOR[contrast_risk.risk_level] ?? C.textMuted, borderLeftWidth: 4 }]}>
          <View style={s.row}>
            <Icon name="shield" size={16} color={RISK_COLOR[contrast_risk.risk_level] ?? C.textMuted} />
            <Text style={s.cardTitle}> Mehran Contrast Risk</Text>
          </View>
          <Text style={[s.value, { color: RISK_COLOR[contrast_risk.risk_level] ?? C.textMuted }]}>
            Score: {contrast_risk.mehran_score} — {contrast_risk.risk_level?.toUpperCase().replace('_', ' ')}
          </Text>
          <Text style={s.impression}>{contrast_risk.recommendation}</Text>
        </View>
      )}

      {syntax && (
        <View style={[s.card, { borderLeftColor: COMPLEXITY_COLOR[syntax.complexity_tier] ?? C.teal, borderLeftWidth: 4 }]}>
          <View style={s.row}>
            <Icon name="trending" size={16} color={COMPLEXITY_COLOR[syntax.complexity_tier] ?? C.teal} />
            <Text style={s.cardTitle}> SYNTAX Score</Text>
          </View>
          <Text style={s.bigNumber}>{syntax.syntax_score}</Text>
          <Text style={[s.badge, { color: COMPLEXITY_COLOR[syntax.complexity_tier] ?? C.teal }]}>
            {syntax.complexity_tier?.toUpperCase()} COMPLEXITY
          </Text>
          <Text style={s.impression}>{syntax.recommended_strategy?.replace(/_/g, ' ')}</Text>
        </View>
      )}

      {dapt && (
        <View style={s.card}>
          <View style={s.row}>
            <Icon name="alert" size={16} color={C.amber} />
            <Text style={s.cardTitle}> DAPT Recommendation</Text>
          </View>
          <Text style={s.value}>{dapt.recommended_agent?.replace(/_/g, ' ')}</Text>
          <Text style={s.sub}>{dapt.recommended_duration_months} months</Text>
          {dapt.interaction_flags?.length > 0 && (
            <View style={s.flagBox}>
              {dapt.interaction_flags.map((f: any, i: number) => (
                <Text key={i} style={s.flagText}>⚠ {f.message}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  empty:      { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted },
  heading:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 16 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle:  { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary },
  value:      { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  bigNumber:  { fontFamily: FONT.uiBd, fontSize: 36, color: C.text, marginVertical: 4 },
  badge:      { fontFamily: FONT.uiSb, fontSize: 12 },
  sub:        { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  impression: { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 18 },
  flagBox:    { backgroundColor: C.coral + '22', borderRadius: RADIUS.sm, padding: 10, marginTop: 8 },
  flagText:   { fontFamily: FONT.ui, fontSize: 12, color: C.coral },
});
