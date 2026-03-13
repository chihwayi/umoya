import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { forceProviderPasswordChange } from '../../services/api/ehr';

export default function ForcePasswordChangeScreen() {
  const params = useLocalSearchParams<{ temporaryToken?: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submitChange() {
    if (!params.temporaryToken) {
      setError('Temporary password-change session not found.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await forceProviderPasswordChange({ newPassword, temporaryToken: params.temporaryToken });
      setSuccess('Password changed. Please log in again.');
      setTimeout(() => router.replace('/auth/provider-login'), 900);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Password change failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Password Change Required</Text>
        <Text style={styles.subtitle}>Complete this once to continue provider access.</Text>

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="New password"
          placeholderTextColor={theme.colors.textMuted}
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Confirm new password"
          placeholderTextColor={theme.colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <StatePanel state="error" title="Password update failed" message={error} /> : null}
        {success ? <StatePanel state="empty" title="Success" message={success} /> : null}

        <Pressable style={styles.button} disabled={loading} onPress={submitChange}>
          <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Update Password'}</Text>
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
    backgroundColor: theme.colors.accentAmber,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  buttonText: {
    color: '#2E1D00',
    fontWeight: '700'
  }
});
