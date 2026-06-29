import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { C, FONT, RADIUS } from '../../design/tokens';
import { PeriodSelector, Period } from '../../components/reports/PeriodSelector';

interface MdsrCase {
  id: string;
  cause_of_death: string;
  gestational_age?: number;
  review_status?: string;
  preventable?: boolean;
}

interface MdsrData {
  total_deaths: number;
  reviewed: number;
  preventable: number;
  deaths: MdsrCase[];
}

export default function MdsrMobileScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<MdsrData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/mdsr/dashboard?period=${period}`)
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

  const deaths = data?.deaths ?? [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <PeriodSelector value={period} onChange={setPeriod} />

      <View style={s.statRow}>
        <StatChip label="Deaths"      value={data?.total_deaths ?? 0} color={C.coral}  />
        <StatChip label="Reviewed"    value={data?.reviewed ?? 0}     color={C.green}  />
        <StatChip label="Preventable" value={data?.preventable ?? 0}  color={C.amber}  />
      </View>

      {deaths.length === 0 ? (
        <Text style={s.empty}>No maternal deaths recorded this period</Text>
      ) : (
        deaths.slice(0, 15).map((d, i) => (
          <View key={d.id ?? i} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.caseLabel}>Case #{d.id ?? i + 1}</Text>
              {d.preventable && (
                <View style={s.prevBadge}>
                  <Text style={s.prevText}>Preventable</Text>
                </View>
              )}
            </View>
            <Text style={s.cause}>{d.cause_of_death ?? 'Cause not recorded'}</Text>
            <Text style={s.meta}>
              {d.gestational_age ? `GA ${d.gestational_age}w  ·  ` : ''}
              {d.review_status ?? 'Pending review'}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const StatChip: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={[s.chip, { borderTopColor: color }]}>
    <Text style={[s.chipValue, { color }]}>{value}</Text>
    <Text style={s.chipLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  empty: { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 40 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  chip: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, borderTopWidth: 3, alignItems: 'center' },
  chipValue: { fontFamily: FONT.uiBd, fontSize: 24 },
  chipLabel: { fontFamily: FONT.uiMd, fontSize: 11, color: C.textSecondary, marginTop: 2 },
  card: { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  caseLabel: { fontFamily: FONT.uiMd, fontSize: 11, color: C.textMuted },
  prevBadge: { backgroundColor: C.amber + '33', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  prevText: { fontFamily: FONT.uiSb, fontSize: 11, color: C.amber },
  cause: { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, marginBottom: 4 },
  meta: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
});
