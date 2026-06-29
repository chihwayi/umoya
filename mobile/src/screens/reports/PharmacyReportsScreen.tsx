import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { C, FONT, RADIUS } from '../../design/tokens';
import { PeriodSelector, Period } from '../../components/reports/PeriodSelector';

interface WasteItem {
  drug_name: string;
  quantity: number;
  unit: string;
  reason?: string;
}

interface PharmacyData {
  formulary_adherence_pct: number;
  ams_approvals: number;
  waste_events: number;
  top_waste_items: WasteItem[];
  restricted_prescriptions: number;
}

export default function PharmacyReportsScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<PharmacyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/pharmacy/intelligence/dashboard?period=${period}`)
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

  const score = data?.formulary_adherence_pct ?? null;
  const scoreColor = score == null ? C.textMuted : score >= 90 ? C.green : score >= 75 ? C.amber : C.coral;
  const waste = data?.top_waste_items ?? [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <PeriodSelector value={period} onChange={setPeriod} />

      <View style={s.scoreCard}>
        <Text style={s.scoreLabel}>Formulary Adherence</Text>
        <Text style={[s.score, { color: scoreColor }]}>
          {score != null ? `${score.toFixed(1)}%` : '—'}
        </Text>
      </View>

      <View style={s.row2}>
        <InfoCard label="AMS Approvals"         value={data?.ams_approvals ?? 0}             color={C.blue}   />
        <InfoCard label="Waste Events"           value={data?.waste_events ?? 0}              color={C.coral}  />
        <InfoCard label="Restricted Rx"          value={data?.restricted_prescriptions ?? 0}  color={C.amber}  />
      </View>

      {waste.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Top Drug Waste</Text>
          {waste.slice(0, 8).map((item, i) => (
            <View key={i} style={s.wasteRow}>
              <Text style={s.drugName}>{item.drug_name}</Text>
              <Text style={s.drugQty}>{item.quantity} {item.unit}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const InfoCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={[s.infoCard, { borderLeftColor: color }]}>
    <Text style={[s.infoValue, { color }]}>{value}</Text>
    <Text style={s.infoLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  scoreCard: { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 24, alignItems: 'center', marginBottom: 16 },
  scoreLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  score: { fontFamily: FONT.uiBd, fontSize: 44 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  infoCard: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, borderLeftWidth: 3 },
  infoValue: { fontFamily: FONT.uiBd, fontSize: 20 },
  infoLabel: { fontFamily: FONT.uiMd, fontSize: 10, color: C.textSecondary, marginTop: 2 },
  sectionTitle: { fontFamily: FONT.uiSb, fontSize: 14, color: C.textSecondary, marginBottom: 10 },
  wasteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  drugName: { fontFamily: FONT.ui, fontSize: 14, color: C.text },
  drugQty: { fontFamily: FONT.uiSb, fontSize: 14, color: C.coral },
});
