import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { completeProvider2FA } from '../../services/api/ehr';
import { saveSession } from '../../lib/auth/auth-service';
import { routeForRole } from '../../lib/auth/routing';
import type { AuthSession } from '../../lib/auth/types';

export default function TwoFactorScreen() {
  const params = useLocalSearchParams<{ tempToken?: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeLogin() {
    if (!params.tempToken) {
      setError('2FA temporary token missing. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await completeProvider2FA({ tempToken: params.tempToken, code });

      if (!response?.token || !response?.user) {
        throw new Error('Invalid 2FA completion payload.');
      }

      const roleValue = String(response.user.role || '').toLowerCase();
      const role: AuthSession['role'] =
        roleValue === 'nurse' || roleValue === 'nurse_accounts' ? 'nurse' : 'doctor';

      await saveSession({
        role,
        accessToken: response.token,
        userId: response.user.id,
        email: response.user.email
      });

      router.replace(routeForRole(role));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid authentication code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Two-Factor Verification</Text>
        <Text style={styles.subtitle}>Enter the authenticator code to complete provider login.</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="6-digit code"
          placeholderTextColor={theme.colors.textMuted}
        />

        {error ? <StatePanel state="error" title="2FA failed" message={error} /> : null}

        <Pressable style={styles.button} disabled={loading} onPress={completeLogin}>
          <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Complete Login'}</Text>
        </Pressable>
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
    backgroundColor: theme.colors.accentBlue,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  buttonText: {
    color: '#EAF1FF',
    fontWeight: '700'
  }
});
