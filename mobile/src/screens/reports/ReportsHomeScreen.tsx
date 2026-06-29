import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon } from '../../components/ui/Icon';

const REPORTS = [
  { key: 'CascadeDetail',        title: 'HIV Treatment Cascade',   sub: 'Waterfall & retention',   icon: 'trending' as const,  color: C.teal   },
  { key: 'EquitySummary',        title: 'Equity Analytics',        sub: 'District & gender gaps',   icon: 'users'    as const,  color: C.blue   },
  { key: 'MdsrMobile',           title: 'MDSR — Maternal Mortality', sub: 'Deaths & reviews',       icon: 'heart'    as const,  color: C.coral  },
  { key: 'PharmacyReports',      title: 'Pharmacy Intelligence',   sub: 'Formulary & AMS',          icon: 'pill'     as const,  color: C.amber  },
  { key: 'DhisAlerts',           title: 'DHIS2 Validation Alerts', sub: 'Outliers & data quality',  icon: 'alert'    as const,  color: C.orange },
  { key: 'LabQuality',           title: 'Lab Quality Indicators',  sub: 'PT panels & TAT',          icon: 'lab'      as const,  color: C.violet },
  { key: 'AiGovernanceMobile',   title: 'AI Governance',           sub: 'Drift, fairness & status', icon: 'brain'    as const,  color: C.green  },
];

export default function ReportsHomeScreen() {
  const nav = useNavigation<any>();

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <Text style={s.heading}>Clinical Reports</Text>
      <Text style={s.sub}>Analytics & quality indicators</Text>

      {REPORTS.map(r => (
        <TouchableOpacity
          key={r.key}
          style={s.card}
          activeOpacity={0.75}
          onPress={() => nav.navigate(r.key)}
        >
          <View style={[s.iconBox, { backgroundColor: r.color + '22' }]}>
            <Icon name={r.icon} size={22} color={r.color} />
          </View>
          <View style={s.cardBody}>
            <Text style={s.cardTitle}>{r.title}</Text>
            <Text style={s.cardSub}>{r.sub}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={C.textMuted} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  heading: { fontFamily: FONT.uiBd, fontSize: 24, color: C.text, marginBottom: 4 },
  sub: { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.card,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, marginLeft: 14 },
  cardTitle: { fontFamily: FONT.uiSb, fontSize: 15, color: C.text, marginBottom: 2 },
  cardSub: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
});
