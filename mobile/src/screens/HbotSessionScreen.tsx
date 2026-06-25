import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Activity, CheckCircle } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function HbotSessionScreen({ route }: { route: any }) {
  const { courseId, patientName, prescribedSessions } = route.params;
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/hbot/courses/active')
      .then((r: any) => {
        const course = (r.data ?? r).find((c: any) => c.id === courseId);
        if (course) {
          setSessions(Array.from({ length: course.completed_sessions }, (_, i) => ({ session_number: i + 1 })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const completed = sessions.length;
  const progressPct = prescribedSessions > 0 ? Math.min((completed / prescribedSessions) * 100, 100) : 0;

  return (
    <View style={s.container}>
      <Text style={s.heading}>HBOT Course</Text>
      <Text style={s.sub}>{patientName}</Text>

      <View style={s.card}>
        <View style={s.row}>
          <Activity size={16} color={C.teal} />
          <Text style={s.metric}> Sessions: {completed} / {prescribedSessions}</Text>
        </View>
        <View style={s.bar}>
          <View style={[s.fill, { width: `${progressPct}%` as any }]} />
        </View>
        <Text style={s.pct}>{Math.round(progressPct)}% complete</Text>
      </View>

      {completed >= prescribedSessions && (
        <View style={s.completeCard}>
          <CheckCircle size={20} color={C.green} />
          <Text style={s.completeText}> Course complete. Record outcome.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:      { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:          { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:         { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:          { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  metric:       { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  bar:          { height: 10, backgroundColor: C.bg, borderRadius: RADIUS.pill, overflow: 'hidden', marginBottom: 6 },
  fill:         { height: 10, backgroundColor: C.teal, borderRadius: RADIUS.pill },
  pct:          { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  completeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green + '22', borderRadius: RADIUS.md, padding: 14 },
  completeText: { fontFamily: FONT.uiSb, fontSize: 14, color: C.green },
});
