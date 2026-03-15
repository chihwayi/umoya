import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../design/theme';

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: theme.spacing.sm,
    marginBottom: 2
  },
  title: {
    color: theme.colors.textPrimary,
    ...theme.typography.textStyles.title
  },
  subtitle: {
    color: theme.colors.textMuted,
    ...theme.typography.textStyles.caption,
    marginTop: 2
  }
});
