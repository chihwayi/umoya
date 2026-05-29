import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface Referral {
  id: string;
  specialty: string;
  referred_to_facility_name: string;
  status: string;
  urgency: string;
  appointment_scheduled_date?: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft:        'Pending',
  sent:         'Sent to Specialist',
  acknowledged: 'Received by Facility',
  scheduled:    'Appointment Scheduled',
  completed:    'Completed',
  cancelled:    'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  draft:        '#9E9E9E',
  sent:         '#1565C0',
  acknowledged: '#0288D1',
  scheduled:    '#2E7D32',
  completed:    '#757575',
  cancelled:    '#C62828',
};

export default function ReferralStatusScreen() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/referrals')
      .then((r: any) => setReferrals(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.blue} />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={referrals}
      keyExtractor={(r) => r.id}
      ListEmptyComponent={
        <Text style={styles.empty}>No referrals on file.</Text>
      }
      renderItem={({ item: r }) => {
        const color = STATUS_COLOR[r.status] ?? '#9E9E9E';
        return (
          <View style={styles.card}>
            <Text style={styles.specialty}>{r.specialty}</Text>
            <Text style={styles.facility}>{r.referred_to_facility_name}</Text>
            <View style={[styles.badge, { backgroundColor: color + '22' }]}>
              <Text style={[styles.badgeText, { color }]}>
                {STATUS_LABEL[r.status] ?? r.status}
              </Text>
            </View>
            {r.appointment_scheduled_date && (
              <Text style={styles.apptDate}>
                Appointment: {new Date(r.appointment_scheduled_date).toLocaleDateString()}
              </Text>
            )}
            <Text style={styles.urgency}>
              Priority: <Text style={{ textTransform: 'capitalize' }}>{r.urgency}</Text>
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 10, ...SHADOW.sm },
  specialty: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text },
  facility:  { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  badge:     { alignSelf: 'flex-start', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { fontSize: 12, fontFamily: FONT.uiBd },
  apptDate:  { fontSize: 12, color: C.green, marginTop: 6 },
  urgency:   { fontSize: 12, color: C.textMuted, marginTop: 2 },
  empty:     { textAlign: 'center', color: C.textMuted, marginTop: 40, fontStyle: 'italic' },
});
