import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  NativeModules,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const READ_TYPES = [
  'bp_systolic',
  'bp_diastolic',
  'heart_rate',
  'glucose',
  'spo2',
  'weight',
] as const;

type ReadingType = (typeof READ_TYPES)[number];

interface TrendAlert {
  id: string;
  reading_type: string;
  alert_level: string;
  message: string;
  triggered_at: string;
}

export default function WearableScreen() {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function requestPermissions() {
    if (Platform.OS === 'ios') {
      const { HealthKitModule } = NativeModules;
      if (!HealthKitModule) {
        Alert.alert('HealthKit', 'HealthKit is not available on this device.');
        return false;
      }
      await HealthKitModule.requestPermissions(READ_TYPES);
    } else {
      const { GoogleFitModule } = NativeModules;
      if (!GoogleFitModule) {
        Alert.alert('Google Fit', 'Google Fit module is not available on this device.');
        return false;
      }
      await GoogleFitModule.requestPermissions(READ_TYPES);
    }
    return true;
  }

  async function fetchFromHealthPlatform(): Promise<{ type: ReadingType; value: number; unit: string; recordedAt: string }[]> {
    if (Platform.OS === 'ios') {
      const { HealthKitModule } = NativeModules;
      return HealthKitModule.fetchRecent(READ_TYPES, 7);
    }
    const { GoogleFitModule } = NativeModules;
    return GoogleFitModule.fetchRecent(READ_TYPES, 7);
  }

  async function syncNow() {
    setSyncing(true);
    try {
      if (!connected) {
        const granted = await requestPermissions();
        if (!granted) return;
        setConnected(true);
      }

      const readings = await fetchFromHealthPlatform();

      await api.post('/wearable/readings', {
        readings: readings.map(r => ({
          readingType: r.type,
          value: r.value,
          unit: r.unit,
          recordedAt: r.recordedAt,
        })),
      });

      setLastSync(new Date().toLocaleTimeString());
      await loadAlerts();
    } catch (e: any) {
      Alert.alert('Sync failed', e?.message ?? 'An error occurred. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function loadAlerts() {
    try {
      const { data } = await api.get('/wearable/alerts') as any;
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      // non-fatal; alerts will reload on next sync
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.heading}>Health Devices</Text>

      <View style={styles.card}>
        <Text style={styles.deviceLabel}>
          {Platform.OS === 'ios' ? 'Apple Health' : 'Google Fit'}
        </Text>
        <Text style={[styles.statusText, connected && styles.statusConnected]}>
          {connected ? '● Connected' : '○ Not connected'}
        </Text>
        {lastSync && (
          <Text style={styles.subtext}>Last sync: {lastSync}</Text>
        )}
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={syncNow}
          disabled={syncing}
        >
          <Text style={styles.syncBtnText}>
            {syncing ? 'Syncing…' : connected ? 'Sync Now' : 'Connect & Sync'}
          </Text>
        </TouchableOpacity>
      </View>

      {alerts.length > 0 && (
        <View style={styles.alertBox}>
          <Text style={styles.alertHeading}>Trend Alerts</Text>
          {alerts.map((a) => (
            <View key={a.id} style={styles.alertRow}>
              <Text style={[styles.alertText, a.alert_level === 'critical' && styles.alertCritical]}>
                ⚠ {a.message}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  heading:          { fontFamily: FONT.uiBd, fontSize: 20, color: C.text, marginBottom: 16 },
  card:             { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 16, marginBottom: 12, ...SHADOW.sm },
  deviceLabel:      { fontFamily: FONT.uiBd, fontSize: 15, color: C.text },
  statusText:       { fontSize: 13, color: C.textSecondary, marginTop: 4 },
  statusConnected:  { color: C.green },
  subtext:          { fontSize: 12, color: C.textMuted, marginTop: 2 },
  syncBtn:          { marginTop: 12, backgroundColor: C.blue, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' },
  syncBtnDisabled:  { opacity: 0.5 },
  syncBtnText:      { fontFamily: FONT.uiBd, color: '#fff', fontSize: 14 },
  alertBox:         { backgroundColor: '#FFF8E1', borderRadius: RADIUS.md, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FFD54F' },
  alertHeading:     { fontFamily: FONT.uiBd, color: '#795548', marginBottom: 6, fontSize: 13 },
  alertRow:         { marginBottom: 4 },
  alertText:        { fontSize: 13, color: '#795548' },
  alertCritical:    { color: '#C62828' },
});
