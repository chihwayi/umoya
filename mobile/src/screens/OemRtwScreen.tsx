import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '../components/ui/Icon';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const STATUS_COLOR: Record<string, string> = {
  pending:   C.amber,
  active:    C.teal,
  modified:  C.blue,
  completed: C.green,
  withdrawn: C.textMuted,
};

export default function OemRtwScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/oem/surveillance/rtw/${patientId}`)
      .then((r: any) => setPlans(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Return-to-Work Plans</Text>
      <Text style={s.sub}>{patientName}</Text>

      {plans.length === 0 && (
        <Text style={s.empty}>No RTW plans on file.</Text>
      )}

      <FlatList
        data={plans}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.injury}>{item.injury_illness}</Text>
              <View style={[s.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? C.textMuted) + '22' }]}>
                <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] ?? C.textMuted }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={s.employer}>{item.company_name}</Text>
            {item.target_rtw_date && (
              <Text style={s.date}>Target RTW: {item.target_rtw_date}</Text>
            )}
            <View style={s.signRow}>
              {item.employer_signed
                ? <Icon name="check-circle" size={14} color={C.green} />
                : <Icon name="clock" size={14} color={C.textMuted} />
              }
              <Text style={[s.signText, { color: item.employer_signed ? C.green : C.textMuted }]}>
                {item.employer_signed ? 'Employer signed' : 'Awaiting employer sign-off'}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:        { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  empty:      { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  injury:     { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, flex: 1 },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText:  { fontFamily: FONT.uiSb, fontSize: 11 },
  employer:   { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 4 },
  date:       { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 2 },
  signRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  signText:   { fontFamily: FONT.ui, fontSize: 12 },
});
