import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';

const PRIORITY_COLOR: Record<string, string> = {
  elective:          C.blue,
  urgent:            C.amber,
  stemi_primary_pci: C.coral,
  emergency:         C.red,
};

const STATUS_COLOR: Record<string, string> = {
  scheduled:   C.blue,
  in_progress: C.amber,
  completed:   C.green,
  cancelled:   C.textMuted,
};

export default function CathLabScreen() {
  const [cases, setCases]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cathlab/cases')
      .then((r: any) => setCases(r.data ?? r))
      .catch(() => Alert.alert('Error', 'Could not load cath lab cases.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.coral} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="heart" size={22} color={C.coral} />
        <Text style={styles.heading}>Cath Lab</Text>
      </View>

      <FlatList
        data={cases}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.8}>
            <View style={styles.row}>
              <Text style={[styles.priority, { color: PRIORITY_COLOR[item.priority] ?? C.blue }]}>
                {(item.priority ?? '').replace(/_/g, ' ').toUpperCase()}
              </Text>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_COLOR[item.status] ?? C.blue },
                ]}
              />
            </View>
            <Text style={styles.patientName}>
              {item.first_name} {item.last_name}
            </Text>
            <Text style={styles.procType}>
              {(item.procedure_type ?? '').replace(/_/g, ' ')}
            </Text>
            {item.scheduled_at && (
              <View style={styles.timeRow}>
                <Icon name="calendar" size={12} color={C.textSecondary} />
                <Text style={styles.timeText}>
                  {new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No cases today.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.sm },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  priority:    { fontFamily: FONT.uiSb, fontSize: 11, letterSpacing: 0.5 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },
  patientName: { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, marginBottom: 2 },
  procType:    { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText:    { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary },
  empty:       { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
