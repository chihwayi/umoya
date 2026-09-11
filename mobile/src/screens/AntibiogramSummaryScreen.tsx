import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { Microscope } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const SPECIMEN_TYPES = ['blood', 'urine', 'wound', 'sputum', 'stool'];

interface DrugStats { S: number; I: number; R: number; total: number }
interface Summary {
  periodLabel: string;
  specimenType: string;
  data: Record<string, Record<string, DrugStats>>;
  generatedAt: string;
}

export default function AntibiogramSummaryScreen() {
  const [specimenType, setSpecimenType] = useState('blood');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [syndrome, setSyndrome] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [recommendation, setRecommendation] = useState<any>(null);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/antibiogram/summary?specimenType=${specimenType}`)
      .then((r: any) => setSummary(r.data ?? r))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [specimenType]);

  async function getRecommendation() {
    if (!syndrome.trim()) return;
    setRecLoading(true);
    try {
      const r: any = await api.post('/antibiogram/cdss/empirical', { syndrome: syndrome.trim(), severity });
      setRecommendation(r.data ?? r);
    } catch {
      setRecommendation(null);
    } finally {
      setRecLoading(false);
    }
  }

  const organisms = summary?.data ? Object.entries(summary.data) : [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Antibiogram</Text>
      <Text style={s.sub}>Facility-wide antimicrobial resistance patterns</Text>

      <View style={s.chipRow}>
        {SPECIMEN_TYPES.map(t => (
          <TouchableOpacity key={t} style={[s.chip, specimenType === t && s.chipActive]} onPress={() => setSpecimenType(t)}>
            <Text style={[s.chipText, specimenType === t && s.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />
      ) : !summary || organisms.length === 0 ? (
        <Text style={s.empty}>No resistance summary available for this specimen type yet. Summaries are generated monthly from recorded culture results.</Text>
      ) : (
        <>
          <Text style={s.periodLabel}>Period: {summary.periodLabel}</Text>
          {organisms.map(([organism, drugs]) => (
            <View key={organism} style={s.card}>
              <View style={s.cardTop}>
                <Microscope size={16} color={C.teal} />
                <Text style={s.organismName}> {organism}</Text>
              </View>
              {Object.entries(drugs).map(([drug, stats]) => {
                const susceptiblePct = stats.total > 0 ? Math.round((stats.S / stats.total) * 100) : 0;
                const color = susceptiblePct >= 80 ? C.green : susceptiblePct >= 50 ? C.amber : C.coral;
                return (
                  <View key={drug} style={s.drugRow}>
                    <Text style={s.drugName}>{drug}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${susceptiblePct}%` as any, backgroundColor: color }]} />
                    </View>
                    <Text style={[s.drugPct, { color }]}>{susceptiblePct}% S</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </>
      )}

      <View style={s.divider} />

      <Text style={s.heading2}>Empirical Therapy Recommendation</Text>
      <Text style={s.sub}>Based on local resistance patterns and syndrome</Text>

      <TextInput
        style={s.input}
        placeholder="Infection syndrome, e.g. urinary tract infection"
        placeholderTextColor={C.textMuted}
        value={syndrome}
        onChangeText={setSyndrome}
      />
      <View style={s.chipRow}>
        {['mild', 'moderate', 'severe'].map(sev => (
          <TouchableOpacity key={sev} style={[s.chip, severity === sev && s.chipActive]} onPress={() => setSeverity(sev)}>
            <Text style={[s.chipText, severity === sev && s.chipTextActive]}>{sev}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={s.primaryBtn} onPress={getRecommendation} disabled={recLoading || !syndrome.trim()}>
        {recLoading ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={s.primaryBtnText}>Get Recommendation</Text>}
      </TouchableOpacity>

      {recommendation && (
        <View style={s.recCard}>
          <Text style={s.recDrug}>{recommendation.recommendation}</Text>
          {recommendation.rationale?.map((line: string, i: number) => (
            <Text key={i} style={s.recRationale}>• {line}</Text>
          ))}
          {recommendation.avoid?.length > 0 && (
            <Text style={s.recAvoid}>Avoid: {recommendation.avoid.join(', ')}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  heading2:    { fontFamily: FONT.uiBd, fontSize: 18, color: C.text, marginBottom: 2 },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 14 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: C.surface },
  chipActive:  { backgroundColor: C.teal },
  chipText:    { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: C.bg },
  empty:       { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 19 },
  periodLabel: { fontFamily: FONT.uiSb, fontSize: 12, color: C.textMuted, marginBottom: 10 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  organismName: { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, fontStyle: 'italic' },
  drugRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  drugName:    { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, width: 100 },
  barTrack:    { flex: 1, height: 8, backgroundColor: C.bg, borderRadius: 4, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 4 },
  drugPct:     { fontFamily: FONT.uiSb, fontSize: 11, width: 44, textAlign: 'right' },
  divider:     { height: 1, backgroundColor: C.border, marginVertical: 24 },
  input:       { backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: FONT.ui, marginBottom: 14, fontSize: 15 },
  primaryBtn:  { alignItems: 'center', justifyContent: 'center', backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 14, marginTop: 4 },
  primaryBtnText: { fontFamily: FONT.uiSb, fontSize: 15, color: C.bg },
  recCard:     { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginTop: 16, ...SHADOW.sm },
  recDrug:     { fontFamily: FONT.uiBd, fontSize: 18, color: C.teal, marginBottom: 8 },
  recRationale: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 4, lineHeight: 18 },
  recAvoid:    { fontFamily: FONT.uiSb, fontSize: 12, color: C.coral, marginTop: 8 },
});
