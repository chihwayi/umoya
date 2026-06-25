import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Icon } from '../components/ui/Icon';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const weightColor = (adm: any) =>
  adm.is_elbw ? C.red : adm.is_vlbw ? C.coral : adm.is_premature ? C.amber : C.green;

export default function NicuAdmissionScreen() {
  const [census, setCensus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/nicu/census')
      .then((r: any) => setCensus(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Icon name="baby" size={22} color={C.teal} />
        <Text style={s.heading}>NICU Census</Text>
      </View>

      <FlatList
        data={census}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card}>
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: `${weightColor(item)}22` }]}>
                <Text style={[s.badgeText, { color: weightColor(item) }]}>
                  {item.is_elbw ? 'ELBW' : item.is_vlbw ? 'VLBW' : item.is_premature ? 'Prem' : 'Term'}
                </Text>
              </View>
              <Text style={s.bed}>{item.incubator_code ?? 'Open Cot'}</Text>
              {item.above_phototherapy_threshold && (
                <Icon name="alert-triangle" size={14} color={C.amber} />
              )}
            </View>

            <Text style={s.name}>{item.first_name} {item.last_name}</Text>

            <View style={s.row}>
              <Text style={s.sub}>GA: {item.gestational_age_weeks}w</Text>
              <Text style={s.sub}>BW: {item.birth_weight_grams}g</Text>
              {item.current_weight && <Text style={s.sub}>CW: {item.current_weight}g</Text>}
            </View>

            <View style={s.row}>
              <Text style={s.sub}>Day {Math.floor(item.los_days ?? 0)}</Text>
              {item.kmc_hours_today != null && (
                <Text style={[s.sub, { color: C.teal }]}>KMC: {item.kmc_hours_today}h today</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>No active NICU admissions.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge:     { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: FONT.uiSb, fontSize: 11, letterSpacing: 0.4 },
  bed:       { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary },
  name:      { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, marginBottom: 4 },
  sub:       { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
