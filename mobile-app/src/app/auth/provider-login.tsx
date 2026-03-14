import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { TenantLogoSlot } from '../../features/shared/ui/TenantLogoSlot';
import { providerLogin } from '../../services/api/ehr';
import { saveSession } from '../../lib/auth/auth-service';
import { routeForRole } from '../../lib/auth/routing';
import type { AuthSession } from '../../lib/auth/types';
import { registerDevicePushToken } from '../../lib/notifications/push-service';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';
import { getBiometricSupport, setBiometricLoginPreference } from '../../lib/security/biometric-login';
import { getTenantBootstrap } from '../../lib/tenant/tenant-resolver';

export default function ProviderLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [useBiometric, setUseBiometric] = useState(true);

  useEffect(() => {
    if (!getTenantBootstrap()) {
      router.replace('/clinic/select');
      return;
    }

    let mounted = true;
    void (async () => {
      const support = await getBiometricSupport();
      if (!mounted) return;
      setBiometricSupported(support.supported);
      setBiometricLabel(support.label);
      setUseBiometric(support.supported);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onLogin() {
    try {
      setLoading(true);
      setError(null);

      const response = await providerLogin({ email, password });

      if (response?.requiresTwoFactor && response?.tempToken) {
        router.push({ pathname: '/auth/two-factor', params: { tempToken: response.tempToken } });
        return;
      }

      if (response?.mustChangePassword && response?.token) {
        router.push({ pathname: '/auth/force-password-change', params: { temporaryToken: response.token } });
        return;
      }

      if (!response?.token || !response?.user) {
        throw new Error('Unexpected login payload from server.');
      }

      const roleValue = String(response.user.role || '').toLowerCase();
      const role: AuthSession['role'] = roleValue === 'nurse' ? 'nurse' : roleValue === 'doctor' ? 'doctor' : 'doctor';
      await saveSession({
        role,
        accessToken: response.token,
        userId: response.user.id,
        email: response.user.email
      });
      await setBiometricLoginPreference(
        {
          role,
          accessToken: response.token,
          userId: response.user.id,
          email: response.user.email
        },
        biometricSupported && useBiometric
      );
      trackMobileEvent('auth.biometric.preference_set', {
        role,
        enabled: biometricSupported && useBiometric
      });
      trackMobileEvent('auth.login.success', { role, tenant: response.user?.tenant_id || 'unknown' });
      await registerDevicePushToken(response.token).catch(() => {
        trackMobileEvent('push.register.failed', { role });
      });

      router.replace(routeForRole(role));
    } catch (err: any) {
      trackMobileEvent('auth.login.failed', {
        role: 'provider',
        code: err?.code || 'unknown',
        status: err?.response?.status || 0
      });
      setError(err?.response?.data?.message || err?.message || 'Provider login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <View style={styles.topSection}>
            <Text style={styles.kicker}>CLINIC ACCESS</Text>
            <View style={styles.systemRow}>
              <View style={styles.systemLogoSlot}>
                <Image source={require('../../../assets/medicore.png')} style={styles.systemLogo} resizeMode="cover" />
              </View>
              <Text style={styles.systemName}>MediCore System</Text>
            </View>
            <Text style={styles.title}>Provider Login</Text>
            <Text style={styles.subtitle}>Doctor and nurse access for coordinated live care workflows.</Text>

            <View style={styles.chipsRow}>
              <Text style={styles.chip}>CDSS</Text>
              <Text style={styles.chip}>POSTVISIT AI</Text>
              <Text style={styles.chip}>FHIR READY</Text>
            </View>

            <View style={styles.tenantHero}>
              <TenantLogoSlot size={84} showName stacked showSystemMark={false} />
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@example.com"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
            />

            {biometricSupported ? (
              <Pressable style={styles.toggleRow} onPress={() => setUseBiometric((prev) => !prev)}>
                <View style={[styles.checkbox, useBiometric && styles.checkboxOn]} />
                <Text style={styles.toggleText}>Use {biometricLabel} for faster sign in on this device</Text>
              </Pressable>
            ) : null}

            {error ? <StatePanel state="error" title="Login failed" message={error} /> : null}

            <Pressable style={styles.button} disabled={loading} onPress={onLogin}>
              <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
            </Pressable>

            <View style={styles.linkRow}>
              <Text style={styles.link} onPress={() => router.push('/auth/patient-login')}>
                Switch to patient login
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    flexGrow: 1,
    paddingBottom: theme.spacing.lg
  },
  panel: {
    flex: 1,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg
  },
  topSection: {
    gap: theme.spacing.sm
  },
  kicker: {
    color: theme.colors.textSecondary,
    letterSpacing: 3,
    fontSize: 11
  },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs
  },
  systemLogoSlot: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  systemLogo: {
    width: '100%',
    height: '100%'
  },
  systemName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 54,
    fontWeight: '700'
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    color: '#9FB4D8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    letterSpacing: 1.1
  },
  tenantHero: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    alignItems: 'center'
  },
  formCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: '#0D1A2D',
    padding: theme.spacing.md
  },
  inputLabel: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: theme.spacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: 16
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  checkboxOn: {
    backgroundColor: theme.colors.accentTeal,
    borderColor: theme.colors.accentTeal
  },
  toggleText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12
  },
  button: {
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  buttonText: {
    color: '#05211A',
    fontWeight: '700',
    fontSize: 34
  },
  linkRow: {
    marginTop: theme.spacing.md,
    alignItems: 'center'
  },
  link: {
    color: theme.colors.accentBlue,
    fontSize: 17
  }
});
