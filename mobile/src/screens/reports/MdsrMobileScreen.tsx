import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { C, FONT, RADIUS } from '../../design/tokens';

interface MdsrCase {
  id: string;
  death_cause_primary?: string;
  review_status?: string;
  preventable?: boolean;
}

interface MdsrSummary {
  total_maternal_deaths: number;
  reviews_completed: number;
  preventable: number;
}

// Backend (mdsr/summary) only supports a calendar-year period, not the usual
// week/quarter granularity — always shows the current year.
export default function MdsrMobileScreen() {
  const tenant = useAuthStore(st => st.tenant);
  const [summary, setSummary] = useState<MdsrSummary | null>(null);
  const [deaths, setDeaths] = useState<MdsrCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.slug) { setLoading(false); return; }
    setLoading(true);
    const year = new Date().getFullYear();
    Promise.all([
      api.get(`/tenants/${tenant.slug}/mdsr/summary?year=${year}`),
      api.get(`/tenants/${tenant.slug}/mdsr/deaths?year=${year}`),
    ])
      .then(([summaryRes, deathsRes]: any[]) => {
        setSummary(summaryRes.data ?? summaryRes);
        setDeaths((deathsRes.data ?? deathsRes) ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenant?.slug]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={s.yearLabel}>{new Date().getFullYear()}</Text>

      <View style={s.statRow}>
        <StatChip label="Deaths"      value={summary?.total_maternal_deaths ?? 0} color={C.coral}  />
        <StatChip label="Reviewed"    value={summary?.reviews_completed ?? 0}     color={C.green}  />
        <StatChip label="Preventable" value={summary?.preventable ?? 0}           color={C.amber}  />
      </View>

      {deaths.length === 0 ? (
        <Text style={s.empty}>No maternal deaths recorded this year</Text>
      ) : (
        deaths.slice(0, 15).map((d, i) => (
          <View key={d.id ?? i} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.caseLabel}>Case #{d.id ? d.id.slice(0, 8) : i + 1}</Text>
              {d.preventable && (
                <View style={s.prevBadge}>
                  <Text style={s.prevText}>Preventable</Text>
                </View>
              )}
            </View>
            <Text style={s.cause}>{d.death_cause_primary ?? 'Cause not recorded'}</Text>
            <Text style={s.meta}>{d.review_status ?? 'Pending review'}</Text>
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
  yearLabel: { fontFamily: FONT.uiSb, fontSize: 13, color: C.textMuted, marginBottom: 14 },
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
