import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { C, FONT, RADIUS } from '../../design/tokens';
import { PeriodSelector, Period } from '../../components/reports/PeriodSelector';

interface PtPanel {
  panel_name: string;
  passed: boolean;
  score?: number;
  tested_at?: string;
}

interface LabQualityData {
  pt_pass_rate: number;
  avg_tat_hours: number;
  critical_tat_hours: number;
  critical_values_notified_pct: number;
  pt_panels: PtPanel[];
}

export default function LabQualityScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<LabQualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/lab-quality/dashboard?period=${period}`)
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

  const panels = data?.pt_panels ?? [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <PeriodSelector value={period} onChange={setPeriod} />

      <View style={s.metrics}>
        <KpiCard
          label="PT Pass Rate"
          value={data?.pt_pass_rate != null ? `${data.pt_pass_rate.toFixed(0)}%` : '—'}
          color={data?.pt_pass_rate != null && data.pt_pass_rate >= 80 ? C.green : C.coral}
        />
        <KpiCard
          label="Avg TAT"
          value={data?.avg_tat_hours != null ? `${data.avg_tat_hours.toFixed(1)}h` : '—'}
          color={C.blue}
        />
        <KpiCard
          label="Critical TAT"
          value={data?.critical_tat_hours != null ? `${data.critical_tat_hours.toFixed(1)}h` : '—'}
          color={C.amber}
        />
      </View>

      {data?.critical_values_notified_pct != null && (
        <View style={s.notifyCard}>
          <Text style={s.notifyLabel}>Critical Values Notified</Text>
          <Text style={[s.notifyValue, { color: data.critical_values_notified_pct >= 95 ? C.green : C.coral }]}>
            {data.critical_values_notified_pct.toFixed(0)}%
          </Text>
        </View>
      )}

      {panels.length > 0 && (
        <>
          <Text style={s.sectionTitle}>PT Panel Results</Text>
          {panels.map((p, i) => (
            <View key={i} style={[s.panelRow, { borderLeftColor: p.passed ? C.green : C.coral }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.panelName}>{p.panel_name}</Text>
                {p.tested_at && (
                  <Text style={s.panelDate}>{new Date(p.tested_at).toLocaleDateString()}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.panelStatus, { color: p.passed ? C.green : C.coral }]}>
                  {p.passed ? '✓ PASS' : '✗ FAIL'}
                </Text>
                {p.score != null && (
                  <Text style={s.panelScore}>{p.score.toFixed(0)}%</Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const KpiCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={[s.kpi, { borderTopColor: color }]}>
    <Text style={[s.kpiValue, { color }]}>{value}</Text>
    <Text style={s.kpiLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, borderTopWidth: 3, alignItems: 'center' },
  kpiValue: { fontFamily: FONT.uiBd, fontSize: 18 },
  kpiLabel: { fontFamily: FONT.uiMd, fontSize: 10, color: C.textSecondary, marginTop: 2, textAlign: 'center' },
  notifyCard: { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  notifyLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary },
  notifyValue: { fontFamily: FONT.uiBd, fontSize: 20 },
  sectionTitle: { fontFamily: FONT.uiSb, fontSize: 14, color: C.textSecondary, marginBottom: 10 },
  panelRow: { backgroundColor: C.surface, borderRadius: RADIUS.sm, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 3 },
  panelName: { fontFamily: FONT.uiMd, fontSize: 14, color: C.text },
  panelDate: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 2 },
  panelStatus: { fontFamily: FONT.uiSb, fontSize: 13 },
  panelScore: { fontFamily: FONT.uiMd, fontSize: 11, color: C.textSecondary },
});
