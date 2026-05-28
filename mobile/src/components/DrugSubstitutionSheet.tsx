import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { AiStatusChip } from './AiStatusChip';
import api from '../services/api';

interface Suggestion {
  drug: string;
  confidence: number;
  rationale: string;
  caveat: string;
  sourceType: string;
}

interface Props {
  patientId: number;
  diagnoses: string[];
  allergies: string[];
  onClose: () => void;
  onSelected: (drug: string) => void;
}

export default function DrugSubstitutionSheet({
  patientId, diagnoses, allergies, onClose, onSelected,
}: Props) {
  const [drug, setDrug] = useState('');
  const [dose, setDose] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: number;
    suggestions: Suggestion[];
    cdssAvailable: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function search() {
    if (!drug.trim()) return;
    setLoading(true);
    try {
      const data = await api.post('/drug-substitution/suggest', {
        originalDrug: drug.trim(),
        originalDose: dose.trim() || undefined,
        patientId,
        diagnoses,
        allergies,
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!result || !selected) return;
    await api.patch(`/drug-substitution/${result.id}/select`, { selectedDrug: selected });
    setConfirmed(true);
    onSelected(selected);
  }

  function confColor(c: number) {
    if (c >= 0.8) return C.green;
    if (c >= 0.6) return C.amber;
    return C.red;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Drug Substitution</Text>
          <AiStatusChip
            status={loading ? 'loading' : result?.cdssAvailable === false ? 'unavailable' : 'active'}
          />
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Drug name"
            placeholderTextColor={C.textMuted}
            value={drug}
            onChangeText={setDrug}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Dose"
            placeholderTextColor={C.textMuted}
            value={dose}
            onChangeText={setDose}
          />
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, (!drug.trim() || loading) && styles.btnDisabled]}
          onPress={search}
          disabled={!drug.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Find Substitutes</Text>
          )}
        </TouchableOpacity>

        {result && (
          <ScrollView style={{ maxHeight: 280, marginTop: 12 }}>
            {result.suggestions.length === 0 ? (
              <Text style={styles.empty}>No substitutes found. Consult pharmacist.</Text>
            ) : (
              result.suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelected(s.drug)}
                  style={[styles.card, selected === s.drug && styles.cardSelected]}
                >
                  <View style={styles.cardRow}>
                    <Text style={styles.drugName}>{s.drug}</Text>
                    <Text style={[styles.conf, { color: confColor(s.confidence) }]}>
                      {Math.round(s.confidence * 100)}%
                    </Text>
                  </View>
                  <Text style={styles.rationale}>{s.rationale}</Text>
                  {s.caveat ? <Text style={styles.caveat}>⚠ {s.caveat}</Text> : null}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {confirmed && (
          <View style={styles.confirmedBanner}>
            <Text style={{ color: C.green, fontFamily: FONT.uiBd }}>✓ Substitution recorded: {selected}</Text>
          </View>
        )}

        {result && result.suggestions.length > 0 && !confirmed && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.confirmBtn, !selected && styles.btnDisabled]}
              onPress={confirm}
              disabled={!selected}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {!result && !loading && (
          <TouchableOpacity style={[styles.cancelBtn, { marginTop: 12 }]} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: 20,
    ...SHADOW.lg,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  title: { fontFamily: FONT.uiBd, fontSize: 17, color: C.text },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm,
    padding: 9, fontSize: 14, color: C.text, backgroundColor: C.card,
  },
  searchBtn: {
    backgroundColor: C.blue, borderRadius: RADIUS.sm,
    padding: 10, alignItems: 'center',
  },
  searchBtnText: { fontFamily: FONT.uiBd, color: '#fff', fontSize: 15 },
  btnDisabled: { opacity: 0.45 },
  card: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: RADIUS.sm,
    padding: 10, marginBottom: 8, backgroundColor: C.card,
  },
  cardSelected: { borderColor: C.blue, backgroundColor: C.surface2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drugName: { fontFamily: FONT.uiBd, fontSize: 14, color: C.text, flex: 1 },
  conf: { fontFamily: FONT.uiBd, fontSize: 13 },
  rationale: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  caveat: { fontSize: 11, color: C.amber, marginTop: 2 },
  empty: { fontStyle: 'italic', color: C.textMuted, textAlign: 'center', marginTop: 8 },
  confirmedBanner: {
    marginTop: 10, padding: 10, backgroundColor: C.surface2,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: C.green + '44',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  confirmBtn: {
    flex: 1, backgroundColor: C.green, borderRadius: RADIUS.sm,
    padding: 10, alignItems: 'center',
  },
  confirmText: { fontFamily: FONT.uiBd, color: '#fff' },
  cancelBtn: {
    flex: 1, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    borderRadius: RADIUS.sm, padding: 10, alignItems: 'center',
  },
  cancelText: { color: C.text, fontFamily: FONT.uiMd },
});
