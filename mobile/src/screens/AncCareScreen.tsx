import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { api } from '../services/api';

interface Enrollment {
  id: string;
  enrollment_date: string;
  expected_delivery_date: string;
  lmp_date: string;
  gravida: number;
  para: number;
  risk_category: string;
  enrollment_status: string;
  anc_visit_count: number;
}

const RISK_COLOR: Record<string, string> = { high: C.red, medium: C.amber, low: C.green };

export default function AncCareScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { patientId, patientName } = route.params ?? {};

  const [loading, setLoading]         = useState(true);
  const [enrollment, setEnrollment]   = useState<Enrollment | null>(null);

  // Enrollment form
  const [lmpDate, setLmpDate]   = useState('');
  const [gravida, setGravida]   = useState('1');
  const [para, setPara]         = useState('0');
  const [enrolling, setEnrolling] = useState(false);

  // Visit form
  const [weight, setWeight]           = useState('');
  const [bpSys, setBpSys]             = useState('');
  const [bpDia, setBpDia]             = useState('');
  const [fundalHeight, setFundalHeight] = useState('');
  const [fhr, setFhr]                 = useState('');
  const [hemoglobin, setHemoglobin]   = useState('');
  const [dangerSigns, setDangerSigns] = useState(false);
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [warnings, setWarnings]       = useState<{ message: string }[] | null>(null);
  const [ackWarnings, setAckWarnings] = useState(false);

  const load = useCallback(() => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/maternity/enrollments/patient/${patientId}`)
      .then((r: any) => {
        const list = (r.data ?? r)?.enrollments ?? [];
        setEnrollment(list.find((e: Enrollment) => e.enrollment_status === 'active') ?? list[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const register = async () => {
    if (!lmpDate) { Alert.alert('Required', 'Enter the LMP date (YYYY-MM-DD).'); return; }
    setEnrolling(true);
    try {
      await api.post('/maternity/enrollments', {
        patient_id: patientId,
        enrollment_date: new Date().toISOString().slice(0, 10),
        lmp_date: lmpDate,
        gravida: parseInt(gravida, 10) || 1,
        para: parseInt(para, 10) || 0,
      });
      await load();
    } catch (e: any) {
      Alert.alert('Enrollment failed', e?.response?.data?.message ?? 'Could not enroll patient.');
    } finally {
      setEnrolling(false);
    }
  };

  const buildVisitPayload = () => ({
    maternity_enrollment_id: enrollment?.id,
    patient_id: patientId,
    visit_date: new Date().toISOString().slice(0, 10),
    weight: weight ? Number(weight) : undefined,
    blood_pressure_systolic: bpSys ? Number(bpSys) : undefined,
    blood_pressure_diastolic: bpDia ? Number(bpDia) : undefined,
    fundal_height: fundalHeight ? Number(fundalHeight) : undefined,
    fetal_heart_rate: fhr ? Number(fhr) : undefined,
    hemoglobin: hemoglobin ? Number(hemoglobin) : undefined,
    danger_signs_discussed: dangerSigns,
    notes: notes || undefined,
  });

  const submitVisit = async () => {
    if (!enrollment) return;
    setSaving(true);
    try {
      const payload = buildVisitPayload();
      const pre: any = await api.post('/maternity/anc-visits/precheck', payload);
      const precheck = pre.data ?? pre;
      const blockers = precheck?.blockers ?? [];
      const warns = precheck?.warnings ?? [];

      if (blockers.length > 0) {
        const requiredActions = precheck?.required_actions ?? [];
        const suggestedOrders = precheck?.suggested_orders ?? [];
        const detail = [
          blockers[0]?.message ?? 'Safety validation failed.',
          requiredActions.length ? `\n\nRequired: ${requiredActions.join('; ')}` : '',
          suggestedOrders.length ? `\nSuggested orders: ${suggestedOrders.join('; ')}` : '',
        ].join('');
        Alert.alert('Visit blocked — urgent action required', detail);
        setSaving(false);
        return;
      }
      if (warns.length > 0 && !ackWarnings) {
        setWarnings(warns);
        setSaving(false);
        return;
      }

      await api.post('/maternity/anc-visits', { ...payload, safety_warnings_acknowledged: ackWarnings });
      Alert.alert('Saved', 'ANC visit recorded.');
      setWeight(''); setBpSys(''); setBpDia(''); setFundalHeight(''); setFhr('');
      setHemoglobin(''); setDangerSigns(false); setNotes(''); setWarnings(null); setAckWarnings(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not save ANC visit.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;
  }

  if (!patientId) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>No patient selected.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScreenHeader
        title="ANC / PMTCT Care"
        subtitle={patientName}
        accent={C.teal}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!enrollment ? (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Register for Antenatal Care</Text>
            <Text style={s.label}>LMP Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={lmpDate} onChangeText={setLmpDate} placeholder="2026-01-15" placeholderTextColor={C.textMuted} />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Gravida</Text>
                <TextInput style={s.input} value={gravida} onChangeText={setGravida} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Para</Text>
                <TextInput style={s.input} value={para} onChangeText={setPara} keyboardType="number-pad" />
              </View>
            </View>
            <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={register} disabled={enrolling}>
              {enrolling ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Register ANC</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: RISK_COLOR[enrollment.risk_category] ?? C.blue }]}>
              <Text style={s.sectionTitle}>Current Pregnancy</Text>
              <Text style={s.statLine}>EDD: {enrollment.expected_delivery_date ? new Date(enrollment.expected_delivery_date).toLocaleDateString() : '—'}</Text>
              <Text style={s.statLine}>G{enrollment.gravida}P{enrollment.para} · {enrollment.anc_visit_count ?? 0} ANC visits recorded</Text>
              <Text style={[s.statLine, { color: RISK_COLOR[enrollment.risk_category] ?? C.blue, fontFamily: FONT.uiBd }]}>
                {(enrollment.risk_category ?? 'low').toUpperCase()} RISK
              </Text>
            </View>

            <View style={s.card}>
              <Text style={s.sectionTitle}>Record ANC Visit</Text>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Weight (kg)</Text>
                  <TextInput style={s.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Fundal Height (cm)</Text>
                  <TextInput style={s.input} value={fundalHeight} onChangeText={setFundalHeight} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>BP Systolic</Text>
                  <TextInput style={s.input} value={bpSys} onChangeText={setBpSys} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>BP Diastolic</Text>
                  <TextInput style={s.input} value={bpDia} onChangeText={setBpDia} keyboardType="number-pad" />
                </View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Fetal Heart Rate</Text>
                  <TextInput style={s.input} value={fhr} onChangeText={setFhr} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Hemoglobin (g/dL)</Text>
                  <TextInput style={s.input} value={hemoglobin} onChangeText={setHemoglobin} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={s.switchRow}>
                <Text style={s.label}>Danger signs discussed</Text>
                <Switch value={dangerSigns} onValueChange={setDangerSigns} trackColor={{ true: C.teal }} />
              </View>
              <Text style={s.label}>Notes</Text>
              <TextInput
                style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={notes} onChangeText={setNotes} multiline
              />

              {warnings && (
                <View style={s.warnBox}>
                  <Icon name="alert" size={16} color={C.amber} />
                  <View style={{ flex: 1 }}>
                    {warnings.map((w, i) => (
                      <Text key={i} style={s.warnText}>{w.message}</Text>
                    ))}
                    <TouchableOpacity
                      style={s.ackRow}
                      onPress={() => setAckWarnings(v => !v)}
                    >
                      <View style={[s.checkbox, ackWarnings && { backgroundColor: C.amber, borderColor: C.amber }]}>
                        {ackWarnings && <Icon name="check" size={12} color="#000" />}
                      </View>
                      <Text style={s.warnText}>I acknowledge these safety warnings</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[s.primaryBtn, warnings && !ackWarnings && { opacity: 0.5 }]}
                activeOpacity={0.85}
                onPress={submitVisit}
                disabled={saving || (!!warnings && !ackWarnings)}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save ANC Visit</Text>}
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
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  primaryBtn:  { backgroundColor: C.teal, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontFamily: FONT.uiBd, fontSize: 14, color: '#fff' },
  warnBox:     { flexDirection: 'row', gap: 8, backgroundColor: `${C.amber}18`, borderWidth: 1, borderColor: `${C.amber}50`, borderRadius: RADIUS.md, padding: 12, marginTop: 8 },
  warnText:    { fontFamily: FONT.uiMd, fontSize: 12, color: C.text, marginBottom: 4 },
  ackRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  emptyText:   { fontFamily: FONT.uiMd, fontSize: 14, color: C.textMuted },
});
