import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Alert } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';

const SPECIMEN_TYPES = ['blood', 'urine', 'wound', 'sputum', 'stool', 'other'];
const COMMON_PANEL = ['Ampicillin', 'Ciprofloxacin', 'Ceftriaxone', 'Gentamicin', 'Meropenem', 'Co-trimoxazole'];
const INTERPRETATIONS: Array<'S' | 'I' | 'R'> = ['S', 'I', 'R'];
const INTERP_COLOR: Record<string, string> = { S: C.green, I: C.amber, R: C.coral };
const INTERP_LABEL: Record<string, string> = { S: 'Susceptible', I: 'Intermediate', R: 'Resistant' };

interface CultureResult {
  id: string;
  specimenType: string;
  collectionDate: string;
  organismIsolated: string | null;
  noGrowth: boolean;
  diskDiffusionResults: Record<string, { interpretation: 'S' | 'I' | 'R' }>;
  esblDetected: boolean | null;
  carbapenemResistant: boolean | null;
  notes: string | null;
}

export default function CultureSensitivityScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params ?? {};
  const [results, setResults] = useState<CultureResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [specimenType, setSpecimenType] = useState('blood');
  const [noGrowth, setNoGrowth] = useState(false);
  const [organismIsolated, setOrganismIsolated] = useState('');
  const [panel, setPanel] = useState<Record<string, 'S' | 'I' | 'R' | null>>({});
  const [esblDetected, setEsblDetected] = useState(false);
  const [carbapenemResistant, setCarbapenemResistant] = useState(false);
  const [notes, setNotes] = useState('');

  const load = useCallback(() => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    return api.get(`/antibiogram/patient/${patientId}/culture`)
      .then((r: any) => setResults(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setSpecimenType('blood');
    setNoGrowth(false);
    setOrganismIsolated('');
    setPanel({});
    setEsblDetected(false);
    setCarbapenemResistant(false);
    setNotes('');
  }

  function toggleInterp(antibiotic: string, interp: 'S' | 'I' | 'R') {
    setPanel(prev => ({ ...prev, [antibiotic]: prev[antibiotic] === interp ? null : interp }));
  }

  async function submit() {
    if (!noGrowth && !organismIsolated.trim()) {
      Alert.alert('Organism Required', 'Enter the isolated organism, or mark this specimen as No Growth.');
      return;
    }
    setSaving(true);
    try {
      const diskDiffusionResults: Record<string, { interpretation: string }> = {};
      for (const [antibiotic, interp] of Object.entries(panel)) {
        if (interp) diskDiffusionResults[antibiotic] = { interpretation: interp };
      }
      await api.post(`/antibiogram/patient/${patientId}/culture`, {
        specimenType,
        collectionDate: new Date().toISOString().slice(0, 10),
        noGrowth,
        organismIsolated: noGrowth ? null : organismIsolated.trim(),
        diskDiffusionResults,
        esblDetected,
        carbapenemResistant,
        notes: notes.trim() || null,
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e.message ?? 'Could not save culture result.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.formHeader}>
        <View>
          <Text style={s.heading}>Culture & Sensitivity</Text>
          <Text style={s.sub}>{patientName}</Text>
        </View>
        {!showForm && (
          <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
            <Icon name="plus" size={16} color={C.bg} />
            <Text style={s.newBtnText}> New Culture</Text>
          </TouchableOpacity>
        )}
      </View>

      {showForm && (
        <View style={s.formCard}>
          <Text style={s.label}>Specimen Type</Text>
          <View style={s.chipRow}>
            {SPECIMEN_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.chip, specimenType === t && s.chipActive]}
                onPress={() => setSpecimenType(t)}
              >
                <Text style={[s.chipText, specimenType === t && s.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.noGrowthRow} onPress={() => setNoGrowth(v => !v)}>
            <View style={[s.checkbox, noGrowth && s.checkboxChecked]}>
              {noGrowth && <Icon name="check" size={12} color={C.bg} />}
            </View>
            <Text style={s.label}>No Growth</Text>
          </TouchableOpacity>

          {!noGrowth && (
            <>
              <Text style={s.label}>Organism Isolated *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Escherichia coli"
                placeholderTextColor={C.textMuted}
                value={organismIsolated}
                onChangeText={setOrganismIsolated}
              />

              <Text style={s.label}>Disk Diffusion Sensitivity</Text>
              {COMMON_PANEL.map(antibiotic => (
                <View key={antibiotic} style={s.panelRow}>
                  <Text style={s.panelDrug}>{antibiotic}</Text>
                  <View style={s.interpRow}>
                    {INTERPRETATIONS.map(interp => {
                      const active = panel[antibiotic] === interp;
                      return (
                        <TouchableOpacity
                          key={interp}
                          style={[s.interpChip, active && { backgroundColor: INTERP_COLOR[interp], borderColor: INTERP_COLOR[interp] }]}
                          onPress={() => toggleInterp(antibiotic, interp)}
                        >
                          <Text style={[s.interpChipText, active && { color: C.bg }]}>{interp}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.noGrowthRow} onPress={() => setEsblDetected(v => !v)}>
                <View style={[s.checkbox, esblDetected && s.checkboxChecked]}>
                  {esblDetected && <Icon name="check" size={12} color={C.bg} />}
                </View>
                <Text style={s.label}>ESBL Detected</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.noGrowthRow} onPress={() => setCarbapenemResistant(v => !v)}>
                <View style={[s.checkbox, carbapenemResistant && s.checkboxChecked]}>
                  {carbapenemResistant && <Icon name="check" size={12} color={C.bg} />}
                </View>
                <Text style={s.label}>Carbapenem-Resistant</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={s.label}>Notes</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Optional notes"
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />

          <View style={s.formActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { resetForm(); setShowForm(false); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.primaryBtn} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={s.primaryBtnText}>Save Result</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {results.length === 0 && !showForm && <Text style={s.empty}>No culture results on file.</Text>}

      {results.map(r => {
        const resistantDrugs = Object.entries(r.diskDiffusionResults || {}).filter(([, v]) => v.interpretation === 'R').map(([k]) => k);
        const flagged = r.esblDetected || r.carbapenemResistant;
        return (
          <View key={r.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.cardOrganism}>{r.noGrowth ? 'No Growth' : r.organismIsolated}</Text>
              <Text style={s.cardMeta}>{r.specimenType} · {r.collectionDate}</Text>
            </View>

            {flagged && (
              <View style={s.alertBanner}>
                <AlertTriangle size={16} color={C.coral} />
                <Text style={s.alertBannerText}>
                  {[r.esblDetected && 'ESBL-producing organism', r.carbapenemResistant && 'Carbapenem-resistant organism']
                    .filter(Boolean).join(' · ')} — contact-precaution and infection-control review indicated.
                </Text>
              </View>
            )}

            {resistantDrugs.length > 0 && (
              <Text style={s.resistantLine}>Resistant to: {resistantDrugs.join(', ')}</Text>
            )}

            {Object.keys(r.diskDiffusionResults || {}).length > 0 && (
              <View style={s.resultChipRow}>
                {Object.entries(r.diskDiffusionResults).map(([drug, v]) => (
                  <View key={drug} style={[s.resultChip, { borderColor: INTERP_COLOR[v.interpretation] }]}>
                    <Text style={[s.resultChipText, { color: INTERP_COLOR[v.interpretation] }]}>{drug} {v.interpretation}</Text>
                  </View>
                ))}
              </View>
            )}

            {r.notes && <Text style={s.notesText}>{r.notes}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  formHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
  newBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText:  { fontFamily: FONT.uiSb, fontSize: 13, color: C.bg },
  formCard:    { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 16, ...SHADOW.sm },
  label:       { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, marginBottom: 8, marginTop: 4 },
  input:       { backgroundColor: C.bg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontFamily: FONT.ui, marginBottom: 14, fontSize: 16 },
  textArea:    { minHeight: 64, textAlignVertical: 'top' },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: C.bg },
  chipActive:  { backgroundColor: C.teal },
  chipText:    { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: C.bg },
  noGrowthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: C.teal, borderColor: C.teal },
  panelRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  panelDrug:   { fontFamily: FONT.ui, fontSize: 13, color: C.text, flex: 1 },
  interpRow:   { flexDirection: 'row', gap: 6 },
  interpChip:  { width: 34, height: 34, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  interpChipText: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textSecondary },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontFamily: FONT.uiSb, fontSize: 15, color: C.textSecondary },
  primaryBtn:  { flex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 14 },
  primaryBtnText: { fontFamily: FONT.uiSb, fontSize: 15, color: C.bg },
  empty:       { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardOrganism: { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, flex: 1 },
  cardMeta:    { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, textTransform: 'capitalize' },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.coral + '22', borderWidth: 1, borderColor: C.coral, borderRadius: RADIUS.sm, padding: 10, marginBottom: 10 },
  alertBannerText: { flex: 1, fontFamily: FONT.uiSb, fontSize: 12, color: C.coral, lineHeight: 16 },
  resistantLine: { fontFamily: FONT.uiMd, fontSize: 12, color: C.coral, marginBottom: 8 },
  resultChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  resultChip:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1 },
  resultChipText: { fontFamily: FONT.uiSb, fontSize: 11 },
  notesText:   { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 4 },
});
