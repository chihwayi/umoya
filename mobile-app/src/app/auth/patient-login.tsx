import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { patientLogin } from '../../services/api/ehr';
import { saveSession } from '../../lib/auth/auth-service';
import { registerDevicePushToken } from '../../lib/notifications/push-service';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';

export default function PatientLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    try {
      setLoading(true);
      setError(null);

      const response = await patientLogin({ email, password });

      if (!response?.success) {
        throw new Error(response?.message || 'Patient login failed');
      }

      if (!response?.token || !response?.patient) {
        throw new Error('Invalid patient login payload');
      }

      await saveSession({
        role: 'patient',
        accessToken: response.token,
        userId: response.patient.id,
        email: response.patient.email
      });
      trackMobileEvent('auth.login.success', { role: 'patient' });
      await registerDevicePushToken(response.token).catch(() => {
        trackMobileEvent('push.register.failed', { role: 'patient' });
      });

      router.replace('/patient');
    } catch (err: any) {
      trackMobileEvent('auth.login.failed', {
        role: 'patient',
        code: err?.code || 'unknown',
        status: err?.response?.status || 0
      });
      setError(err?.response?.data?.message || err?.message || 'Patient login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Patient Login</Text>
        <Text style={styles.subtitle}>Access appointments, medications, and bills.</Text>

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={theme.colors.textMuted}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          value={password}
          onChangeText={setPassword}
        />

        {error ? <StatePanel state="error" title="Login failed" message={error} /> : null}

        <Pressable style={styles.button} disabled={loading} onPress={onLogin}>
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Text style={styles.link} onPress={() => router.push('/auth/provider-login')}>
            Switch to provider login
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700'
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  button: {
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  buttonText: {
    color: '#022018',
    fontWeight: '700'
  },
  linkRow: {
    marginTop: theme.spacing.md,
    alignItems: 'center'
  },
  link: {
    color: theme.colors.accentBlue,
    fontSize: 13
  }
});
