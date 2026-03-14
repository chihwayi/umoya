import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
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
import { getTenantBootstrap } from '../../lib/tenant/tenant-resolver';

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
    if (!getTenantBootstrap()) {
      router.replace('/clinic/select');
      return;
    }

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
      <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <View style={styles.topSection}>
            <Text style={styles.kicker}>MOBILE ACCESS</Text>
            <View style={styles.systemRow}>
              <View style={styles.systemLogoSlot}>
                <Image source={require('../../../assets/medicore.png')} style={styles.systemLogo} resizeMode="cover" />
              </View>
              <Text style={styles.systemName}>MediCore System</Text>
            </View>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>Choose the right login flow for this device session.</Text>

            <View style={styles.chipsRow}>
              <Pressable
                style={styles.chip}
                onPress={() => router.push('/auth/provider-login')}
                accessibilityRole="button"
                accessibilityLabel="Clinical login"
                accessibilityHint="Sign in as doctor or nurse"
              >
                <Text style={styles.chipText}>CLINICAL</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => router.push('/auth/patient-login')}
                accessibilityRole="button"
                accessibilityLabel="Patient login"
                accessibilityHint="Sign in as patient"
              >
                <Text style={styles.chipText}>PATIENT</Text>
              </Pressable>
              {biometricCta.enabled ? (
                <Pressable
                  style={[styles.chip, styles.chipHighlight]}
                  onPress={onBiometricSignIn}
                  disabled={loadingBiometric}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue with ${biometricCta.label}`}
                >
                  <Text style={styles.chipTextHighlight}>BIOMETRIC</Text>
                </Pressable>
              ) : (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>BIOMETRIC</Text>
                </View>
              )}
            </View>

            <View style={styles.tenantHero}>
              <TenantLogoSlot size={84} showName stacked showSystemMark={false} />
            </View>
          </View>

          {(biometricCta.enabled || error) ? (
            <View style={styles.formCard}>
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
              {error ? <StatePanel state="error" title="Biometric sign in failed" message={error} /> : null}
            </View>
          ) : null}
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
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  chipHighlight: {
    borderColor: theme.colors.accentTeal,
    backgroundColor: `${theme.colors.accentTeal}18`
  },
  chipText: {
    color: '#9FB4D8',
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '600'
  },
  chipTextHighlight: {
    color: theme.colors.accentTeal,
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '700'
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
    fontWeight: '700'
  },
  biometricSub: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    fontSize: 11
  }
});
