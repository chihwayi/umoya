import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../components/ui/Icon';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const weightColor = (adm: any) =>
  adm.is_elbw ? C.red : adm.is_vlbw ? C.coral : adm.is_premature ? C.amber : C.green;

export default function NicuAdmissionScreen() {
  const navigation = useNavigation<any>();
  const [census, setCensus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionsFor, setActionsFor] = useState<any | null>(null);

  useEffect(() => {
    api.get('/nicu/census')
      .then((r: any) => setCensus(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const patientName = (item: any) => `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();

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
          <TouchableOpacity style={s.card} onPress={() => setActionsFor(item)}>
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

      <Modal transparent visible={!!actionsFor} animationType="fade" onRequestClose={() => setActionsFor(null)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setActionsFor(null)}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{actionsFor ? patientName(actionsFor) : ''}</Text>
            <TouchableOpacity
              style={s.sheetBtn}
              onPress={() => {
                const item = actionsFor;
                setActionsFor(null);
                navigation.navigate('NicuKmc', { admissionId: item.id, patientName: patientName(item) });
              }}
            >
              <Icon name="heart" size={16} color={C.teal} />
              <Text style={s.sheetBtnText}>KMC Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.sheetBtn}
              onPress={() => {
                const item = actionsFor;
                setActionsFor(null);
                navigation.navigate('NicuDrugDose', { admissionId: item.id });
              }}
            >
              <Icon name="pill" size={16} color={C.teal} />
              <Text style={s.sheetBtnText}>Drug Dosing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.sheetBtn}
              onPress={() => {
                const item = actionsFor;
                setActionsFor(null);
                navigation.navigate('NicuFollowup', { patientId: item.patient_id, patientName: patientName(item) });
              }}
            >
              <Icon name="calendar" size={16} color={C.teal} />
              <Text style={s.sheetBtnText}>Follow-up</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:     { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  sheetTitle: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, marginBottom: 6 },
  sheetBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border },
  sheetBtnText: { fontFamily: FONT.uiMd, fontSize: 14, color: C.text },
});
