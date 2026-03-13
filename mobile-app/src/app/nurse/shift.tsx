import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { theme } from '../../design/theme';

export default function PlaceholderScreen() {
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Coming in Sprint 02</Text>
        <Text style={styles.message}>Nurse shell is ready; workflow screens are next.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: theme.spacing.sm
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: 13
  }
});
