import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface ScorePoint {
  scored_at: string;
  score: number;
  risk_level: string;
}

const LEVEL_COLOR: Record<string, string> = {
  low:      '#2E7D32',
  medium:   '#E65100',
  high:     '#C62828',
  critical: '#4A148C',
};

const LEVEL_LABEL: Record<string, string> = {
  low:      'Looking Good',
  medium:   'Monitor Closely',
  high:     'Attention Needed',
  critical: 'Urgent Review',
};

interface Props {
  patientId: string;
}

export function HealthTrendCard({ patientId }: Props) {
  const [history, setHistory] = useState<ScorePoint[]>([]);

  useEffect(() => {
    api
      .get(`/risk/patients/${patientId}/history?days=14`)
      .then((r: any) => setHistory(r.data ?? r))
      .catch(() => {});
  }, [patientId]);

  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const color = LEVEL_COLOR[latest.risk_level] ?? '#555';
  const max = Math.max(...history.map((h) => h.score), 1);

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.heading}>Your Health Trend</Text>
      <Text style={[styles.level, { color }]}>{LEVEL_LABEL[latest.risk_level] ?? latest.risk_level}</Text>
      <Text style={styles.score}>Risk score: {Math.round(latest.score)} / 100</Text>

      <View style={styles.sparkline}>
        {history.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: Math.max(4, (h.score / max) * 40),
                backgroundColor: LEVEL_COLOR[h.risk_level] ?? '#ccc',
              },
            ]}
          />
        ))}
      </View>

      <Text style={styles.subtext}>Based on your health surveys and device readings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card:      { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 16, borderLeftWidth: 4, marginBottom: 12, ...SHADOW.sm },
  heading:   { fontSize: 12, fontFamily: FONT.uiBd, color: C.textSecondary, marginBottom: 4 },
  level:     { fontSize: 17, fontFamily: FONT.uiBd, marginBottom: 2 },
  score:     { fontSize: 13, color: C.textSecondary },
  sparkline: { flexDirection: 'row', alignItems: 'flex-end', height: 44, marginTop: 10, gap: 3 },
  bar:       { width: 8, borderRadius: 2 },
  subtext:   { fontSize: 11, color: C.textMuted, marginTop: 6 },
});
