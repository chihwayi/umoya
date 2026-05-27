import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { buildApiClient } from '../../services/api';

const STATUS_COLOR: Record<string, string> = {
  active:    '#276749',
  completed: '#718096',
  overdue:   '#c53030',
};

export const MmdScheduleScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const patientId: string = route.params?.patientId ?? '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = buildApiClient('');
    api.get(`/hiv/patients/${patientId}/mmd/schedule`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load MMD schedule.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.purple} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>MMD Schedule</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      ) : !data?.schedules?.length ? (
        <View style={styles.card}>
          <Text style={styles.emptyTxt}>No MMD schedule on record for this patient.</Text>
        </View>
      ) : (
        <>
          {data.current && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Current Dispensing</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Schedule Type</Text>
                <Text style={styles.rowValue}>{data.current.schedule_type}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Next Pickup</Text>
                <Text style={[styles.rowValue, { color: C.purple, fontWeight: '600' }]}>
                  {data.current.next_pickup_date ?? '—'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Months Supply</Text>
                <Text style={styles.rowValue}>{data.current.months_supply ?? '—'}</Text>
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>History</Text>
            {data.schedules.map((s: any) => (
              <View key={s.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{s.start_date}</Text>
                  <Text style={styles.historyType}>{s.schedule_type}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: (STATUS_COLOR[s.status] ?? '#718096') + '20' }]}>
                  <Text style={[styles.pillTxt, { color: STATUS_COLOR[s.status] ?? '#718096' }]}>
                    {s.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: C.purple,
  },
  backBtn: { marginBottom: 8 },
  backTxt: { color: '#fff', fontSize: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', fontFamily: FONT.bold },
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: 16,
    ...SHADOW.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: C.text },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 14, color: C.textSecondary },
  rowValue: { fontSize: 14, color: C.text },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyDate: { fontSize: 13, fontWeight: '600', color: C.text },
  historyType: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillTxt: { fontSize: 12, fontWeight: '600' },
  emptyTxt: { color: C.textSecondary, fontSize: 14 },
  errorBox: { margin: 16, padding: 14, backgroundColor: '#fff5f5', borderRadius: RADIUS.md },
  errorTxt: { color: '#c53030' },
});
