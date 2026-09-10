import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { api } from '../services/api';

interface Enrollment {
  id: string;
  enrollment_date: string;
  enrollment_number: string;
  baseline_who_stage?: string;
}

const WHO_STAGES = ['1', '2', '3', '4'];

// MoHCC ARV status codes — required for the WHO EAC-eligibility safety check
// (two consecutive unsuppressed viral loads while on ART) to ever be able to
// fire; omitting this silently disables that check for any visit recorded here.
const ARV_STATUS_OPTIONS: { code: string; label: string }[] = [
  { code: '2a', label: 'Start ARV' },
  { code: '3',  label: 'Continue' },
  { code: '4',  label: 'Change' },
  { code: '5',  label: 'Stop' },
  { code: '6',  label: 'Restart' },
];

export default function HivCareScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { patientId, patientName } = route.params ?? {};

  const [loading, setLoading]       = useState(true);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrolling, setEnrolling]   = useState(false);

  const [visitDate]      = useState(new Date().toISOString().slice(0, 10));
  const [whoStage, setWhoStage]           = useState('1');
  const [arvStatus, setArvStatus]         = useState('3');
  const [regimenName, setRegimenName]     = useState('');
  const [adherence, setAdherence]         = useState('');
  const [cd4Count, setCd4Count]           = useState('');
  const [viralLoad, setViralLoad]         = useState('');
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);

  const load = useCallback(() => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/hiv/enrollments/patient/${patientId}`)
      .then((r: any) => setEnrollment((r.data ?? r) || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const enroll = async () => {
    setEnrolling(true);
    try {
      await api.post('/hiv/enrollments', { patientId });
      await load();
    } catch (e: any) {
      Alert.alert('Enrollment failed', e?.response?.data?.message ?? 'Could not enroll patient in HIV care.');
    } finally {
      setEnrolling(false);
    }
  };

  const submitVisit = async () => {
    if (!enrollment) return;
    setSaving(true);
    try {
      await api.post('/hiv/visits', {
        enrollmentId: enrollment.id,
        patientId,
        visitDate,
        // 'A' = Present Self/conventional care (not in a DSD model) — the MoHCC
        // ART visit-source code for a standard in-clinic visit.
        visitType: 'A',
        whoClinicalStage: whoStage,
        arvStatus,
        arvRegimenName: regimenName || undefined,
        arvAdherencePercentage: adherence ? Number(adherence) : undefined,
        cd4Count: cd4Count ? Number(cd4Count) : undefined,
        cd4TestDate: cd4Count ? visitDate : undefined,
        viralLoad: viralLoad ? Number(viralLoad) : undefined,
        viralLoadUnit: 'copies/mL',
        viralLoadTestDate: viralLoad ? visitDate : undefined,
        visitNotes: notes || undefined,
      });
      Alert.alert('Saved', 'HIV clinical visit recorded.');
      setRegimenName(''); setAdherence(''); setCd4Count(''); setViralLoad(''); setNotes('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not save HIV visit.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  if (!patientId) {
    return <View style={s.center}><Text style={s.emptyText}>No patient selected.</Text></View>;
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="HIV Care" subtitle={patientName} accent={C.teal} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!enrollment ? (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Not enrolled in HIV care</Text>
            <Text style={s.statLine}>Enroll this patient to begin tracking ART regimen, CD4, and viral load.</Text>
            <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={enroll} disabled={enrolling}>
              {enrolling ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Enroll in HIV Care</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.sectionTitle}>HIV Care Enrollment</Text>
              <Text style={s.statLine}>{enrollment.enrollment_number}</Text>
              <Text style={s.statLine}>Enrolled {new Date(enrollment.enrollment_date).toLocaleDateString()}</Text>
            </View>

            <View style={s.card}>
              <Text style={s.sectionTitle}>Record Clinical Visit</Text>

              <Text style={s.label}>WHO Clinical Stage</Text>
              <View style={s.chipRow}>
                {WHO_STAGES.map(stg => (
                  <TouchableOpacity
                    key={stg}
                    style={[s.chip, whoStage === stg && { backgroundColor: `${C.teal}22`, borderColor: C.teal }]}
                    onPress={() => setWhoStage(stg)}
                  >
                    <Text style={[s.chipText, whoStage === stg && { color: C.teal }]}>Stage {stg}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>ARV Status</Text>
              <View style={s.chipRow}>
                {ARV_STATUS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.code}
                    style={[s.chip, arvStatus === opt.code && { backgroundColor: `${C.teal}22`, borderColor: C.teal }]}
                    onPress={() => setArvStatus(opt.code)}
                  >
                    <Text style={[s.chipText, arvStatus === opt.code && { color: C.teal }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>ARV Regimen</Text>
              <TextInput style={s.input} value={regimenName} onChangeText={setRegimenName} placeholder="e.g. TDF/3TC/DTG" placeholderTextColor={C.textMuted} />

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Adherence (%)</Text>
                  <TextInput style={s.input} value={adherence} onChangeText={setAdherence} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>CD4 Count</Text>
                  <TextInput style={s.input} value={cd4Count} onChangeText={setCd4Count} keyboardType="number-pad" />
                </View>
              </View>

              <Text style={s.label}>Viral Load (copies/mL)</Text>
              <TextInput style={s.input} value={viralLoad} onChangeText={setViralLoad} keyboardType="number-pad" />
              {viralLoad !== '' && Number(viralLoad) > 1000 && (
                <View style={s.warnBox}>
                  <Icon name="alert" size={14} color={C.red} />
                  <Text style={s.warnText}>Unsuppressed viral load (&gt;1000 copies/mL) — consider adherence counseling / EAC referral.</Text>
                </View>
              )}

              <Text style={s.label}>Notes</Text>
              <TextInput
                style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={notes} onChangeText={setNotes} multiline
              />

              <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={submitVisit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Visit</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  content:     { padding: 16, gap: 16, paddingBottom: 40 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, borderWidth: 1, borderColor: C.border, gap: 10, ...SHADOW.sm },
  sectionTitle: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, marginBottom: 2 },
  statLine:    { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary },
  label:       { fontFamily: FONT.uiMd, fontSize: 12, color: C.textMuted, marginTop: 4 },
  input:       { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, padding: 10, fontFamily: FONT.uiMd, fontSize: 14, color: C.text, backgroundColor: C.card },
  row:         { flexDirection: 'row', gap: 10 },
  chipRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipText:    { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary },
  primaryBtn:  { backgroundColor: C.teal, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontFamily: FONT.uiBd, fontSize: 14, color: '#fff' },
  warnBox:     { flexDirection: 'row', gap: 8, backgroundColor: `${C.red}18`, borderWidth: 1, borderColor: `${C.red}50`, borderRadius: RADIUS.md, padding: 10, alignItems: 'flex-start' },
  warnText:    { flex: 1, fontFamily: FONT.uiMd, fontSize: 12, color: C.text },
  emptyText:   { fontFamily: FONT.uiMd, fontSize: 14, color: C.textMuted },
});
