import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../design/theme';

type StatePanelProps = {
  title: string;
  message?: string;
  state: 'loading' | 'empty' | 'error' | 'offline' | 'info';
  actionLabel?: string;
  onAction?: () => void;
};

export function StatePanel({ title, message, state, actionLabel, onAction }: StatePanelProps) {
  const showCta = Boolean(actionLabel && onAction);
  return (
    <View style={[styles.wrapper, state === 'info' && styles.wrapperInfo]}>
      {state === 'loading' ? <ActivityIndicator color={theme.colors.accentTeal} /> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {showCta ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.ctaText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
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
    ...theme.typography.textStyles.title
  },
  message: {
    color: theme.colors.textSecondary,
    ...theme.typography.textStyles.body
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs
  },
  ctaPressed: {
    opacity: 0.85
  },
  ctaText: {
    color: '#022018',
    ...theme.typography.textStyles.bodyLarge,
    fontWeight: '700'
  }
});
