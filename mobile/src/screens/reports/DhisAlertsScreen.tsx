import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { C, FONT, RADIUS } from '../../design/tokens';
import { Icon } from '../../components/ui/Icon';
import { PeriodSelector, Period } from '../../components/reports/PeriodSelector';

interface OutlierAlert {
  data_element: string;
  org_unit?: string;
  value: number;
  expected: number;
  deviation: number;
  period: string;
  severity: 'high' | 'medium' | 'low';
}

interface ApiOutlier {
  name: string;
  dhis2: number | null;
  local: number | null;
  deviation_pct: number;
  severity: 'ok' | 'warning' | 'critical';
}

interface ApiOutlierReport {
  period: string;
  outliers: ApiOutlier[];
}

const mapSeverity = (s: ApiOutlier['severity']): OutlierAlert['severity'] =>
  s === 'critical' ? 'high' : s === 'warning' ? 'medium' : 'low';

export default function DhisAlertsScreen() {
  const tenant = useAuthStore(st => st.tenant);
  const [period, setPeriod] = useState<Period>('month');
  const [alerts, setAlerts] = useState<OutlierAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.slug) return;
    setLoading(true);
    api.get<ApiOutlierReport>(`/tenants/${tenant.slug}/dhis2-validation/outliers?period=${period}`)
      .then((res: any) => {
        const report: ApiOutlierReport = res.data ?? res;
        const mapped = (report.outliers ?? [])
          .filter(o => o.severity !== 'ok')
          .map(o => ({
            data_element: o.name,
            value: o.local ?? 0,
            expected: o.dhis2 ?? 0,
            deviation: o.deviation_pct,
            period: report.period,
            severity: mapSeverity(o.severity),
          }));
        setAlerts(mapped);
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [period, tenant?.slug]);

  const sevColor = (sev: string) =>
    sev === 'high' ? C.coral : sev === 'medium' ? C.amber : C.blue;

  const high   = alerts.filter(a => a.severity === 'high').length;
  const medium = alerts.filter(a => a.severity === 'medium').length;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.topSection}>
        <PeriodSelector value={period} onChange={setPeriod} />
        {alerts.length > 0 && (
          <View style={s.summaryRow}>
            <View style={[s.badge, { backgroundColor: C.coral + '22' }]}>
              <Text style={[s.badgeText, { color: C.coral }]}>{high} High</Text>
            </View>
            <View style={[s.badge, { backgroundColor: C.amber + '22' }]}>
              <Text style={[s.badgeText, { color: C.amber }]}>{medium} Medium</Text>
            </View>
            <View style={[s.badge, { backgroundColor: C.blue + '22' }]}>
              <Text style={[s.badgeText, { color: C.blue }]}>{alerts.length - high - medium} Low</Text>
            </View>
          </View>
        )}
      </View>

      {alerts.length === 0 ? (
        <View style={s.empty}>
          <Icon name="check-circle" size={48} color={C.green} />
          <Text style={s.emptyText}>No outliers detected</Text>
          <Text style={s.emptySubtext}>All data elements within expected range</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 20, paddingTop: 0 }}
          renderItem={({ item }) => (
            <View style={[s.card, { borderLeftColor: sevColor(item.severity) }]}>
              <View style={s.cardHeader}>
                <Text style={s.element} numberOfLines={2}>{item.data_element}</Text>
                <View style={[s.sevChip, { backgroundColor: sevColor(item.severity) + '22' }]}>
                  <Text style={[s.sevText, { color: sevColor(item.severity) }]}>
                    {item.severity.toUpperCase()}
                  </Text>
                </View>
              </View>
              {item.org_unit && (
                <Text style={s.orgUnit}>{item.org_unit}</Text>
              )}
              <View style={s.valRow}>
                <Text style={s.val}>Value: <Text style={{ color: sevColor(item.severity) }}>{item.value}</Text></Text>
                <Text style={s.val}>Expected: {item.expected}</Text>
                <Text style={s.val}>Dev: {item.deviation?.toFixed(1)}σ</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  topSection: { padding: 20, paddingBottom: 0 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontFamily: FONT.uiSb, fontSize: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontFamily: FONT.uiSb, fontSize: 18, color: C.green },
  emptySubtext: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  element: { fontFamily: FONT.uiSb, fontSize: 13, color: C.text, flex: 1, marginRight: 8 },
  sevChip: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  sevText: { fontFamily: FONT.uiSb, fontSize: 10 },
  orgUnit: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginBottom: 6 },
  valRow: { flexDirection: 'row', gap: 14 },
  val: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
});
