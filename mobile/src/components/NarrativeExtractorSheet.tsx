import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { AiStatusChip } from './AiStatusChip';
import { AiSourcePill } from './AiSourcePill';
import { api } from '../services/api';

interface ClinicalEntities {
  diagnoses: Array<{ text: string; icd10Hint?: string }>;
  medications: Array<{ name: string; dose?: string }>;
  allergies: Array<{ substance: string; reaction?: string }>;
  symptoms: Array<{ text: string }>;
  procedures: Array<{ text: string }>;
  aiSource: string;
}

interface Props {
  patientId: number;
  encounterId?: number;
  initialText?: string;
  onExtracted?: (entities: ClinicalEntities) => void;
}

export default function NarrativeExtractorSheet({
  patientId, encounterId, initialText = '', onExtracted,
}: Props) {
  const [text, setText] = useState(initialText);
  const [entities, setEntities] = useState<ClinicalEntities | null>(null);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(val: string) {
    setText(val);
    clearTimeout(debounce.current);
    if (val.trim().length < 20) { setEntities(null); return; }
    debounce.current = setTimeout(() => extractEntities(val), 900);
  }

  async function extractEntities(noteText: string) {
    setLoading(true);
    try {
      const result = await api.post<ClinicalEntities>('/cdss/nlp/extract', {
        text: noteText, patientId, encounterId, context: 'mobile_note',
      });
      setEntities(result.data);
      onExtracted?.(result.data);
    } catch { /* fail silently */ } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Clinical Note</Text>
        {entities && <AiSourcePill aiSource={entities.aiSource} />}
      </View>

      <TextInput
        value={text}
        onChangeText={handleChange}
        multiline
        numberOfLines={6}
        placeholder="Type or dictate clinical note…"
        style={styles.input}
        placeholderTextColor={C.textMuted}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={C.blue} />
          <AiStatusChip status="loading" />
          <Text style={styles.loadingText}>Extracting entities…</Text>
        </View>
      )}

      {entities && !loading && (
        <ScrollView style={styles.entitiesBox}>
          <EntityRow label="Diagnoses" items={entities.diagnoses.map(d => d.text)} color={C.blue} />
          <EntityRow label="Medications" items={entities.medications.map(m => m.name)} color={C.teal} />
          <EntityRow label="Allergies" items={entities.allergies.map(a => a.substance)} color={C.red} />
          <EntityRow label="Symptoms" items={entities.symptoms.map(s => s.text)} color={C.amber} />
          <EntityRow label="Procedures" items={entities.procedures.map(p => p.text)} color={C.green} />
        </ScrollView>
      )}
    </View>
  );
}

function EntityRow({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontFamily: FONT.uiBd, fontSize: 11, color, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontFamily: FONT.ui, fontSize: 13, color: C.text }}>{items.join(' · ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.card,
    padding: 16,
    ...SHADOW.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heading: {
    fontFamily: FONT.uiBd,
    fontSize: 15,
    color: C.text,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.sm,
    padding: 10,
    fontFamily: FONT.mono,
    fontSize: 13,
    color: C.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  loadingText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: C.textSecondary,
  },
  entitiesBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: C.surface2,
    borderRadius: RADIUS.sm,
    maxHeight: 200,
  },
});
