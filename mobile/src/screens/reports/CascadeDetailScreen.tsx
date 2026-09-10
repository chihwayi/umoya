import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { C, FONT, RADIUS } from '../../design/tokens';
import { PeriodSelector, Period, periodToDateRange } from '../../components/reports/PeriodSelector';

interface CascadeStep {
  label: string;
  value: number;
  percentage?: number;
}

export default function CascadeDetailScreen() {
  const tenant = useAuthStore(st => st.tenant);
  const [period, setPeriod] = useState<Period>('month');
  const [steps, setSteps] = useState<CascadeStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.slug) { setLoading(false); return; }
    setLoading(true);
    const { startDate, endDate } = periodToDateRange(period);
    api.get(`/tenants/${tenant.slug}/cascades/hiv?startDate=${startDate}&endDate=${endDate}`)
      .then((d: any) => setSteps((d.data ?? d)?.funnelSteps ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, tenant?.slug]);

  const max = steps[0]?.value || 1;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <PeriodSelector value={period} onChange={setPeriod} />

      {steps.length === 0 ? (
        <Text style={s.empty}>No cascade data for this period</Text>
      ) : (
        steps.map((step, i) => (
          <View key={i} style={s.stepRow}>
            <View style={s.stepHeader}>
              <Text style={s.stepLabel}>{step.label}</Text>
              <Text style={s.stepValue}>
                {step.value.toLocaleString()}
                {step.percentage != null ? `  (${step.percentage.toFixed(1)}%)` : ''}
              </Text>
            </View>
            <View style={s.barBg}>
              <View
                style={[
                  s.bar,
                  { width: `${(step.value / max) * 100}%` as any },
                  i === 0 && { backgroundColor: C.teal },
                ]}
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  empty: { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 40 },
  stepRow: { marginBottom: 18 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  stepLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary },
  stepValue: { fontFamily: FONT.uiSb, fontSize: 13, color: C.text },
  barBg: {
    height: 20,
    backgroundColor: C.surface2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: C.teal + 'BB',
    borderRadius: RADIUS.sm,
  },
});
