import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../design/tokens';

type Status = 'active' | 'unavailable' | 'abstained' | 'loading';

interface Props { status: Status; }

const CHIP_COLORS: Record<Status, { bg: string; text: string }> = {
  active:      { bg: C.green + '33', text: C.green },
  unavailable: { bg: C.red + '33',   text: C.red   },
  abstained:   { bg: C.amber + '33', text: C.amber  },
  loading:     { bg: C.blue + '33',  text: C.blue   },
};

const CHIP_LABELS: Record<Status, string> = {
  active:      'AI Active',
  unavailable: 'AI Unavailable',
  abstained:   'AI Abstained',
  loading:     'Analysing…',
};

export const AiStatusChip: React.FC<Props> = ({ status }) => {
  const col = CHIP_COLORS[status];
  return (
    <View style={[styles.chip, { backgroundColor: col.bg }]}>
      <Text style={[styles.label, { color: col.text }]}>
        {CHIP_LABELS[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FONT.uiBd,
    fontSize: 11,
  },
});
