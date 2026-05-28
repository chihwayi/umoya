import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../design/tokens';

interface Props {
  days: number;
  modality: string;
  urgency: 'urgent' | 'soon' | 'routine';
  overdue?: boolean;
}

const URGENCY_BG: Record<string, string> = {
  urgent: C.red,
  soon: C.amber,
  routine: C.blue,
};

const MODALITY_ICON: Record<string, string> = {
  in_person: '🏥',
  telemedicine: '📹',
  phone: '📞',
};

export default function FollowUpBadge({ days, modality, urgency, overdue }: Props) {
  const bg = overdue ? C.red : (URGENCY_BG[urgency] ?? C.blue);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.icon}>{MODALITY_ICON[modality] ?? '📅'}</Text>
      <Text style={styles.label}>{overdue ? 'OVERDUE' : `${days}d`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  icon: { fontSize: 11 },
  label: {
    fontFamily: FONT.uiBd,
    fontSize: 11,
    color: '#fff',
  },
});
