import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS } from '../design/tokens';

interface Props {
  token: string;
}

export default function PreVisitIntakeScreen({ token }: Props) {
  const [form, setForm] = useState<any>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [treatmentConsent, setTreatmentConsent] = useState(false);
  const [dataSharingConsent, setDataSharingConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/intake/${token}`).then((r) => setForm(r.data));
  }, [token]);

  async function submit() {
    if (!chiefComplaint.trim()) {
      Alert.alert('Required', 'Please describe your main reason for visiting.');
      return;
    }
    if (!treatmentConsent) {
      Alert.alert('Consent Required', 'You must consent to treatment to proceed.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/intake/${token}/submit`, {
        chiefComplaint,
        currentMedications: medications.split('\n').filter(Boolean).map((m) => ({ name: m })),
        knownAllergies: allergies.split('\n').filter(Boolean).map((a) => ({ allergen: a })),
        currentSymptoms: [],
        treatmentConsent,
        dataSharingConsent,
        smsConsent,
      });
      setDone(true);
    } catch {
      Alert.alert('Error', 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) return <ActivityIndicator style={{ flex: 1 }} color={C.blue} />;

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneIcon}>✓</Text>
        <Text style={styles.doneTitle}>All done!</Text>
        <Text style={styles.doneSub}>
          Your information has been sent to your care team.
          {form.appointment_time ? `\nSee you at ${form.appointment_time}!` : ''}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.heading}>Before Your Visit</Text>
      {form.appointment_date && (
        <Text style={styles.sub}>
          Appointment: {form.appointment_date} at {form.appointment_time}
        </Text>
      )}

      <Text style={styles.label}>What brings you in today? *</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={3}
        placeholder="Describe your main symptom or concern"
        placeholderTextColor={C.textMuted}
        value={chiefComplaint}
        onChangeText={setChiefComplaint}
      />

      <Text style={styles.label}>Current medications (one per line)</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={4}
        placeholder="e.g. Metformin 500mg twice daily"
        placeholderTextColor={C.textMuted}
        value={medications}
        onChangeText={setMedications}
      />

      <Text style={styles.label}>Known allergies (one per line)</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={3}
        placeholder="e.g. Penicillin, Latex"
        placeholderTextColor={C.textMuted}
        value={allergies}
        onChangeText={setAllergies}
      />

      <View style={styles.consentRow}>
        <Switch
          value={treatmentConsent}
          onValueChange={setTreatmentConsent}
          trackColor={{ true: C.green, false: C.border }}
        />
        <Text style={styles.consentLabel}>I consent to examination and treatment *</Text>
      </View>
      <View style={styles.consentRow}>
        <Switch
          value={dataSharingConsent}
          onValueChange={setDataSharingConsent}
          trackColor={{ true: C.green, false: C.border }}
        />
        <Text style={styles.consentLabel}>I consent to my data being shared with my care team</Text>
      </View>
      <View style={styles.consentRow}>
        <Switch
          value={smsConsent}
          onValueChange={setSmsConsent}
          trackColor={{ true: C.green, false: C.border }}
        />
        <Text style={styles.consentLabel}>Send me SMS reminders and health updates</Text>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
        onPress={submit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit &amp; I'm Ready</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  heading:       { fontFamily: FONT.uiBd, fontSize: 20, color: C.text, marginBottom: 4 },
  sub:           { fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  label:         { fontSize: 13, color: C.text, fontFamily: FONT.uiBd, marginBottom: 4, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm,
    padding: 10, color: C.text, backgroundColor: C.card, fontSize: 14,
    textAlignVertical: 'top',
  },
  consentRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  consentLabel:  { flex: 1, fontSize: 13, color: C.text },
  submitBtn:     {
    backgroundColor: C.blue, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', marginTop: 28, marginBottom: 40,
  },
  submitText:    { fontFamily: FONT.uiBd, color: '#fff', fontSize: 16 },
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneIcon:      { fontSize: 64, color: C.green, marginBottom: 16 },
  doneTitle:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 8 },
  doneSub:       { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 22 },
});
