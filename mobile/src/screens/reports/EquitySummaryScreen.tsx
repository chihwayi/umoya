import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { C, FONT, RADIUS } from '../../design/tokens';

interface EquityGroup {
  kpi: string;
  dimension: string;
  values: { label: string; rate: number }[];
  equity_ratio: number | null;
}

export default function EquitySummaryScreen() {
  const tenant = useAuthStore(st => st.tenant);
  const [groups, setGroups] = useState<EquityGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.slug) { setLoading(false); return; }
    setLoading(true);
    const period = new Date().toISOString().slice(0, 7).replace('-', '');
    api.get(`/tenants/${tenant.slug}/equity/summary?period=${period}`)
      .then((d: any) => setGroups((d.data ?? d) ?? []))
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
      <Text style={s.monthLabel}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>

      {groups.length === 0 ? (
        <Text style={s.empty}>
          No equity KPI data computed for this period yet. Data populates when a KPI is viewed
          via the disaggregate breakdown at least once.
        </Text>
      ) : (
        groups.map((g, i) => (
          <View key={i} style={s.groupCard}>
            <View style={s.groupHeader}>
              <Text style={s.kpiName}>{g.kpi.replace(/_/g, ' ')}</Text>
              <Text style={s.dimension}>by {g.dimension.replace(/_/g, ' ')}</Text>
            </View>
            {g.equity_ratio != null && (
              <Text style={[s.ratio, { color: g.equity_ratio >= 0.8 ? C.green : C.coral }]}>
                Equity ratio: {g.equity_ratio.toFixed(2)}
              </Text>
            )}
            {g.values.map((v, vi) => (
              <View key={vi} style={s.row}>
                <Text style={s.district}>{v.label}</Text>
                <View style={s.barWrap}>
                  <View style={[s.barFill, { width: `${Math.min(v.rate * 100, 100)}%` as any }]} />
                </View>
                <Text style={s.pct}>{(v.rate * 100).toFixed(0)}%</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  monthLabel: { fontFamily: FONT.uiSb, fontSize: 13, color: C.textMuted, marginBottom: 14 },
  empty: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, textAlign: 'center', marginTop: 40, lineHeight: 19 },
  groupCard: { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 14 },
  groupHeader: { marginBottom: 6 },
  kpiName: { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, textTransform: 'capitalize' },
  dimension: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, textTransform: 'capitalize' },
  ratio: { fontFamily: FONT.uiMd, fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  district: { fontFamily: FONT.ui, fontSize: 12, color: C.text, width: 90 },
  barWrap: { flex: 1, height: 10, backgroundColor: C.surface2, borderRadius: RADIUS.pill, overflow: 'hidden', marginHorizontal: 10 },
  barFill: { height: '100%', backgroundColor: C.teal, borderRadius: RADIUS.pill },
  pct: { fontFamily: FONT.uiSb, fontSize: 12, color: C.text, width: 38, textAlign: 'right' },
});
