import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONT } from '../../design/tokens';

interface SectionHeaderProps {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
  style?: object;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  children,
  action,
  onAction,
  style,
}) => (
  <View style={[styles.row, style]}>
    <Text style={styles.label}>{children}</Text>
    {action && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.action}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  label: {
    fontFamily: FONT.uiBd,
    fontSize: 12,
    color: C.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  action: {
    fontFamily: FONT.uiSb,
    fontSize: 12,
    color: C.teal,
  },
});
