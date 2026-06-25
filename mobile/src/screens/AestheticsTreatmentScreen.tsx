import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Sparkles, Calendar } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const PROC_ICON_COLOR: Record<string, string> = {
  botulinum_toxin:    C.blue,
  dermal_filler:      C.teal,
  prp:                C.amber,
  laser_rejuvenation: C.coral,
  chemical_peel:      C.amber,
  hbot_wellness:      C.teal,
};

export default function AestheticsTreatmentScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api.get(`/aesthetics/procedures/${patientId}`)
      .then((r: any) => setProcedures(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Treatment History</Text>
      <Text style={s.sub}>{patientName}</Text>
      {procedures.length === 0 && <Text style={s.empty}>No procedures on file.</Text>}
      <FlatList
        data={procedures}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Sparkles size={14} color={PROC_ICON_COLOR[item.procedure_type] ?? C.teal} />
              <Text style={s.type}> {item.procedure_type?.replace(/_/g, ' ')}</Text>
            </View>
            <Text style={s.date}>{item.procedure_date}</Text>
            {item.product_used && (
              <Text style={s.product}>
                {item.product_used}{item.units_or_ml ? ` — ${item.units_or_ml} units/ml` : ''}
              </Text>
            )}
            {item.next_session_due && (
              <View style={s.nextRow}>
                <Calendar size={12} color={C.textMuted} />
                <Text style={s.next}> Next session: {item.next_session_due}</Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:       { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  empty:     { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:       { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  type:      { fontFamily: FONT.uiSb, fontSize: 14, color: C.text, textTransform: 'capitalize' },
  date:      { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  product:   { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  nextRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  next:      { fontFamily: FONT.ui, fontSize: 12, color: C.teal },
});
