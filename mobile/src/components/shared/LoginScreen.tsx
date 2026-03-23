import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, Animated, Image,
} from 'react-native';

const MEDICORE_LOGO = require('../../../assets/icon.png');
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge } from '../ui';
import { useAuthStore, UserRole } from '../../stores/useAuthStore';
import { api } from '../../services/api';

type LoginMode = 'staff' | 'patient_otp' | 'patient_pin';

interface LoginScreenProps {
  onLoggedIn: () => void;
  onChangeTenant: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoggedIn,
  onChangeTenant,
}) => {
  const insets = useSafeAreaInsets();
  const { tenant, login } = useAuthStore();

  const [role, setRole] = useState<UserRole>('doctor');
  const [mode, setMode] = useState<LoginMode>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Detect what biometric hardware is available
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) return;
      setBiometricAvailable(true);
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('fingerprint');
      }
    })();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleRoleChange = (r: UserRole) => {
    setRole(r);
    setMode(r === 'patient' ? 'patient_otp' : 'staff');
    setEmail(''); setPassword(''); setPhone(''); setOtp(''); setPin('');
    setOtpSent(false);
  };

  // ── Staff login (Doctor / Nurse) ──────────────────────────────────────────
  const loginStaff = async () => {
    if (!email.trim() || !password.trim()) { shake(); return; }
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      await login(res.data.token, role, { ...res.data.user, role });
      onLoggedIn();
    } catch (err: any) {
      shake();
      Alert.alert('Login failed', err?.response?.data?.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // ── Patient — request OTP ─────────────────────────────────────────────────
  const requestOtp = async () => {
    if (!phone.trim()) { shake(); return; }
    setLoading(true);
    try {
      const res = await api.post<{ otpToken: string }>('/auth/patient/otp-request', {
        phone: phone.trim(),
      });
      setOtpToken(res.data.otpToken);
      setOtpSent(true);
    } catch (err: any) {
      shake();
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Patient — verify OTP ──────────────────────────────────────────────────
  const verifyOtp = async () => {
    if (otp.length < 4) { shake(); return; }
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>('/auth/patient/otp-verify', {
        otpToken,
        otp: otp.trim(),
      });
      await login(res.data.token, 'patient', { ...res.data.user, role: 'patient' });
      onLoggedIn();
    } catch (err: any) {
      shake();
      Alert.alert('Invalid OTP', err?.response?.data?.message ?? 'Incorrect code');
    } finally {
      setLoading(false);
    }
  };

  // ── Biometric unlock (all roles — requires a stored JWT from prior login) ──
  const biometricLogin = async () => {
    const { jwt } = useAuthStore.getState();
    if (!jwt) {
      Alert.alert(
        'Sign in first',
        'Use your credentials once to enable biometric unlock.',
      );
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock ${tenant?.name ?? 'MediCore'}`,
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (result.success) {
      onLoggedIn();
    } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
      Alert.alert('Authentication failed', 'Please sign in with your password.');
    }
  };

  const biometricLabel = biometricType === 'face'
    ? 'Face ID'
    : biometricType === 'fingerprint'
    ? 'Fingerprint'
    : 'Biometric';

  const ROLES: { key: UserRole; label: string; emoji: string }[] = [
    { key: 'doctor', label: 'Doctor', emoji: '👨‍⚕️' },
    { key: 'nurse',  label: 'Nurse',  emoji: '👩‍⚕️' },
    { key: 'patient',label: 'Patient',emoji: '🧑'   },
  ];

  const accentByRole: Record<UserRole, string> = {
    doctor: C.teal, nurse: C.purple, patient: C.blue,
  };
  const accent = accentByRole[role];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#030B18', C.bg]}
        style={[styles.flex, { paddingTop: insets.top }]}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Clinic branding */}
          <View style={styles.clinicRow}>
            <View style={[styles.clinicLogo, { borderColor: accent + '44' }]}>
              <Image source={MEDICORE_LOGO} style={styles.clinicLogoImg} resizeMode="cover" />
            </View>
            <View style={styles.clinicText}>
              <Text style={styles.clinicName}>{tenant?.name ?? 'MediCore'}</Text>
              <Text style={styles.clinicSlug}>{tenant?.slug}</Text>
            </View>
          </View>

          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to continue</Text>

          {/* Role picker */}
          <View style={styles.rolePicker}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.key}
                onPress={() => handleRoleChange(r.key)}
                activeOpacity={0.75}
                style={[
                  styles.roleTab,
                  role === r.key && { backgroundColor: accent, borderColor: accent },
                ]}
              >
                <Text style={styles.roleEmoji}>{r.emoji}</Text>
                <Text style={[styles.roleLabel, role === r.key && { color: '#000' }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            {(role === 'doctor' || role === 'nurse') && (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View style={[styles.inputBox, { borderColor: email ? accent + '60' : C.border }]}>
                    <Icon name="inbox" size={16} color={C.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor={C.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={[styles.inputBox, { borderColor: password ? accent + '60' : C.border }]}>
                    <Icon name="shield" size={16} color={C.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={C.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPw}
                    />
                    <TouchableOpacity onPress={() => setShowPw(p => !p)}>
                      <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} color={C.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={loginStaff}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[accent, C.blue]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  >
                    {loading
                      ? <ActivityIndicator color="#000" />
                      : <Text style={styles.btnText}>Sign In</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                {biometricAvailable && (
                  <TouchableOpacity
                    style={styles.bioBtn}
                    onPress={biometricLogin}
                    activeOpacity={0.8}
                  >
                    <Icon name="shield" size={18} color={accent} />
                    <Text style={[styles.bioBtnText, { color: accent }]}>
                      Unlock with {biometricLabel}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {role === 'patient' && !otpSent && (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Mobile Number</Text>
                  <View style={[styles.inputBox, { borderColor: phone ? C.blue + '60' : C.border }]}>
                    <Icon name="phone" size={16} color={C.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="+263 77 123 4567"
                      placeholderTextColor={C.textMuted}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={requestOtp}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[C.blue, C.teal]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  >
                    {loading
                      ? <ActivityIndicator color="#000" />
                      : <Text style={styles.btnText}>Send OTP</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {role === 'patient' && otpSent && (
              <View style={styles.form}>
                <View style={styles.otpInfo}>
                  <Icon name="check" size={14} color={C.teal} strokeWidth={2.5} />
                  <Text style={styles.otpInfoText}>Code sent to {phone}</Text>
                  <TouchableOpacity onPress={() => setOtpSent(false)}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>One-Time Code</Text>
                  <View style={[styles.inputBox, { borderColor: otp ? C.blue + '60' : C.border }]}>
                    <Icon name="shield" size={16} color={C.textMuted} />
                    <TextInput
                      style={[styles.input, styles.monoInput]}
                      placeholder="· · · · · ·"
                      placeholderTextColor={C.textMuted}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={verifyOtp}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[C.blue, C.teal]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  >
                    {loading
                      ? <ActivityIndicator color="#000" />
                      : <Text style={styles.btnText}>Verify & Sign In</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                {biometricAvailable && (
                  <TouchableOpacity
                    style={styles.bioBtn}
                    onPress={biometricLogin}
                    activeOpacity={0.8}
                  >
                    <Icon name="shield" size={18} color={C.blue} />
                    <Text style={[styles.bioBtnText, { color: C.blue }]}>
                      Unlock with {biometricLabel}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>

          {/* Change clinic */}
          <TouchableOpacity onPress={onChangeTenant} style={styles.changeClinic}>
            <Text style={styles.changeClinicText}>Not your clinic? Change →</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  clinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
    backgroundColor: C.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  clinicLogo: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicLogoImg: { width: 48, height: 48, borderRadius: 10 },
  clinicText: { flex: 1 },
  clinicName: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary },
  clinicSlug: { fontFamily: FONT.mono, fontSize: 11, color: C.textMuted, marginTop: 2 },
  headline: {
    fontFamily: FONT.uiBk,
    fontSize: 30,
    color: C.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sub: { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary, marginBottom: 24 },
  rolePicker: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
    gap: 4,
    marginBottom: 24,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleEmoji: { fontSize: 14 },
  roleLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: C.textMuted },
  form: { gap: 16 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FONT.uiSb, fontSize: 11, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    height: 52,
  },
  input: { flex: 1, fontFamily: FONT.ui, fontSize: 15, color: C.textPrimary, height: 52 },
  monoInput: { fontFamily: FONT.monoBd, letterSpacing: 4, fontSize: 18 },
  primaryBtn: { marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnGradient: {
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#000', letterSpacing: 0.2 },
  otpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.teal + '12',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.teal + '30',
  },
  otpInfoText: { fontFamily: FONT.uiSb, fontSize: 12, color: C.textSecondary, flex: 1 },
  changeLink: { fontFamily: FONT.uiBd, fontSize: 12, color: C.teal },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.teal + '40',
    backgroundColor: C.teal + '0A',
    marginTop: 4,
  },
  bioBtnText: { fontFamily: FONT.uiSb, fontSize: 13, color: C.teal },
  changeClinic: { alignItems: 'center', marginTop: 32 },
  changeClinicText: { fontFamily: FONT.uiSb, fontSize: 12, color: C.textMuted },
});
