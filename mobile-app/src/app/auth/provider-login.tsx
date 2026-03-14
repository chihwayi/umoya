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
import { providerLogin } from '../../services/api/ehr';
import { saveSession } from '../../lib/auth/auth-service';
import { routeForRole } from '../../lib/auth/routing';
import type { AuthSession } from '../../lib/auth/types';
import { registerDevicePushToken } from '../../lib/notifications/push-service';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';
import { getBiometricSupport, setBiometricLoginPreference } from '../../lib/security/biometric-login';
import { getTenantBootstrap } from '../../lib/tenant/tenant-resolver';

type LoginRole = 'patient' | 'provider';

export default function ProviderLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [useBiometric, setUseBiometric] = useState(true);
  const [activeRole, setActiveRole] = useState<LoginRole>('provider');

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
    if (role === 'patient') {
      router.replace('/auth/patient-login');
    }
  }

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
      const role: AuthSession['role'] =
        roleValue === 'nurse' || roleValue === 'nurse_accounts' ? 'nurse' : roleValue === 'doctor' ? 'doctor' : 'doctor';
      const session = {
        role,
        accessToken: response.token,
        userId: response.user.id,
        email: response.user.email,
      };

      await saveSession(session);
      await setBiometricLoginPreference(
        { ...session, role },
        biometricSupported && useBiometric
      );
      trackMobileEvent('auth.biometric.preference_set', {
        role,
        enabled: biometricSupported && useBiometric,
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
        status: err?.response?.status || 0,
      });
      setError(err?.response?.data?.message || err?.message || 'Provider login failed');
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
        {/* ── Top bar: MediCore brand (prominent) ── */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.systemLogoSlot}>
              <Image
                source={require('../../../assets/medicore.png')}
                style={styles.systemLogo}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.systemName}>MediCore</Text>
          </View>
        </View>

        {/* ── Tenant logo (original hero style) ── */}
        <View style={styles.tenantHero}>
          <TenantLogoSlot size={84} showName stacked showSystemMark={false} />
        </View>

        {/* ── Section title (centered) ── */}
        <View style={styles.headlineBlock}>
          <Text style={styles.headline}>Provider login</Text>
          <Text style={styles.subtitle}>
            Doctor and nurse access for coordinated live care workflows.
          </Text>
        </View>

        {/* ── Feature chips ── */}
        <View style={styles.chipsRow}>
          {['CDSS', 'POSTVISIT AI', 'FHIR READY'].map((c) => (
            <Text key={c} style={styles.chip}>
              {c}
            </Text>
          ))}
        </View>

        {/* ── Patient / Provider toggle (so user can switch back) ── */}
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
    width: 32,
    height: 32,
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
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tenantHero: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headlineBlock: {
    alignItems: 'center',
    marginBottom: 14,
  },
  headline: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 0,
  },
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
});
