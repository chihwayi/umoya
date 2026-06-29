import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { C, FONT, RADIUS } from '../../design/tokens';
import { PeriodSelector, Period } from '../../components/reports/PeriodSelector';

interface DistrictRow {
  district: string;
  coverage_pct: number;
  female_pct?: number;
  male_pct?: number;
}

interface EquityData {
  gender_gap_pct: number;
  rural_coverage_pct: number;
  urban_coverage_pct: number;
  by_district: DistrictRow[];
}

export default function EquitySummaryScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<EquityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/equity-analytics/dashboard?period=${period}`)
      .then((d: any) => setData(d.data ?? d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </View>
    );
  }

  const districts = data?.by_district ?? [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <PeriodSelector value={period} onChange={setPeriod} />

      <View style={s.cards}>
        <MetricCard label="Gender Gap" value={data?.gender_gap_pct != null ? `${data.gender_gap_pct.toFixed(1)}%` : '—'} color={C.blue} />
        <MetricCard label="Rural" value={data?.rural_coverage_pct != null ? `${data.rural_coverage_pct.toFixed(0)}%` : '—'} color={C.amber} />
        <MetricCard label="Urban" value={data?.urban_coverage_pct != null ? `${data.urban_coverage_pct.toFixed(0)}%` : '—'} color={C.teal} />
      </View>

      {districts.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Coverage by District</Text>
          {districts.map((d, i) => (
            <View key={i} style={s.row}>
              <Text style={s.district}>{d.district}</Text>
              <View style={s.barWrap}>
                <View style={[s.barFill, { width: `${Math.min(d.coverage_pct ?? 0, 100)}%` as any }]} />
              </View>
              <Text style={s.pct}>{d.coverage_pct != null ? `${d.coverage_pct.toFixed(0)}%` : '—'}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={[s.card, { borderTopColor: color }]}>
    <Text style={[s.cardValue, { color }]}>{value}</Text>
    <Text style={s.cardLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  cards: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  card: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, borderTopWidth: 3, alignItems: 'center' },
  cardValue: { fontFamily: FONT.uiBd, fontSize: 20 },
  cardLabel: { fontFamily: FONT.uiMd, fontSize: 11, color: C.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontFamily: FONT.uiSb, fontSize: 14, color: C.textSecondary, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  district: { fontFamily: FONT.ui, fontSize: 13, color: C.text, width: 90 },
  barWrap: { flex: 1, height: 10, backgroundColor: C.surface2, borderRadius: RADIUS.pill, overflow: 'hidden', marginHorizontal: 10 },
  barFill: { height: '100%', backgroundColor: C.teal, borderRadius: RADIUS.pill },
  pct: { fontFamily: FONT.uiSb, fontSize: 12, color: C.text, width: 38, textAlign: 'right' },
});
