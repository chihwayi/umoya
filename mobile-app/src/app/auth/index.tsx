import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { theme } from '../../design/theme';

export default function AuthLandingScreen() {
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Choose the access route for this device session.</Text>

        <Pressable style={styles.providerButton} onPress={() => router.push('/auth/provider-login')}>
          <Text style={styles.providerText}>Provider Login (Doctor / Nurse)</Text>
        </Pressable>

        <Pressable style={styles.patientButton} onPress={() => router.push('/auth/patient-login')}>
          <Text style={styles.patientText}>Patient Login</Text>
        </Pressable>
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
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: theme.spacing.lg
  },
  providerButton: {
    backgroundColor: theme.colors.accentBlue,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  providerText: {
    color: '#EAF1FF',
    fontWeight: '700',
    textAlign: 'center'
  },
  patientButton: {
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md
  },
  patientText: {
    color: '#022018',
    fontWeight: '700',
    textAlign: 'center'
  }
});
