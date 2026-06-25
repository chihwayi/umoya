import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const EPDS_QUESTIONS = [
  { key: 'q1',  text: 'I have been able to laugh and see the funny side of things.',    reverse: true  },
  { key: 'q2',  text: 'I have looked forward with enjoyment to things.',                reverse: true  },
  { key: 'q3',  text: 'I have blamed myself unnecessarily when things went wrong.',     reverse: false },
  { key: 'q4',  text: 'I have been anxious or worried for no good reason.',             reverse: false },
  { key: 'q5',  text: 'I have felt scared or panicky for no very good reason.',         reverse: false },
  { key: 'q6',  text: 'Things have been getting on top of me.',                         reverse: false },
  { key: 'q7',  text: 'I have been so unhappy that I have had difficulty sleeping.',    reverse: false },
  { key: 'q8',  text: 'I have felt sad or miserable.',                                  reverse: false },
  { key: 'q9',  text: 'I have been so unhappy that I have been crying.',                reverse: false },
  { key: 'q10', text: 'The thought of harming myself has occurred to me.',              reverse: false },
];

const OPTIONS_NORMAL  = ['As much as always', 'Not quite so much', 'Definitely not so much', 'Not at all'];
const OPTIONS_REVERSE = ['Never', 'Hardly ever', 'Sometimes', 'Yes, most of the time'];

const RISK_COLOR: Record<string, string> = { critical: C.red, high: C.coral, moderate: C.amber, low: C.green };

export default function EpdsScreen({ route }: { route: any }) {
  const { assessmentId, patientId } = route.params;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const allAnswered = Object.keys(scores).length === 10;

  const submit = async () => {
    if (!allAnswered) { Alert.alert('Incomplete', 'Please answer all 10 questions.'); return; }
    setSubmitting(true);
    try {
      const payload: any = { assessmentId, patientId };
      EPDS_QUESTIONS.forEach(q => { payload[q.key] = scores[q.key] ?? 0; });
      const r: any = await api.post('/pmh/epds', payload);
      setResult(r.data ?? r);
    } catch { Alert.alert('Error', 'Submission failed.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>EPDS Screening</Text>
      <Text style={s.sub}>Total so far: <Text style={s.total}>{total}</Text> / 30</Text>

      {result ? (
        <View style={[s.resultCard, { borderLeftColor: RISK_COLOR[result.cdss_risk_level] ?? C.textMuted, borderLeftWidth: 4 }]}>
          <Text style={[s.resultScore, { color: RISK_COLOR[result.cdss_risk_level] }]}>Score: {result.total_score}</Text>
          <Text style={[s.resultLevel, { color: RISK_COLOR[result.cdss_risk_level] }]}>{result.risk_level?.toUpperCase()}</Text>
          <Text style={s.resultAction}>{result.cdss_alert}</Text>
        </View>
      ) : (
        <>
          {EPDS_QUESTIONS.map((q, qi) => (
            <View key={q.key} style={s.qCard}>
              <Text style={s.qText}>{qi + 1}. {q.text}</Text>
              {(q.reverse ? OPTIONS_NORMAL : OPTIONS_REVERSE).map((opt, oi) => (
                <TouchableOpacity
                  key={oi}
                  style={[s.option, scores[q.key] === oi && s.optionSelected]}
                  onPress={() => setScores(prev => ({ ...prev, [q.key]: oi }))}
                >
                  <Text style={[s.optionText, scores[q.key] === oi && s.optionTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <TouchableOpacity
            style={[s.submitBtn, !allAnswered && s.submitDisabled]}
            onPress={submit}
            disabled={!allAnswered || submitting}
          >
            <Text style={s.submitText}>{submitting ? 'Submitting…' : 'Submit EPDS'}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  heading:            { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:                { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  total:              { fontFamily: FONT.uiBd, color: C.teal },
  qCard:              { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 12, ...SHADOW.sm },
  qText:              { fontFamily: FONT.uiMd, fontSize: 14, color: C.text, marginBottom: 10 },
  option:             { paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.sm, marginBottom: 4 },
  optionSelected:     { backgroundColor: C.teal + '33' },
  optionText:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  optionTextSelected: { fontFamily: FONT.uiMd, color: C.teal },
  submitBtn:          { backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitDisabled:     { opacity: 0.5 },
  submitText:         { fontFamily: FONT.uiSb, fontSize: 15, color: C.bg },
  resultCard:         { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, ...SHADOW.card },
  resultScore:        { fontFamily: FONT.uiBd, fontSize: 32 },
  resultLevel:        { fontFamily: FONT.uiSb, fontSize: 14, marginBottom: 10 },
  resultAction:       { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 20 },
});
