import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckCircle, AlertTriangle, Ear, Heart, Droplet } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const RESULT_COLOR: Record<string, string> = {
  pass: C.green, bilateral_pass: C.green,
  refer: C.coral, bilateral_refer: C.coral, unilateral_refer: C.amber,
  fail_urgent: C.red, fail_repeat: C.coral,
  normal: C.green, abnormal: C.coral, pending: C.textMuted,
  unsatisfactory: C.amber, repeat_required: C.amber,
};

export default function NeonatalScreeningScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params ?? {};
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    api.get(`/neonatal-screening/patient/${patientId}/summary`)
      .then((r: any) => setSummary(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  const { nbs, hearing, cchd } = summary ?? {};

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>Newborn Screening</Text>
      <Text style={s.sub}>{patientName ?? 'Patient'}</Text>

      {/* NBS Card */}
      <View style={s.card}>
        <View style={s.row}>
          <Droplet size={16} color={C.teal} />
          <Text style={s.cardTitle}> Heel Prick NBS</Text>
        </View>
        {nbs ? (
          <>
            <Text style={[s.result, { color: RESULT_COLOR[nbs.result_status] ?? C.textMuted }]}>
              {nbs.result_status?.toUpperCase()}
            </Text>
            {nbs.any_abnormal && <Text style={s.alert}>⚠ Abnormal result — escalation required</Text>}
            <Text style={s.detail}>Card: {nbs.card_number}</Text>
            {nbs.tsh_result != null && <Text style={s.detail}>TSH: {nbs.tsh_result} mIU/L</Text>}
            {nbs.pku_result != null && <Text style={s.detail}>PKU: {nbs.pku_result} µmol/L</Text>}
          </>
        ) : <Text style={s.notDone}>Not yet collected</Text>}
      </View>

      {/* Hearing Card */}
      <View style={s.card}>
        <View style={s.row}>
          <Ear size={16} color={C.blue} />
          <Text style={s.cardTitle}> Hearing Screening (AOAE)</Text>
        </View>
        {hearing ? (
          <>
            <Text style={[s.result, { color: RESULT_COLOR[hearing.overall_result] ?? C.textMuted }]}>
              {hearing.overall_result?.replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={s.detail}>L: {hearing.left_ear_result} | R: {hearing.right_ear_result}</Text>
            {hearing.requires_abr && <Text style={s.alert}>ABR referral required</Text>}
          </>
        ) : <Text style={s.notDone}>Not yet screened</Text>}
      </View>

      {/* CCHD Card */}
      <View style={s.card}>
        <View style={s.row}>
          <Heart size={16} color={C.coral} />
          <Text style={s.cardTitle}> CCHD Pulse-Ox</Text>
        </View>
        {cchd ? (
          <>
            <Text style={[s.result, { color: RESULT_COLOR[cchd.screen_result] ?? C.textMuted }]}>
              {cchd.screen_result?.replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={s.detail}>
              RH: {cchd.right_hand_spo2}% | Foot: {cchd.foot_spo2}% | Diff: {Number(cchd.differential ?? 0).toFixed(1)}%
            </Text>
            {cchd.screen_result === 'fail_urgent' && (
              <Text style={s.alertRed}>⚠ URGENT — immediate cardiorespiratory assessment</Text>
            )}
          </>
        ) : <Text style={s.notDone}>Not yet screened</Text>}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:        { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle:  { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary },
  result:     { fontFamily: FONT.uiBd, fontSize: 18 },
  detail:     { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 4 },
  notDone:    { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
  alert:      { fontFamily: FONT.uiSb, fontSize: 12, color: C.amber, marginTop: 6 },
  alertRed:   { fontFamily: FONT.uiSb, fontSize: 12, color: C.red, marginTop: 6 },
});
