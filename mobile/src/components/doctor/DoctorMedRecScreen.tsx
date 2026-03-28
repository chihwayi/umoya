import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, Badge, AiPulse } from '../ui';
import { PrescriptionsService, ApiPrescription } from '../../services/prescriptions';
import { CdssService, MedRecResult } from '../../services/cdss';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

type Decision = 'continue' | 'hold' | 'discontinue' | 'modify';

const DECISION_CONFIG: Record<Decision, { label: string; color: string }> = {
  continue:     { label: 'Continue',     color: C.green },
  hold:         { label: 'Hold',         color: C.orange },
  discontinue:  { label: 'Discontinue',  color: C.red },
  modify:       { label: 'Modify',       color: C.blue },
};

const DECISIONS: Decision[] = ['continue', 'hold', 'discontinue', 'modify'];

// ─── Component ────────────────────────────────────────────────────────────────

export const DoctorMedRecScreen: React.FC<Props> = ({ patientId, patientName, onBack }) => {
  const insets = useSafeAreaInsets();

  const [meds, setMeds]           = useState<ApiPrescription[]>([]);
  const [loading, setLoading]     = useState(true);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [aiResult, setAiResult]   = useState<MedRecResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRan, setAiRan]         = useState(false);

  useEffect(() => {
    PrescriptionsService.forPatient(patientId)
      .then(data => {
        const active = data.filter(m => m.status === 'active' || !m.status);
        setMeds(active);
        const init: Record<string, Decision> = {};
        active.forEach(m => { init[m.id] = 'continue'; });
        setDecisions(init);
      })
      .catch(() => setMeds([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  const runAiCheck = useCallback(async () => {
    if (meds.length === 0) return;
    setAiLoading(true);
    setAiRan(true);
    const medNames = meds.map(m => {
      const name = m.drugName ?? m.genericName ?? 'Unknown';
      const dose = m.dosage ? ` ${m.dosage}` : '';
      const freq = m.frequency ? ` ${m.frequency}` : '';
      return `${name}${dose}${freq}`;
    });
    const result = await CdssService.reconcileMedications({
      patientId,
      homeMeds:     medNames,
      hospitalMeds: medNames,
      diagnoses:    [],
    });
    setAiResult(result);
    setAiLoading(false);
  }, [meds, patientId]);

  const setDecision = (id: string, d: Decision) =>
    setDecisions(prev => ({ ...prev, [id]: d }));

  const formatMed = (m: ApiPrescription) => {
    const parts = [m.dosage, m.frequency, m.route].filter(Boolean);
    return parts.join(' · ') || 'Dose not specified';
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Sub-header */}
      <View style={s.subHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Icon name="back" size={20} color={C.teal} />
          <Text style={s.backText}>Rounds</Text>
        </TouchableOpacity>
        <Text style={s.subTitle} numberOfLines={1}>Med Rec — {patientName}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.teal} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
          {/* Info banner */}
          <View style={s.infoBanner}>
            <Icon name="sparkle" size={14} color={C.blue} />
            <Text style={s.infoText}>
              Review each medication and set a reconciliation decision, then run the AI check.
            </Text>
          </View>

          {/* Medication list */}
          {meds.length === 0 ? (
            <View style={s.center}>
              <Icon name="pill" size={44} color={C.border} />
              <Text style={s.emptyTitle}>No active medications</Text>
            </View>
          ) : (
            meds.map(m => {
              const dec = decisions[m.id] ?? 'continue';
              const cfg = DECISION_CONFIG[dec];
              return (
                <Card key={m.id} style={[s.medCard, { borderLeftColor: cfg.color, borderLeftWidth: 3 }]}>
                  <Text style={s.medName}>{m.drugName ?? m.genericName ?? 'Unknown'}</Text>
                  <Text style={s.medDetail}>{formatMed(m)}</Text>
                  {m.instructions && <Text style={s.medInstr}>{m.instructions}</Text>}
                  {/* Decision toggles */}
                  <View style={s.decisionRow}>
                    {DECISIONS.map(d => {
                      const dc = DECISION_CONFIG[d];
                      const active = dec === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[s.decBtn, active && { backgroundColor: dc.color + '22', borderColor: dc.color }]}
                          onPress={() => setDecision(m.id, d)}
                          activeOpacity={0.75}
                        >
                          <Text style={[s.decText, active && { color: dc.color }]}>{dc.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Card>
              );
            })
          )}

          {/* AI check button */}
          {meds.length > 0 && (
            <TouchableOpacity
              style={[s.aiBtn, aiLoading && { opacity: 0.7 }]}
              onPress={runAiCheck}
              activeOpacity={0.85}
              disabled={aiLoading}
            >
              {aiLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <AiPulse size={18} active />
                    <Text style={s.aiBtnText}>Run AI Reconciliation Check</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {/* AI results */}
          {aiRan && !aiLoading && (
            aiResult === null ? (
              <Card style={s.abstainCard}>
                <Icon name="sparkle" size={16} color={C.textMuted} />
                <Text style={s.abstainText}>
                  AI reconciliation unavailable — reconcile manually per protocol.
                </Text>
              </Card>
            ) : (
              <>
                {aiResult.duplicates.length > 0 && (
                  <Card style={[s.resultCard, { borderLeftColor: C.orange, borderLeftWidth: 3 }]}>
                    <Text style={s.resultLabel}>POSSIBLE DUPLICATES</Text>
                    {aiResult.duplicates.map((d, i) => (
                      <View key={i} style={s.resultItem}>
                        <Icon name="escalate" size={12} color={C.orange} />
                        <Text style={s.resultText}>{d}</Text>
                      </View>
                    ))}
                  </Card>
                )}
                {aiResult.interactions.length > 0 && (
                  <Card style={[s.resultCard, { borderLeftColor: C.red, borderLeftWidth: 3 }]}>
                    <Text style={s.resultLabel}>INTERACTIONS FLAGGED</Text>
                    {aiResult.interactions.map((d, i) => (
                      <View key={i} style={s.resultItem}>
                        <Icon name="escalate" size={12} color={C.red} />
                        <Text style={s.resultText}>{d}</Text>
                      </View>
                    ))}
                  </Card>
                )}
                {aiResult.omissions.length > 0 && (
                  <Card style={[s.resultCard, { borderLeftColor: C.blue, borderLeftWidth: 3 }]}>
                    <Text style={s.resultLabel}>POSSIBLE OMISSIONS</Text>
                    {aiResult.omissions.map((d, i) => (
                      <View key={i} style={s.resultItem}>
                        <Icon name="sparkle" size={12} color={C.blue} />
                        <Text style={s.resultText}>{d}</Text>
                      </View>
                    ))}
                  </Card>
                )}
                {aiResult.recommendations.length > 0 && (
                  <Card style={[s.resultCard, { borderLeftColor: C.teal, borderLeftWidth: 3 }]}>
                    <Text style={s.resultLabel}>RECOMMENDATIONS</Text>
                    {aiResult.recommendations.map((d, i) => (
                      <View key={i} style={s.resultItem}>
                        <Text style={s.resultNum}>{i + 1}.</Text>
                        <Text style={s.resultText}>{d}</Text>
                      </View>
                    ))}
                  </Card>
                )}
                {[...aiResult.duplicates, ...aiResult.interactions, ...aiResult.omissions, ...aiResult.recommendations].length === 0 && (
                  <Card style={[s.resultCard, { borderLeftColor: C.green, borderLeftWidth: 3 }]}>
                    <View style={s.resultItem}>
                      <Icon name="check" size={14} color={C.green} />
                      <Text style={[s.resultText, { color: C.green }]}>No issues found — medications appear safe.</Text>
                    </View>
                  </Card>
                )}
              </>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  subHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:   { fontFamily: FONT.ui, fontSize: 14, color: C.teal },
  subTitle:   { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, flex: 1 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.blue + '12', borderRadius: RADIUS.md, padding: 12 },
  infoText:   { fontFamily: FONT.ui, fontSize: 13, color: C.text, flex: 1, lineHeight: 18 },
  emptyTitle: { fontFamily: FONT.uiBd, fontSize: 16, color: C.textMuted },
  medCard:    { gap: 6 },
  medName:    { fontFamily: FONT.uiBd, fontSize: 15, color: C.text },
  medDetail:  { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
  medInstr:   { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
  decisionRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  decBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg,
  },
  decText:    { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.teal, borderRadius: RADIUS.md, padding: 14,
  },
  aiBtnText:  { fontFamily: FONT.uiBd, fontSize: 15, color: '#fff' },
  abstainCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: C.border },
  abstainText: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted, flex: 1 },
  resultCard: { gap: 8 },
  resultLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted, letterSpacing: 0.8 },
  resultItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resultText: { fontFamily: FONT.ui, fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  resultNum:  { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted, minWidth: 18 },
});
