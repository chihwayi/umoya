import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';
import { Icon } from '../components/ui/Icon';

const ICU_TYPE_LABEL: Record<string, string> = {
  general:  'Gen ICU',
  surgical: 'SICU',
  medical:  'MICU',
  neonatal: 'NICU',
  hdu:      'HDU',
};

const sofaColor = (score: number): string =>
  score <= 4 ? C.green : score <= 8 ? C.amber : score <= 11 ? C.coral : C.red;

export default function IcuBedScreen() {
  const [census, setCensus]   = useState<any[]>([]);
  const [alarms, setAlarms]   = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/icu/census'),
      api.get('/icu/dashboard'),
    ]).then(([c, d]: any[]) => {
      setCensus(c.data ?? c ?? []);
      setAlarms(Number((d.data ?? d)?.recentVentAlarms ?? 0));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.heading}>ICU Census</Text>

      {alarms > 0 && (
        <View style={s.alarmBanner}>
          <Icon name="wind" size={14} color={C.coral} />
          <Text style={s.alarmText}>
            {alarms} ventilator alarm{alarms > 1 ? 's' : ''} in the last hour
          </Text>
        </View>
      )}

      <FlatList
        data={census}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => <BedCard pt={item} />}
        ListEmptyComponent={
          <Text style={s.empty}>No active ICU admissions.</Text>
        }
      />
    </View>
  );
}

function BedCard({ pt }: { pt: any }) {
  const sofa     = Number(pt.latest_sofa ?? 0);
  const color    = sofaColor(sofa);
  const hasAlarm = pt.is_alarm_driving_pressure || pt.is_alarm_plateau;
  const losDays  = Math.floor(Number(pt.los_days ?? 0));

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.85}>
      <View style={s.row}>
        <View style={[s.bedBadge, { backgroundColor: `${color}22` }]}>
          <Text style={[s.bedText, { color }]}>{pt.bed_code}</Text>
        </View>
        <Text style={s.icuType}>
          {ICU_TYPE_LABEL[pt.icu_type] ?? (pt.icu_type ?? '').toUpperCase()}
        </Text>
        {hasAlarm && (
          <Icon name="wind" size={13} color={C.coral} />
        )}
        {pt.isolation_required && (
          <Icon name="alert-triangle" size={13} color={C.amber} />
        )}
      </View>

      <Text style={s.name}>{pt.first_name} {pt.last_name}</Text>

      <View style={s.row}>
        <Text style={s.sub}>
          SOFA: <Text style={{ color }}>{sofa}</Text>
        </Text>
        <Text style={s.sub}>Day {losDays}</Text>
        {pt.ventilator_required && (
          <Text style={[s.sub, { color: C.blue }]}>• Vent</Text>
        )}
      </View>

      {hasAlarm && (
        <View style={s.alarmRow}>
          <Text style={s.alarmRowText}>
            {pt.is_alarm_driving_pressure && pt.is_alarm_plateau
              ? 'Driving pressure & plateau alarm'
              : pt.is_alarm_driving_pressure
              ? 'Driving pressure >15 cmH₂O'
              : 'Plateau pressure >30 cmH₂O'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:      { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 12 },
  alarmBanner:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${C.coral}18`, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
    borderWidth: 1, borderColor: `${C.coral}44`,
  },
  alarmText:    { fontFamily: FONT.uiMd, fontSize: 12, color: C.coral, flex: 1 },
  card:         { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 14, marginBottom: 10, ...SHADOW.sm },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bedBadge:     { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  bedText:      { fontFamily: FONT.mono, fontSize: 12, fontWeight: '700' },
  icuType:      { fontFamily: FONT.uiMd, fontSize: 10, color: C.textMuted, letterSpacing: 0.5 },
  name:         { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, marginBottom: 4 },
  sub:          { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  empty:        { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
  alarmRow:     { marginTop: 6, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${C.coral}12` },
  alarmRowText: { fontFamily: FONT.ui, fontSize: 11, color: C.coral },
});
