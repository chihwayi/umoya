import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../design/theme';

type StatePanelProps = {
  title: string;
  message?: string;
  state: 'loading' | 'empty' | 'error' | 'offline' | 'info';
};

export function StatePanel({ title, message, state }: StatePanelProps) {
  return (
    <View style={[styles.wrapper, state === 'info' && styles.wrapperInfo]}>
      {state === 'loading' ? <ActivityIndicator color={theme.colors.accentTeal} /> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  wrapperInfo: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentTeal
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  }
});
