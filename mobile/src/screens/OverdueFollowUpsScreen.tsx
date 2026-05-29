import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { AiStatusChip } from '../components/AiStatusChip';
import { api } from '../services/api';

interface OverdueItem {
  id: number;
  patientId: number;
  fullName: string;
  mrn: string;
  urgency: string;
  recommendedDays: number;
  recommendedModality: string;
  appointmentDueBy: string;
  reasoning: string;
}

function urgencyColor(u: string) {
  if (u === 'urgent') return C.red;
  if (u === 'soon') return C.amber;
  return C.blue;
}

export default function OverdueFollowUpsScreen() {
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/followup/overdue')
      .then(res => setItems((res.data as any[]).map(d => ({
        id: d.id,
        patientId: d.patient_id,
        fullName: d.full_name,
        mrn: d.mrn,
        urgency: d.urgency,
        recommendedDays: d.recommended_days,
        recommendedModality: d.recommended_modality,
        appointmentDueBy: d.appointment_due_by,
        reasoning: d.reasoning,
      }))))
      .finally(() => setLoading(false));
  }, []);

  function renderItem({ item }: { item: OverdueItem }) {
    const color = urgencyColor(item.urgency);
    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardRow}>
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={[styles.urgencyBadge, { backgroundColor: color }]}>
            {item.urgency.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.mrn}>MRN {item.mrn}</Text>
        <Text style={styles.meta}>
          Due {new Date(item.appointmentDueBy).toLocaleDateString()} ·{' '}
          {item.recommendedModality.replace('_', '-')}
        </Text>
        <Text style={styles.reason} numberOfLines={2}>{item.reasoning}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.blue} />
        <AiStatusChip status="loading" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Overdue Follow-Ups</Text>
        <AiStatusChip status="active" />
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>No overdue follow-ups today.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontFamily: FONT.uiBd, fontSize: 18, color: C.text },
  card: {
    backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14,
    marginBottom: 10, borderLeftWidth: 4, ...SHADOW.sm,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, flex: 1 },
  urgencyBadge: {
    fontSize: 10, fontFamily: FONT.uiBd, color: '#fff',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm,
  },
  mrn: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  meta: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  reason: { fontSize: 12, color: C.text, marginTop: 4, lineHeight: 17 },
  empty: { textAlign: 'center', color: C.textMuted, marginTop: 40, fontStyle: 'italic' },
});
