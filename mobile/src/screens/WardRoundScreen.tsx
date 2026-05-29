import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface Admission {
  admission_id: string;
  bed_code: string;
  ward_name: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  latest_risk_level: string;
  last_plan?: string;
}

interface NoteForm {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const RISK_COLOR: Record<string, string> = {
  low: C.green, medium: '#E65100', high: '#C62828', critical: '#4A148C',
};

export default function WardRoundScreen() {
  const [census, setCensus] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Admission | null>(null);
  const [note, setNote] = useState<NoteForm>({ subjective: '', objective: '', assessment: '', plan: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/ward/census')
      .then((r: any) => setCensus(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(`/ward/admissions/${selected.admission_id}/notes`, {
        encounterId: selected.admission_id,
        ...note,
      });
      Alert.alert('Saved', 'Ward round note saved.');
      setSelected(null);
    } catch {
      Alert.alert('Error', 'Could not save note. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.blue} />;

  if (selected) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.heading}>
          {selected.first_name} {selected.last_name} — {selected.bed_code}
        </Text>
        {(['subjective', 'objective', 'assessment', 'plan'] as (keyof NoteForm)[]).map((field) => (
          <View key={field}>
            <Text style={styles.fieldLabel}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder={`Enter ${field}…`}
              placeholderTextColor={C.textMuted}
              value={note[field]}
              onChangeText={(v) => setNote((prev) => ({ ...prev, [field]: v }))}
            />
          </View>
        ))}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={saveNote} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Note</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={census}
      keyExtractor={(a) => a.admission_id}
      ListHeaderComponent={<Text style={styles.heading}>Ward Census ({census.length})</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No inpatients.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => {
          setSelected(item);
          setNote({ subjective: '', objective: '', assessment: '', plan: item.last_plan ?? '' });
        }}>
          <View style={styles.cardRow}>
            <View style={styles.bedBadge}>
              <Text style={styles.bedCode}>{item.bed_code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.wardName}>{item.ward_name}</Text>
              {item.last_plan && <Text style={styles.lastPlan} numberOfLines={1}>Plan: {item.last_plan}</Text>}
            </View>
            {item.latest_risk_level && (
              <View style={[styles.riskBadge, { backgroundColor: (RISK_COLOR[item.latest_risk_level] ?? '#999') + '22' }]}>
                <Text style={[styles.riskText, { color: RISK_COLOR[item.latest_risk_level] ?? '#999' }]}>
                  {item.latest_risk_level}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  heading:      { fontFamily: FONT.uiBd, fontSize: 18, color: C.text, marginBottom: 12 },
  card:         { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, marginBottom: 8, ...SHADOW.sm },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bedBadge:     { backgroundColor: C.blue + '22', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
  bedCode:      { fontFamily: FONT.uiBd, fontSize: 13, color: C.blue },
  patientName:  { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  wardName:     { fontSize: 12, color: C.textSecondary },
  lastPlan:     { fontSize: 11, color: C.textMuted, marginTop: 2 },
  riskBadge:    { borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  riskText:     { fontSize: 11, fontFamily: FONT.uiBd, textTransform: 'capitalize' },
  fieldLabel:   { fontFamily: FONT.uiBd, fontSize: 13, color: C.text, marginTop: 14, marginBottom: 4 },
  textArea:     { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, padding: 10, color: C.text, fontSize: 13, textAlignVertical: 'top', backgroundColor: C.card, minHeight: 72 },
  btnRow:       { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 40 },
  cancelBtn:    { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: C.text },
  saveBtn:      { flex: 2, backgroundColor: C.blue, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  saveBtnText:  { fontFamily: FONT.uiBd, color: '#fff', fontSize: 14 },
  empty:        { textAlign: 'center', color: C.textMuted, marginTop: 40, fontStyle: 'italic' },
});
