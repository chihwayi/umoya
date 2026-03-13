import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from '../auth/types';

const BIOMETRIC_LOGIN_KEY = 'biometric_login_profile';

type BiometricLoginProfile = {
  enabled: boolean;
  role: AuthSession['role'];
  email: string;
  updatedAt: string;
};

let memoryFallback: string | null = null;

function resolveBiometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }
  return 'Biometric';
}

async function getStoredProfile(): Promise<BiometricLoginProfile | null> {
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_LOGIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BiometricLoginProfile;
  } catch {
    if (!memoryFallback) return null;
    return JSON.parse(memoryFallback) as BiometricLoginProfile;
  }
}

async function setStoredProfile(profile: BiometricLoginProfile): Promise<void> {
  const raw = JSON.stringify(profile);
  try {
    await SecureStore.setItemAsync(BIOMETRIC_LOGIN_KEY, raw);
  } catch {
    memoryFallback = raw;
  }
}

export async function clearBiometricLoginProfile(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_LOGIN_KEY);
  } catch {
    memoryFallback = null;
  }
}

export async function getBiometricLoginProfile(): Promise<BiometricLoginProfile | null> {
  return getStoredProfile();
}

export async function getBiometricSupport(): Promise<{
  supported: boolean;
  label: string;
}> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { supported: false, label: 'Biometric' };
  }

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    return { supported: false, label: 'Biometric' };
  }

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return {
    supported: true,
    label: resolveBiometricLabel(types)
  };
}

export async function setBiometricLoginPreference(
  session: AuthSession,
  enabled: boolean
): Promise<void> {
  if (!enabled) {
    await clearBiometricLoginProfile();
    return;
  }

  await setStoredProfile({
    enabled: true,
    role: session.role,
    email: session.email,
    updatedAt: new Date().toISOString()
  });
}

export async function isBiometricLoginEnabledForSession(session: AuthSession): Promise<boolean> {
  const profile = await getStoredProfile();
  if (!profile?.enabled) return false;
  return profile.role === session.role && profile.email === session.email;
}

export async function authenticateBiometricLogin(promptTitle?: string): Promise<boolean> {
  const support = await getBiometricSupport();
  if (!support.supported) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: promptTitle || 'Authenticate to sign in',
    fallbackLabel: 'Use device passcode',
    disableDeviceFallback: false
  });

  return Boolean(result.success);
}
