import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface ScheduleRow {
  antigen_code: string;
  antigen_name: string;
  doses_required: number;
  doses_given: number;
  doses_remaining: number;
  min_age_weeks: number;
}

export default function VaccinationCardScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params ?? {};
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    (async () => {
      try {
        const patient: any = await api.get(`/patients/${patientId}`).then((r: any) => r.data ?? r);
        const dateOfBirth = patient?.dateOfBirth ?? patient?.date_of_birth;
        const [history, forecast]: [any, any] = await Promise.all([
          api.get(`/immunizations/patient/${patientId}`).then((r: any) => r.data ?? r),
          dateOfBirth
            ? api.get(`/immunizations/patient/${patientId}/forecast?dateOfBirth=${encodeURIComponent(dateOfBirth)}`).then((r: any) => r.data ?? r)
            : Promise.resolve([]),
        ]);

        const byAntigen = new Map<string, ScheduleRow>();
        for (const dose of history ?? []) {
          const code = dose.vaccineCode ?? dose.vaccine_code;
          const row = byAntigen.get(code) ?? {
            antigen_code: code,
            antigen_name: dose.vaccineName ?? dose.vaccine_name ?? code,
            doses_required: 0,
            doses_given: 0,
            doses_remaining: 0,
            min_age_weeks: 0,
          };
          row.doses_given += 1;
          byAntigen.set(code, row);
        }
        for (const due of forecast ?? []) {
          const code = due.vaccineCode ?? due.vaccine_code;
          const row = byAntigen.get(code) ?? {
            antigen_code: code,
            antigen_name: due.vaccineName ?? due.vaccine_name ?? code,
            doses_required: 0,
            doses_given: 0,
            doses_remaining: 0,
            min_age_weeks: 0,
          };
          row.doses_remaining += 1;
          byAntigen.set(code, row);
        }
        for (const row of byAntigen.values()) {
          row.doses_required = row.doses_given + row.doses_remaining;
        }
        setSchedule(Array.from(byAntigen.values()));
      } catch {
        Alert.alert('Error', 'Could not load vaccination schedule.');
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const complete = schedule.filter(r => Number(r.doses_remaining) === 0).length;
  const total    = schedule.length;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Vaccination Card</Text>
      {patientName && <Text style={s.sub}>{patientName}</Text>}

      <View style={s.summaryBar}>
        <Text style={s.summaryText}>{complete}/{total} antigens complete</Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${total > 0 ? (complete / total) * 100 : 0}%` as any }]} />
        </View>
      </View>

      <FlatList
        data={schedule}
        keyExtractor={i => i.antigen_code}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={s.empty}>No EPI schedule found.</Text>}
        renderItem={({ item }) => {
          const done    = Number(item.doses_remaining) === 0;
          const partial = Number(item.doses_given) > 0 && !done;
          return (
            <View style={s.row}>
              {done
                ? <CheckCircle size={18} color={C.green} />
                : partial
                  ? <Clock size={18} color={C.amber} />
                  : <AlertTriangle size={18} color={C.textMuted} />}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.antigen}>{item.antigen_name}</Text>
                <Text style={s.doses}>
                  {item.doses_given}/{item.doses_required} dose{item.doses_required > 1 ? 's' : ''} · from week {item.min_age_weeks ?? 0}
                </Text>
              </View>
              {done && <Text style={s.doneLabel}>Done</Text>}
              {!done && Number(item.doses_remaining) > 0 && (
                <Text style={s.remainingLabel}>{item.doses_remaining} due</Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:       { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:           { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 12 },
  summaryBar:    { marginBottom: 16 },
  summaryText:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: `${C.teal}22`, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: C.teal, borderRadius: 3 },
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 8, ...SHADOW.sm },
  antigen:       { fontFamily: FONT.uiSb, fontSize: 14, color: C.text },
  doses:         { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  doneLabel:     { fontFamily: FONT.uiSb, fontSize: 12, color: C.green },
  remainingLabel: { fontFamily: FONT.uiSb, fontSize: 12, color: C.coral },
  empty:         { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
