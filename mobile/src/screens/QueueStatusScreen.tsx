import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const EHR_WS_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/api$/, '');

interface Props {
  patientId: string;
}

export default function QueueStatusScreen({ patientId }: Props) {
  const [entry, setEntry] = useState<any | null>(null);
  const [yourTurn, setYourTurn] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Load initial state via REST in case WS is slow
    api.get(`/queue/patient/${patientId}`).then((r: any) => {
      if (r?.data) setEntry(r.data);
    }).catch(() => {});

    const socket: Socket = io(`${EHR_WS_URL}/queue`, { transports: ['websocket'] });

    socket.on('connect', () => {
      socket.emit('subscribe', { patientId });
    });

    socket.on('queue_update', (data: any) => {
      setEntry(data);
    });

    socket.on('your_turn', () => {
      setYourTurn(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 400, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ).start();
    });

    return () => { socket.disconnect(); };
  }, [patientId]);

  if (yourTurn) {
    return (
      <View style={styles.center}>
        <Animated.View style={[styles.turnCard, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.turnIcon}>🔔</Text>
          <Text style={styles.turnText}>Your Turn!</Text>
          <Text style={styles.turnSub}>Please proceed to the consultation room.</Text>
        </Animated.View>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.center}>
        <Text style={styles.noQueue}>You are not currently in the queue.</Text>
        <Text style={styles.noQueueSub}>Check in at reception or use the QR check-in button.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your Queue Position</Text>
      <View style={styles.card}>
        <Text style={styles.bigNumber}>#{entry.queue_number}</Text>
        <Text style={styles.statusLabel}>
          {entry.status === 'called' ? 'Being Called' : 'Waiting'}
        </Text>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Ahead of you</Text>
            <Text style={styles.infoValue}>{entry.patients_ahead ?? '—'}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Est. wait</Text>
            <Text style={styles.infoValue}>
              {entry.estimated_wait_minutes != null ? `~${entry.estimated_wait_minutes}m` : '—'}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.subtext}>Updates automatically. You will be alerted when it's your turn.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, padding: 24 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  heading:     { fontFamily: FONT.uiBd, fontSize: 20, color: C.text, marginBottom: 20 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 28, alignItems: 'center', ...SHADOW.sm },
  bigNumber:   { fontFamily: FONT.uiBd, fontSize: 56, color: C.blue },
  statusLabel: { fontSize: 14, color: C.textSecondary, marginTop: 4, marginBottom: 20 },
  divider:     { width: '80%', height: 1, backgroundColor: C.border, marginBottom: 20 },
  infoRow:     { flexDirection: 'row', gap: 40 },
  infoBlock:   { alignItems: 'center' },
  infoLabel:   { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  infoValue:   { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  subtext:     { fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 20 },
  noQueue:     { fontFamily: FONT.uiBd, fontSize: 16, color: C.text, textAlign: 'center' },
  noQueueSub:  { fontSize: 13, color: C.textSecondary, marginTop: 8, textAlign: 'center' },
  turnCard:    { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 36, alignItems: 'center', ...SHADOW.sm },
  turnIcon:    { fontSize: 56, marginBottom: 12 },
  turnText:    { fontFamily: FONT.uiBd, fontSize: 28, color: C.green },
  turnSub:     { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 8 },
});
