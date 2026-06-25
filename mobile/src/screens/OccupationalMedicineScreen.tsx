import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Icon } from '../components/ui/Icon';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface Employer {
  id: string;
  name: string;
  industry_sector: string;
  is_active: boolean;
}

export default function OccupationalMedicineScreen() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/oem/employers')
      .then((r: any) => setEmployers(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={C.teal} />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.heading}>Occupational Medicine</Text>
      <Text style={styles.sub}>Workplace health & fitness-for-duty</Text>

      <FlatList
        data={employers}
        keyExtractor={e => e.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.cardRow}>
              <Icon name="briefcase" size={18} color={C.teal} />
              <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <Text style={styles.cardSub}>{item.industry_sector ?? 'General industry'}</Text>
            <View style={[styles.badge, { backgroundColor: item.is_active ? '#1B6B3A33' : '#3D607F33' }]}>
              <Text style={[styles.badgeText, { color: item.is_active ? C.green : C.textMuted }]}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No employers registered yet.</Text>
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 4 },
  sub:        { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.sm },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle:  { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  cardSub:    { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  badge:      { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText:  { fontFamily: FONT.uiMd, fontSize: 11, letterSpacing: 0.5 },
  empty:      { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
