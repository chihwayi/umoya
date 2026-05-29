import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface Props {
  appointmentId?: string;
  appointmentTime?: string;
  doctorName?: string;
}

export default function CheckInScreen({ appointmentId, appointmentTime, doctorName }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        setToken(null);
        setExpiresAt(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  async function handleImHere() {
    setLoading(true);
    try {
      const { data } = await api.post('/checkin/token', { appointmentId }) as any;
      setToken(data.token);
      setExpiresAt(new Date(data.expiresAt));
      setSecondsLeft(600);
    } catch {
      Alert.alert('Error', 'Could not generate check-in code. Please try again or see reception.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Check In</Text>
      {appointmentTime && (
        <Text style={styles.meta}>
          Appointment: {appointmentTime}{doctorName ? ` with ${doctorName}` : ''}
        </Text>
      )}

      {!token ? (
        <TouchableOpacity style={styles.btn} onPress={handleImHere} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>I'm Here →</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.qrContainer}>
          <QRCode value={token} size={220} backgroundColor="white" />
          <Text style={styles.instruction}>Show this to the nurse or scan at the door</Text>
          <Text style={styles.timer}>
            {secondsLeft > 0
              ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
              : 'Code expired — tap below to refresh'}
          </Text>
          {secondsLeft === 0 && (
            <TouchableOpacity style={[styles.btn, { marginTop: 12 }]} onPress={handleImHere}>
              <Text style={styles.btnText}>Get New Code</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, padding: 24, alignItems: 'center', justifyContent: 'center' },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 8 },
  meta:        { fontSize: 13, color: C.textSecondary, marginBottom: 24, textAlign: 'center' },
  btn: {
    backgroundColor: C.blue, borderRadius: RADIUS.md,
    paddingVertical: 14, paddingHorizontal: 40, ...SHADOW.sm,
  },
  btnText:     { fontFamily: FONT.uiBd, color: '#fff', fontSize: 16 },
  qrContainer: { alignItems: 'center', gap: 12 },
  instruction: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 8 },
  timer:       { fontSize: 13, color: C.textMuted, fontFamily: FONT.uiBd },
});
