import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
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

export default function DhisAlertsScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [alerts, setAlerts] = useState<OutlierAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/dhis2/validation/alerts?period=${period}`)
      .then((d: any) => setAlerts(d.data ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

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
