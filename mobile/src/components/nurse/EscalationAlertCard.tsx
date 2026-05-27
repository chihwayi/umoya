import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';

interface Props {
  escalation: {
    id: string;
    first_name: string;
    last_name: string;
    escalation_level: string;
    signal_summary: string;
    created_at: string;
  };
  onAcknowledge: (id: string) => void;
}

export const EscalationAlertCard: React.FC<Props> = ({ escalation, onAcknowledge }) => {
  const bgColor =
    escalation.escalation_level === 'critical'
      ? '#FEE2E2'
      : escalation.escalation_level === 'high'
        ? '#FFEDD5'
        : '#FEF9C3';
  const textColor =
    escalation.escalation_level === 'critical'
      ? '#991B1B'
      : escalation.escalation_level === 'high'
        ? '#9A3412'
        : '#854D0E';

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <View style={styles.row}>
        <Text style={[styles.levelTag, { color: textColor }]}>
          ⚠ {escalation.escalation_level.toUpperCase()}
        </Text>
        <Text style={[styles.name, { color: textColor }]}>
          {escalation.first_name} {escalation.last_name}
        </Text>
      </View>
      <Text style={[styles.summary, { color: textColor }]} numberOfLines={2}>
        {escalation.signal_summary}
      </Text>
      <TouchableOpacity
        style={[styles.btn, { borderColor: textColor }]}
        onPress={() => onAcknowledge(escalation.id)}
      >
        <Text style={[styles.btnText, { color: textColor }]}>Acknowledge</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.md, padding: 12, marginBottom: 8, ...SHADOW.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  levelTag: { fontSize: 11, fontFamily: FONT.uiBd },
  name: { fontSize: 13, fontFamily: FONT.uiBd, flex: 1 },
  summary: { fontSize: 12, fontFamily: FONT.ui, lineHeight: 17, marginBottom: 8 },
  btn: { borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: 6, alignItems: 'center' },
  btnText: { fontSize: 12, fontFamily: FONT.uiBd },
});
