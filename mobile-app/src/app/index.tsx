import React from 'react';
import { Text, StyleSheet, Image } from 'react-native';
import { Screen } from '../features/shared/ui/Screen';
import { Card } from '../features/shared/ui/Card';
import { theme } from '../design/theme';

export default function HomeScreen() {
  return (
    <Screen>
      <Card>
        <Image source={require('../../assets/medicore.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>MediCore Mobile Foundation</Text>
        <Text style={styles.subtitle}>
          Sprint 00 scaffold is ready. Tenant bootstrap, auth, notifications, API layer, and design system are wired.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 72,
    height: 72,
    marginBottom: theme.spacing.md
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: theme.spacing.sm
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20
  }
});
