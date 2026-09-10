import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { C, FONT, RADIUS } from '../../design/tokens';

interface LabQualitySummary {
  eqa_scores: { satisfactory: number; warning: number; unsatisfactory: number };
  qc_failures: { total: number; by_analyte: Record<string, number> };
  repeat_test_flags: { possible_error: number; clinically_close: number; total: number };
  turnaround_p50_hours: number | null;
  turnaround_p95_hours: number | null;
  critical_value_notification_rate: number | null;
  specimen_rejection_rate: number | null;
}

// Backend (lab/quality/summary) only supports a single calendar-month period
// (DATE_TRUNC('month', ...) — no week/quarter/year granularity), unlike most
// other report screens' PeriodSelector, so this always shows the current month.
export default function LabQualityScreen() {
  const [data, setData] = useState<LabQualitySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const period = new Date().toISOString().slice(0, 7).replace('-', '');
    api.get(`/lab/quality/summary?period=${period}`)
      .then((d: any) => setData(d.data ?? d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </View>
    );
  }

  const eqaTotal = (data?.eqa_scores.satisfactory ?? 0) + (data?.eqa_scores.warning ?? 0) + (data?.eqa_scores.unsatisfactory ?? 0);
  const eqaPassRate = eqaTotal > 0 ? (data!.eqa_scores.satisfactory / eqaTotal) * 100 : null;
  const analytes = Object.entries(data?.qc_failures.by_analyte ?? {});

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={s.monthLabel}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>

      <View style={s.metrics}>
        <KpiCard
          label="EQA Pass Rate"
          value={eqaPassRate != null ? `${eqaPassRate.toFixed(0)}%` : '—'}
          color={eqaPassRate != null && eqaPassRate >= 80 ? C.green : C.coral}
        />
        <KpiCard
          label="Median TAT"
          value={data?.turnaround_p50_hours != null ? `${data.turnaround_p50_hours.toFixed(1)}h` : '—'}
          color={C.blue}
        />
        <KpiCard
          label="P95 TAT"
          value={data?.turnaround_p95_hours != null ? `${data.turnaround_p95_hours.toFixed(1)}h` : '—'}
          color={C.amber}
        />
      </View>

      {data?.critical_value_notification_rate != null && (
        <View style={s.notifyCard}>
          <Text style={s.notifyLabel}>Critical Values Notified Within 1h</Text>
          <Text style={[s.notifyValue, { color: data.critical_value_notification_rate >= 95 ? C.green : C.coral }]}>
            {data.critical_value_notification_rate.toFixed(0)}%
          </Text>
        </View>
      )}

      {data?.specimen_rejection_rate != null && (
        <View style={s.notifyCard}>
          <Text style={s.notifyLabel}>Specimen Rejection Rate</Text>
          <Text style={[s.notifyValue, { color: data.specimen_rejection_rate <= 2 ? C.green : C.coral }]}>
            {data.specimen_rejection_rate.toFixed(1)}%
          </Text>
        </View>
      )}

      <Text style={s.sectionTitle}>EQA Scores This Month</Text>
      <View style={s.panelRow}>
        <Text style={s.panelName}>Satisfactory</Text>
        <Text style={[s.panelStatus, { color: C.green }]}>{data?.eqa_scores.satisfactory ?? 0}</Text>
      </View>
      <View style={s.panelRow}>
        <Text style={s.panelName}>Warning</Text>
        <Text style={[s.panelStatus, { color: C.amber }]}>{data?.eqa_scores.warning ?? 0}</Text>
      </View>
      <View style={s.panelRow}>
        <Text style={s.panelName}>Unsatisfactory</Text>
        <Text style={[s.panelStatus, { color: C.coral }]}>{data?.eqa_scores.unsatisfactory ?? 0}</Text>
      </View>

      {analytes.length > 0 && (
        <>
          <Text style={s.sectionTitle}>QC Failures by Analyte</Text>
          {analytes.map(([analyte, count]) => (
            <View key={analyte} style={[s.panelRow, { borderLeftColor: C.coral }]}>
              <Text style={s.panelName}>{analyte}</Text>
              <Text style={[s.panelStatus, { color: C.coral }]}>{count}</Text>
            </View>
          ))}
        </>
      )}

      {(data?.repeat_test_flags.total ?? 0) > 0 && (
        <>
          <Text style={s.sectionTitle}>Repeat Test Flags</Text>
          <View style={s.panelRow}>
            <Text style={s.panelName}>Possible Error</Text>
            <Text style={[s.panelStatus, { color: C.coral }]}>{data?.repeat_test_flags.possible_error}</Text>
          </View>
          <View style={s.panelRow}>
            <Text style={s.panelName}>Clinically Justified</Text>
            <Text style={[s.panelStatus, { color: C.textSecondary }]}>{data?.repeat_test_flags.clinically_close}</Text>
          </View>
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
  monthLabel: { fontFamily: FONT.uiSb, fontSize: 13, color: C.textMuted, marginBottom: 14 },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, borderTopWidth: 3, alignItems: 'center' },
  kpiValue: { fontFamily: FONT.uiBd, fontSize: 18 },
  kpiLabel: { fontFamily: FONT.uiMd, fontSize: 10, color: C.textSecondary, marginTop: 2, textAlign: 'center' },
  notifyCard: { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  notifyLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, flex: 1 },
  notifyValue: { fontFamily: FONT.uiBd, fontSize: 20 },
  sectionTitle: { fontFamily: FONT.uiSb, fontSize: 14, color: C.textSecondary, marginBottom: 10, marginTop: 8 },
  panelRow: { backgroundColor: C.surface, borderRadius: RADIUS.sm, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.border },
  panelName: { fontFamily: FONT.uiMd, fontSize: 14, color: C.text },
  panelStatus: { fontFamily: FONT.uiSb, fontSize: 14 },
});
