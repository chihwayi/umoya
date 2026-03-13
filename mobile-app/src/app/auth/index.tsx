import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { TenantLogoSlot } from '../../features/shared/ui/TenantLogoSlot';
import { getSession } from '../../lib/auth/auth-service';
import { routeForRole } from '../../lib/auth/routing';
import {
  authenticateBiometricLogin,
  getBiometricLoginProfile,
  getBiometricSupport,
  isBiometricLoginEnabledForSession
} from '../../lib/security/biometric-login';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';

export default function AuthLandingScreen() {
  const [biometricCta, setBiometricCta] = useState<{
    enabled: boolean;
    label: string;
    role?: 'doctor' | 'nurse' | 'patient';
    email?: string;
  }>({ enabled: false, label: 'Biometric' });
  const [loadingBiometric, setLoadingBiometric] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const session = await getSession();
      const profile = await getBiometricLoginProfile();
      const support = await getBiometricSupport();

      if (!mounted) return;
      if (!session || !profile?.enabled || !support.supported) return;

      const enabledForSession = await isBiometricLoginEnabledForSession(session);
      if (!enabledForSession) return;

      setBiometricCta({
        enabled: true,
        label: support.label,
        role: session.role,
        email: session.email
      });
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function onBiometricSignIn() {
    try {
      setLoadingBiometric(true);
      setError(null);

      const session = await getSession();
      if (!session) {
        setError('No saved session found. Please sign in with email and password.');
        return;
      }

      const unlocked = await authenticateBiometricLogin(`Use ${biometricCta.label} to sign in`);
      if (!unlocked) {
        setError(`${biometricCta.label} authentication was not completed.`);
        trackMobileEvent('auth.biometric.login_failed', { role: session.role });
        return;
      }

      trackMobileEvent('auth.biometric.login_success', { role: session.role, method: biometricCta.label });
      router.replace(routeForRole(session.role));
    } finally {
      setLoadingBiometric(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={styles.brandRow}>
          <TenantLogoSlot size={44} showName />
        </View>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Choose the access route for this device session.</Text>

        {biometricCta.enabled ? (
          <Pressable style={styles.biometricButton} onPress={onBiometricSignIn} disabled={loadingBiometric}>
            <Text style={styles.biometricText}>
              {loadingBiometric
                ? `Checking ${biometricCta.label}...`
                : `Continue with ${biometricCta.label}${biometricCta.role ? ` (${biometricCta.role})` : ''}`}
            </Text>
            {biometricCta.email ? <Text style={styles.biometricSub}>{biometricCta.email}</Text> : null}
          </Pressable>
        ) : null}

        <Pressable style={styles.providerButton} onPress={() => router.push('/auth/provider-login')}>
          <Text style={styles.providerText}>Provider Login (Doctor / Nurse)</Text>
        </Pressable>

        <Pressable style={styles.patientButton} onPress={() => router.push('/auth/patient-login')}>
          <Text style={styles.patientText}>Patient Login</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Text style={styles.link} onPress={() => router.push('/diagnostics')}>
            Open diagnostics
          </Text>
        </View>

        {error ? <StatePanel state="error" title="Biometric sign in failed" message={error} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    marginBottom: theme.spacing.md
  },
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
  biometricButton: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accentTeal,
    backgroundColor: `${theme.colors.accentTeal}22`,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  biometricText: {
    color: theme.colors.accentTeal,
    fontWeight: '700',
    textAlign: 'center'
  },
  biometricSub: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    fontSize: 11
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
