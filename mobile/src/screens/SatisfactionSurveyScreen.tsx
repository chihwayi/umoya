import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS } from '../design/tokens';

interface Props {
  token: string;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onChange(s)}>
          <Text style={{ fontSize: 28, color: s <= value ? '#F59E0B' : '#D1D5DB' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NpsRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
      {Array.from({ length: 11 }, (_, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onChange(i)}
          style={[styles.npsBtn, value === i && styles.npsBtnActive]}
        >
          <Text style={[styles.npsBtnText, value === i && styles.npsBtnTextActive]}>{i}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SatisfactionSurveyScreen({ token }: Props) {
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [overallCsat, setOverallCsat] = useState(0);
  const [npsScore, setNpsScore] = useState(-1);
  const [ratingWait, setRatingWait] = useState(0);
  const [ratingClinician, setRatingClinician] = useState(0);
  const [ratingFacility, setRatingFacility] = useState(0);
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    api.get(`/csat/survey/${token}`)
      .then((r: any) => setSurvey(r.data ?? r))
      .catch(() => Alert.alert('Error', 'Survey not found or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit() {
    if (overallCsat === 0) { Alert.alert('Required', 'Please rate your overall experience.'); return; }
    if (npsScore < 0) { Alert.alert('Required', 'Please complete the NPS question.'); return; }
    setSubmitting(true);
    try {
      await api.post(`/csat/survey/${token}/submit`, {
        overallCsat, npsScore,
        ratingWait: ratingWait || undefined,
        ratingClinician: ratingClinician || undefined,
        ratingFacility: ratingFacility || undefined,
        freeText: freeText || undefined,
      });
      setDone(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.blue} />;

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Text style={{ fontSize: 56 }}>🙏</Text>
        <Text style={styles.doneTitle}>Thank you!</Text>
        <Text style={styles.doneSub}>Your feedback helps us improve care for every patient.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.heading}>How was your visit?</Text>
      {survey?.encounter_date && (
        <Text style={styles.sub}>Visit on {new Date(survey.encounter_date).toLocaleDateString()}</Text>
      )}

      <Text style={styles.label}>Overall experience *</Text>
      <StarRating value={overallCsat} onChange={setOverallCsat} />

      <Text style={styles.label}>How likely are you to recommend us? (0 = Not at all, 10 = Definitely) *</Text>
      <NpsRow value={npsScore} onChange={setNpsScore} />

      <Text style={styles.label}>Wait time</Text>
      <StarRating value={ratingWait} onChange={setRatingWait} />

      <Text style={styles.label}>Your clinician</Text>
      <StarRating value={ratingClinician} onChange={setRatingClinician} />

      <Text style={styles.label}>Facility & cleanliness</Text>
      <StarRating value={ratingFacility} onChange={setRatingFacility} />

      <Text style={styles.label}>Additional comments (optional)</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder="What went well? What can we improve?"
        placeholderTextColor={C.textMuted}
        value={freeText}
        onChangeText={setFreeText}
      />

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
        onPress={submit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Feedback</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  heading:      { fontFamily: FONT.uiBd, fontSize: 20, color: C.text, marginBottom: 4 },
  sub:          { fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  label:        { fontFamily: FONT.uiBd, fontSize: 13, color: C.text, marginTop: 16 },
  npsBtn:       { width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  npsBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  npsBtnText:   { fontSize: 13, color: C.text },
  npsBtnTextActive: { color: '#fff', fontFamily: FONT.uiBd },
  textArea:     { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, padding: 10, color: C.text, fontSize: 13, textAlignVertical: 'top', marginTop: 6 },
  submitBtn:    { backgroundColor: C.blue, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  submitText:   { fontFamily: FONT.uiBd, color: '#fff', fontSize: 15 },
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneTitle:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginTop: 16 },
  doneSub:      { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 8 },
});
