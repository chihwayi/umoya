import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../features/shared/ui/Screen';
import { Card } from '../features/shared/ui/Card';
import { theme } from '../design/theme';

export default function NotificationsShellScreen() {
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Notification Centre</Text>
        <Text style={styles.message}>
          Shell is ready for role-aware notifications. Full category + deep-link workflows will be wired in Sprint 02/03.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.sm
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  }
});
