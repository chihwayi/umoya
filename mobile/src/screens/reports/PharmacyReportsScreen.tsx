import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';
import { C, FONT, RADIUS } from '../../design/tokens';

interface FormularyReport {
  adherence_rate_pct: number;
  off_formulary_count: number;
  top_off_formulary_drugs_table: { drug_name: string; n: number }[];
}

interface WasteReport {
  expired_units: number;
  returned_units: number;
  damaged_units: number;
  near_expiry_items: { drug_name: string; expiry_date: string; quantity: number }[];
}

interface AmsReport {
  total_antibiotic_prescriptions: number;
  restricted_antibiotic_prescriptions: number;
  cultures_collected: number;
}

export default function PharmacyReportsScreen() {
  const [formulary, setFormulary] = useState<FormularyReport | null>(null);
  const [waste, setWaste] = useState<WasteReport | null>(null);
  const [ams, setAms] = useState<AmsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const period = new Date().toISOString().slice(0, 7).replace('-', '');
    Promise.all([
      api.get(`/pharmacy/reports/formulary-adherence?period=${period}`),
      api.get(`/pharmacy/reports/drug-waste?period=${period}`),
      api.get(`/pharmacy/reports/ams?period=${period}`),
    ])
      .then(([f, w, a]: any[]) => {
        setFormulary(f.data ?? f);
        setWaste(w.data ?? w);
        setAms(a.data ?? a);
      })
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

  const score = formulary?.adherence_rate_pct ?? null;
  const scoreColor = score == null ? C.textMuted : score >= 90 ? C.green : score >= 75 ? C.amber : C.coral;
  const wasteItems = waste?.near_expiry_items ?? [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={s.monthLabel}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>

      <View style={s.scoreCard}>
        <Text style={s.scoreLabel}>Formulary Adherence</Text>
        <Text style={[s.score, { color: scoreColor }]}>
          {score != null ? `${score.toFixed(1)}%` : '—'}
        </Text>
      </View>

      <View style={s.row2}>
        <InfoCard label="Off-Formulary"    value={formulary?.off_formulary_count ?? 0}                    color={C.amber} />
        <InfoCard label="Antibiotics Rx"   value={ams?.total_antibiotic_prescriptions ?? 0}                color={C.blue}  />
        <InfoCard label="Restricted Abx"   value={ams?.restricted_antibiotic_prescriptions ?? 0}           color={C.coral} />
      </View>

      <View style={s.row2}>
        <InfoCard label="Expired Units"    value={waste?.expired_units ?? 0}   color={C.coral} />
        <InfoCard label="Returned Units"   value={waste?.returned_units ?? 0}  color={C.textSecondary} />
        <InfoCard label="Damaged Units"    value={waste?.damaged_units ?? 0}   color={C.amber} />
      </View>

      {wasteItems.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Near-Expiry Stock (90 days)</Text>
          {wasteItems.slice(0, 8).map((item, i) => (
            <View key={i} style={s.wasteRow}>
              <Text style={s.drugName}>{item.drug_name}</Text>
              <Text style={s.drugQty}>{item.quantity} · {new Date(item.expiry_date).toLocaleDateString()}</Text>
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
  monthLabel: { fontFamily: FONT.uiSb, fontSize: 13, color: C.textMuted, marginBottom: 14 },
  scoreCard: { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 24, alignItems: 'center', marginBottom: 16 },
  scoreLabel: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  score: { fontFamily: FONT.uiBd, fontSize: 44 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  infoCard: { flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, borderLeftWidth: 3 },
  infoValue: { fontFamily: FONT.uiBd, fontSize: 20 },
  infoLabel: { fontFamily: FONT.uiMd, fontSize: 10, color: C.textSecondary, marginTop: 2 },
  sectionTitle: { fontFamily: FONT.uiSb, fontSize: 14, color: C.textSecondary, marginBottom: 10, marginTop: 8 },
  wasteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  drugName: { fontFamily: FONT.ui, fontSize: 14, color: C.text },
  drugQty: { fontFamily: FONT.uiSb, fontSize: 12, color: C.coral },
});
