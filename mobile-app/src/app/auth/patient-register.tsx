import React, { useState } from 'react';
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
import { patientRegister } from '../../services/api/ehr';
import { trackMobileEvent } from '../../lib/observability/mobile-metrics';
import { getTenantBootstrap } from '../../lib/tenant/tenant-resolver';

function validateDob(value: string): boolean {
  const re = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!re.test(value)) return false;
  const [, d, m, y] = value.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1 && date.getFullYear() === y;
}

export default function PatientRegisterScreen() {
  const [patientNumber, setPatientNumber] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenant = getTenantBootstrap();

  if (!tenant) {
    router.replace('/clinic/select');
    return null;
  }

  async function onRegister() {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!validateDob(dob)) {
      setError('Enter date of birth as DD/MM/YYYY.');
      return;
    }
    if (!patientNumber.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in patient number, email, and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      trackMobileEvent('auth.register.started', { role: 'patient' });

      await patientRegister({
        patientNumber: patientNumber.trim(),
        dateOfBirth: dob.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
      });

      trackMobileEvent('auth.register.success', { role: 'patient' });
      router.replace('/auth/patient-login');
    } catch (err: any) {
      trackMobileEvent('auth.register.failed', {
        role: 'patient',
        code: err?.code || 'unknown',
        status: err?.response?.status || 0,
      });
      setError(err?.response?.data?.message || err?.message || 'Registration failed');
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
          <Text style={styles.headline}>Create account</Text>
          <Text style={styles.subtitle}>
            Register using your clinic details to access your patient portal.
          </Text>
        </View>

        {/* ── SECTION 1: Identity ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>IDENTITY</Text>
        </View>
        <View style={styles.formGroup}>
          <View style={styles.field}>
            <Text style={styles.inputLabel}>PATIENT NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="From your clinic card or letter"
              placeholderTextColor={theme.colors.textMuted}
              value={patientNumber}
              onChangeText={setPatientNumber}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldDivider} />

          <View style={styles.field}>
            <Text style={styles.inputLabel}>DATE OF BIRTH</Text>
            <TextInput
              style={styles.input}
              placeholder="DD / MM / YYYY"
              placeholderTextColor={theme.colors.textMuted}
              value={dob}
              onChangeText={setDob}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* ── SECTION 2: Contact ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>CONTACT</Text>
        </View>
        <View style={styles.formGroup}>
          <View style={styles.field}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.fieldDivider} />

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>PHONE</Text>
              <Text style={styles.optionalTag}>optional</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="+263..."
              placeholderTextColor={theme.colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* ── SECTION 3: Security ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>SECURITY</Text>
        </View>
        <View style={styles.formGroup}>
          <View style={styles.field}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputWithAction]}
                placeholder="At least 8 characters"
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable
                style={styles.inputAction}
                onPress={() => setShowPassword((v) => !v)}
              >
                <Text style={styles.inputActionText}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldDivider} />

          <View style={styles.field}>
            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputWithAction,
                  confirmPassword.length > 0 &&
                    confirmPassword !== password &&
                    styles.inputError,
                ]}
                placeholder="Re-enter password"
                placeholderTextColor={theme.colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable
                style={styles.inputAction}
                onPress={() => setShowPassword((v) => !v)}
              >
                <Text style={styles.inputActionText}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </Pressable>
            </View>
            {confirmPassword.length > 0 && confirmPassword !== password ? (
              <Text style={styles.fieldError}>Passwords don&apos;t match</Text>
            ) : null}
          </View>
        </View>

        {/* ── Password strength hint ── */}
        {password.length > 0 ? (
          <View style={styles.strengthRow}>
            <View
              style={[
                styles.strengthBar,
                password.length >= 8 && styles.strengthBarMed,
                password.length >= 12 && styles.strengthBarStrong,
              ]}
            />
            <Text style={styles.strengthLabel}>
              {password.length < 8
                ? 'Too short'
                : password.length < 12
                  ? 'Good'
                  : 'Strong'}
            </Text>
          </View>
        ) : null}

        {/* ── Error ── */}
        {error ? (
          <StatePanel
            state="error"
            title="Registration failed"
            message={error}
          />
        ) : null}

        {/* ── CTA ── */}
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={onRegister}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Text>
        </Pressable>

        {/* ── Sign in link ── */}
        <View style={styles.linkRow}>
          <Text style={styles.linkPrompt}>Already have an account? </Text>
          <Text
            style={styles.link}
            onPress={() => router.replace('/auth/patient-login')}
          >
            Sign in
          </Text>
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
    marginBottom: 24,
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

  /* Section headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accentTeal,
    opacity: 0.7,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  /* Form groups */
  formGroup: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 20,
  },
  field: {
    gap: 6,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
    marginVertical: 14,
  },

  /* Labels */
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  optionalTag: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },

  /* Inputs */
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
    fontSize: 15,
  },
  inputError: {
    borderColor: theme.colors.accentRed ?? '#e24b4a',
  },
  fieldError: {
    color: theme.colors.accentRed ?? '#e24b4a',
    fontSize: 11,
    marginTop: 4,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWithAction: {
    paddingRight: 64,
  },
  inputAction: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inputActionText: {
    color: theme.colors.accentTeal,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* Password strength */
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -12,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,80,80,0.4)',
  },
  strengthBarMed: {
    backgroundColor: 'rgba(255,180,0,0.6)',
  },
  strengthBarStrong: {
    backgroundColor: 'rgba(0,200,150,0.7)',
  },
  strengthLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'right',
  },

  /* CTA */
  button: {
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: theme.spacing.md,
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
