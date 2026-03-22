import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { C, RADIUS, SHADOW } from '../../design/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string;
  accentSide?: boolean;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  accent,
  accentSide = false,
  padding = 14,
}) => (
  <View
    style={[
      styles.card,
      accent && accentSide && { borderLeftColor: accent, borderLeftWidth: 3 },
      accent && !accentSide && { borderColor: accent + '33' },
      { padding },
      style,
    ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.card,
  },
});
