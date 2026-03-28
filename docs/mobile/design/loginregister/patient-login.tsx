import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { TenantLogoSlot } from '../../features/shared/ui/TenantLogoSlot';
import { patientLogin } from '../../services/api/ehr';
import { saveSession } from '../../lib/auth/auth-service';
import { routeForRole } from '../../lib/auth/routing';
import { registerDevicePushToken } from '../../lib/notifications/push-service';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';
import { getBiometricSupport, setBiometricLoginPreference } from '../../lib/security/biometric-login';
import { getTenantBootstrap } from '../../lib/tenant/tenant-resolver';

type LoginRole = 'patient' | 'provider';

export default function PatientLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [useBiometric, setUseBiometric] = useState(true);
  const [activeRole, setActiveRole] = useState<LoginRole>('patient');

  const tenant = getTenantBootstrap();

  useEffect(() => {
    if (!tenant) {
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

  function handleRoleSwitch(role: LoginRole) {
    setActiveRole(role);
    setError(null);
    if (role === 'provider') {
      router.replace('/auth/provider-login');
    }
  }

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

      const session = {
        role: 'patient' as const,
        accessToken: response.token,
        userId: response.patient.id,
        email: response.patient.email,
      };

      await saveSession(session);
      await setBiometricLoginPreference(session, biometricSupported && useBiometric);

      trackMobileEvent('auth.biometric.preference_set', {
        role: 'patient',
        enabled: biometricSupported && useBiometric,
      });
      trackMobileEvent('auth.login.success', { role: 'patient' });

      await registerDevicePushToken(response.token).catch(() => {
        trackMobileEvent('push.register.failed', { role: 'patient' });
      });

      router.replace(routeForRole('patient'));
    } catch (err: any) {
      trackMobileEvent('auth.login.failed', {
        role: 'patient',
        code: err?.code || 'unknown',
        status: err?.response?.status || 0,
      });
      setError(err?.response?.data?.message || err?.message || 'Patient login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Top bar: MediCore brand + settings ── */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.systemLogoSlot}>
              <Image
                source={require('../../../assets/medicore.png')}
                style={styles.systemLogo}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.systemName}>MEDICORE</Text>
          </View>
          <Pressable style={styles.gearButton} onPress={() => router.push('/settings')}>
            {/* Replace with your icon library if available */}
            <Text style={styles.gearIcon}>⚙</Text>
          </Pressable>
        </View>

        {/* ── Tenant chip ── */}
        <View style={styles.tenantChip}>
          <View style={styles.tenantChipAvatar}>
            <TenantLogoSlot size={22} showName={false} showSystemMark={false} />
          </View>
          <Text style={styles.tenantChipLabel}>
            {tenant?.name?.toUpperCase() ?? 'CLINIC'}
          </Text>
        </View>

        {/* ── Hero headline ── */}
        <Text style={styles.headline}>Welcome{'\n'}back.</Text>
        <Text style={styles.subtitle}>
          Sign in to access your health{'\n'}records, appointments &amp; more.
        </Text>

        {/* ── Feature chips ── */}
        <View style={styles.chipsRow}>
          {['APPOINTMENTS', 'PRESCRIPTIONS', 'BILLING'].map((c) => (
            <Text key={c} style={styles.chip}>
              {c}
            </Text>
          ))}
        </View>

        {/* ── Patient / Provider toggle ── */}
        <View style={styles.roleToggle}>
          {(['patient', 'provider'] as LoginRole[]).map((role) => (
            <Pressable
              key={role}
              style={[styles.roleTab, activeRole === role && styles.roleTabActive]}
              onPress={() => handleRoleSwitch(role)}
            >
              <Text
                style={[
                  styles.roleTabText,
                  activeRole === role && styles.roleTabTextActive,
                ]}
              >
                {role === 'patient' ? 'Patient' : 'Provider'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Form card ── */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@example.com"
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.inputLabel}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Enter your password"
            placeholderTextColor={theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={styles.forgotRow}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {biometricSupported ? (
            <Pressable
              style={styles.toggleRow}
              onPress={() => setUseBiometric((prev) => !prev)}
            >
              <View style={[styles.checkbox, useBiometric && styles.checkboxOn]} />
              <Text style={styles.toggleText}>
                Use {biometricLabel} for faster sign in
              </Text>
            </Pressable>
          ) : null}

          {error ? (
            <StatePanel state="error" title="Login failed" message={error} />
          ) : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            disabled={loading}
            onPress={onLogin}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkPrompt}>Don&apos;t have an account? </Text>
            <Text
              style={styles.link}
              onPress={() => router.push('/auth/patient-register')}
            >
              Sign up
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },

  /* Top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  systemLogoSlot: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  systemLogo: {
    width: '100%',
    height: '100%',
  },
  systemName: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  gearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },

  /* Tenant chip */
  tenantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 200, 150, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 150, 0.22)',
    borderRadius: theme.radius.pill,
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    gap: 7,
    marginBottom: 14,
  },
  tenantChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.accentTeal,
    letterSpacing: 1,
  },

  /* Hero */
  headline: {
    color: theme.colors.textPrimary,
    fontSize: 38,
    fontWeight: '700',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },

  /* Feature chips */
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 20,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    color: theme.colors.textSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },

  /* Role toggle */
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 3,
    marginBottom: 20,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: theme.radius.md - 2,
  },
  roleTabActive: {
    backgroundColor: theme.colors.accentTeal,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
  },
  roleTabTextActive: {
    color: '#022018',
  },

  /* Form card */
  formCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
    marginBottom: theme.spacing.md,
    fontSize: 15,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: theme.spacing.sm,
  },
  forgotText: {
    color: theme.colors.accentTeal,
    fontSize: 12,
    fontWeight: '600',
  },

  /* Biometric toggle */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  checkboxOn: {
    backgroundColor: theme.colors.accentTeal,
    borderColor: theme.colors.accentTeal,
  },
  toggleText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },

  /* CTA */
  button: {
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#022018',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  /* Links */
  linkRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  linkPrompt: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  link: {
    color: theme.colors.accentBlue,
    fontSize: 13,
    fontWeight: '600',
  },
});
