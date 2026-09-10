import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Activity, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';

export default function DialysisSessionScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'start' | 'complete'>('list');
  const [activeSession, setActiveSession] = useState<any>(null);
  const [cdssAlert, setCdssAlert] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Start-session form fields
  const [preWeightKg, setPreWeightKg] = useState('');
  const [preBpSystolic, setPreBpSystolic] = useState('');
  const [preBpDiastolic, setPreBpDiastolic] = useState('');
  const [bloodFlowMlMin, setBloodFlowMlMin] = useState('');
  const [dialysateFlowMlMin, setDialysateFlowMlMin] = useState('');

  // Complete-session form fields
  const [postWeightKg, setPostWeightKg] = useState('');
  const [ktV, setKtV] = useState('');
  const [postBpSystolic, setPostBpSystolic] = useState('');
  const [postBpDiastolic, setPostBpDiastolic] = useState('');
  const [complications, setComplications] = useState('');

  const loadSessions = useCallback(() => {
    setLoading(true);
    return api.get(`/dialysis/hd-sessions/${patientId}`)
      .then((r: any) => setSessions(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const resetStartForm = () => {
    setPreWeightKg(''); setPreBpSystolic(''); setPreBpDiastolic('');
    setBloodFlowMlMin(''); setDialysateFlowMlMin('');
  };

  const resetCompleteForm = () => {
    setPostWeightKg(''); setKtV(''); setPostBpSystolic(''); setPostBpDiastolic(''); setComplications('');
  };

  async function startSession() {
    if (!preWeightKg || isNaN(parseFloat(preWeightKg))) {
      Alert.alert('Pre-Weight Required', 'Please enter a valid pre-dialysis weight in kg.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/dialysis/hd-sessions', {
        patientId,
        preWeightKg: parseFloat(preWeightKg),
        preBpSystolic: preBpSystolic ? parseInt(preBpSystolic, 10) : undefined,
        preBpDiastolic: preBpDiastolic ? parseInt(preBpDiastolic, 10) : undefined,
        bloodFlowMlMin: bloodFlowMlMin ? parseInt(bloodFlowMlMin, 10) : undefined,
        dialysateFlowMlMin: dialysateFlowMlMin ? parseInt(dialysateFlowMlMin, 10) : undefined,
      });
      resetStartForm();
      setMode('list');
      await loadSessions();
      Alert.alert('Session Started', 'HD session has been started.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e.message ?? 'Could not start session.');
    } finally {
      setSaving(false);
    }
  }

  function openComplete(session: any) {
    setActiveSession(session);
    setCdssAlert(null);
    resetCompleteForm();
    setMode('complete');
  }

  async function completeSession() {
    if (!activeSession) return;
    if (!postWeightKg || isNaN(parseFloat(postWeightKg))) {
      Alert.alert('Post-Weight Required', 'Please enter a valid post-dialysis weight in kg.');
      return;
    }
    setSaving(true);
    try {
      const r: any = await api.patch(`/dialysis/hd-sessions/${activeSession.id}/complete`, {
        postWeightKg: parseFloat(postWeightKg),
        ktV: ktV ? parseFloat(ktV) : undefined,
        endTime: new Date().toTimeString().slice(0, 5),
        postBpSystolic: postBpSystolic ? parseInt(postBpSystolic, 10) : undefined,
        postBpDiastolic: postBpDiastolic ? parseInt(postBpDiastolic, 10) : undefined,
        complications: complications.trim() ? complications.split(',').map(c => c.trim()) : [],
      });
      const result = r.data ?? r;
      await loadSessions();
      if (result.cdss_alert) {
        setCdssAlert(result.cdss_alert);
      } else {
        setActiveSession(null);
        resetCompleteForm();
        setMode('list');
        Alert.alert('Session Completed', 'HD session has been completed.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e.message ?? 'Could not complete session.');
    } finally {
      setSaving(false);
    }
  }

  function dismissAlertAndClose() {
    setCdssAlert(null);
    setActiveSession(null);
    resetCompleteForm();
    setMode('list');
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  if (mode === 'start') {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.formHeader}>
          <Text style={s.heading}>Start HD Session</Text>
          <TouchableOpacity onPress={() => { resetStartForm(); setMode('list'); }}>
            <Icon name="close" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={s.sub}>{patientName}</Text>

        <Text style={s.label}>Pre-Dialysis Weight (kg) *</Text>
        <TextInput style={s.input} placeholder="e.g. 68.5" placeholderTextColor={C.textMuted} keyboardType="decimal-pad" value={preWeightKg} onChangeText={setPreWeightKg} />

        <View style={s.formRow}>
          <View style={s.formCol}>
            <Text style={s.label}>Pre-BP Systolic</Text>
            <TextInput style={s.input} placeholder="e.g. 140" placeholderTextColor={C.textMuted} keyboardType="number-pad" value={preBpSystolic} onChangeText={setPreBpSystolic} />
          </View>
          <View style={s.formCol}>
            <Text style={s.label}>Pre-BP Diastolic</Text>
            <TextInput style={s.input} placeholder="e.g. 90" placeholderTextColor={C.textMuted} keyboardType="number-pad" value={preBpDiastolic} onChangeText={setPreBpDiastolic} />
          </View>
        </View>

        <View style={s.formRow}>
          <View style={s.formCol}>
            <Text style={s.label}>Blood Flow (ml/min)</Text>
            <TextInput style={s.input} placeholder="e.g. 300" placeholderTextColor={C.textMuted} keyboardType="number-pad" value={bloodFlowMlMin} onChangeText={setBloodFlowMlMin} />
          </View>
          <View style={s.formCol}>
            <Text style={s.label}>Dialysate Flow (ml/min)</Text>
            <TextInput style={s.input} placeholder="e.g. 500" placeholderTextColor={C.textMuted} keyboardType="number-pad" value={dialysateFlowMlMin} onChangeText={setDialysateFlowMlMin} />
          </View>
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={startSession} disabled={saving}>
          {saving ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={s.primaryBtnText}>Start Session</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === 'complete') {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.formHeader}>
          <Text style={s.heading}>Complete HD Session</Text>
          <TouchableOpacity onPress={() => { resetCompleteForm(); setCdssAlert(null); setActiveSession(null); setMode('list'); }}>
            <Icon name="close" size={22} color={C.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={s.sub}>{patientName} · Started {activeSession?.start_time ?? ''}</Text>

        {cdssAlert && (
          <View style={s.alertBanner}>
            <AlertTriangle size={20} color={C.coral} />
            <Text style={s.alertBannerText}>{cdssAlert}</Text>
          </View>
        )}

        <Text style={s.label}>Post-Dialysis Weight (kg) *</Text>
        <TextInput style={s.input} placeholder="e.g. 66.2" placeholderTextColor={C.textMuted} keyboardType="decimal-pad" value={postWeightKg} onChangeText={setPostWeightKg} />

        <Text style={s.label}>Kt/V</Text>
        <TextInput style={s.input} placeholder="e.g. 1.3" placeholderTextColor={C.textMuted} keyboardType="decimal-pad" value={ktV} onChangeText={setKtV} />

        <View style={s.formRow}>
          <View style={s.formCol}>
            <Text style={s.label}>Post-BP Systolic</Text>
            <TextInput style={s.input} placeholder="e.g. 110" placeholderTextColor={C.textMuted} keyboardType="number-pad" value={postBpSystolic} onChangeText={setPostBpSystolic} />
          </View>
          <View style={s.formCol}>
            <Text style={s.label}>Post-BP Diastolic</Text>
            <TextInput style={s.input} placeholder="e.g. 70" placeholderTextColor={C.textMuted} keyboardType="number-pad" value={postBpDiastolic} onChangeText={setPostBpDiastolic} />
          </View>
        </View>

        <Text style={s.label}>Complications</Text>
        <TextInput
          style={[s.input, s.textArea]}
          placeholder="Comma-separated, e.g. cramping, hypotension"
          placeholderTextColor={C.textMuted}
          multiline
          numberOfLines={3}
          value={complications}
          onChangeText={setComplications}
        />

        {cdssAlert ? (
          <TouchableOpacity style={s.ackBtn} onPress={dismissAlertAndClose}>
            <Text style={s.ackBtnText}>Acknowledge &amp; Close</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.primaryBtn} onPress={completeSession} disabled={saving}>
            {saving ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={s.primaryBtnText}>Complete Session</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  const active = sessions.find(sess => !sess.session_completed);

  return (
    <View style={s.container}>
      <View style={s.formHeader}>
        <View>
          <Text style={s.heading}>HD Session History</Text>
          <Text style={s.sub}>{patientName}</Text>
        </View>
        {!active && (
          <TouchableOpacity style={s.newBtn} onPress={() => setMode('start')}>
            <Icon name="plus" size={16} color={C.bg} />
            <Text style={s.newBtnText}> Start Session</Text>
          </TouchableOpacity>
        )}
      </View>

      {active && (
        <TouchableOpacity style={s.activeCard} onPress={() => openComplete(active)}>
          <Activity size={16} color={C.amber} />
          <View style={{ flex: 1 }}>
            <Text style={s.activeTitle}>Session in progress — started {active.start_time}</Text>
            <Text style={s.activeSub}>Tap to record vitals and complete</Text>
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={sessions}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Activity size={14} color={C.teal} />
              <Text style={s.date}> {item.session_date}</Text>
              {item.kt_v_adequate === true && <CheckCircle size={14} color={C.green} style={s.ml} />}
              {item.kt_v_adequate === false && <AlertTriangle size={14} color={C.coral} style={s.ml} />}
            </View>
            <View style={s.metrics}>
              <Text style={s.metric}>Kt/V: <Text style={[s.val, { color: item.kt_v_adequate ? C.green : C.coral }]}>{item.kt_v_measured ?? '—'}</Text></Text>
              <Text style={s.metric}>UF: <Text style={s.val}>{item.uf_volume_ml ? `${item.uf_volume_ml} ml` : '—'}</Text></Text>
              <Text style={s.metric}>Duration: <Text style={s.val}>{item.duration_hours ? `${parseFloat(item.duration_hours).toFixed(1)}h` : '—'}</Text></Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  formHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  label:       { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 6, marginTop: 4 },
  input:       { backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: FONT.ui, marginBottom: 14, fontSize: 16 },
  textArea:    { minHeight: 72, textAlignVertical: 'top' },
  formRow:     { flexDirection: 'row', gap: 12 },
  formCol:     { flex: 1 },
  newBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  newBtnText:  { fontFamily: FONT.uiSb, fontSize: 13, color: C.bg },
  primaryBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 14, marginTop: 10 },
  primaryBtnText: { fontFamily: FONT.uiSb, fontSize: 15, color: C.bg },
  ackBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.coral, borderRadius: RADIUS.pill, paddingVertical: 14, marginTop: 10 },
  ackBtnText:  { fontFamily: FONT.uiSb, fontSize: 15, color: '#fff' },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.coral + '22', borderWidth: 1.5, borderColor: C.coral, borderRadius: RADIUS.md, padding: 14, marginBottom: 16 },
  alertBannerText: { flex: 1, fontFamily: FONT.uiSb, fontSize: 13, color: C.coral, lineHeight: 18 },
  activeCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.amber + '18', borderWidth: 1.5, borderColor: C.amber, borderRadius: RADIUS.card, padding: 14, marginBottom: 16 },
  activeTitle: { fontFamily: FONT.uiSb, fontSize: 13, color: C.text },
  activeSub:   { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  date:        { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, flex: 1 },
  ml:          { marginLeft: 4 },
  metrics:     { flexDirection: 'row', gap: 20 },
  metric:      { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  val:         { fontFamily: FONT.uiSb, color: C.text },
});
