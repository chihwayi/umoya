import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, shadows } from '../../theme/designSystem';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, style, padding = 24 }) => {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.md,
  },
});

export default GlassCard;


