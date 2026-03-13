import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';

const REQUIRE_BIOMETRIC =
  String(process.env.EXPO_PUBLIC_REQUIRE_BIOMETRIC_UNLOCK || 'true').toLowerCase() !== 'false';

export async function canUseBiometricUnlock(): Promise<boolean> {
  if (!REQUIRE_BIOMETRIC) return false;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function promptBiometricUnlock(): Promise<boolean> {
  const supported = await canUseBiometricUnlock();
  if (!supported) return true;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock MediCore',
    fallbackLabel: 'Use device passcode',
    disableDeviceFallback: false
  });

  return Boolean(result.success);
}

export async function enforcePhiScreenProtection(enabled: boolean): Promise<void> {
  if (enabled) {
    await ScreenCapture.preventScreenCaptureAsync();
    return;
  }
  await ScreenCapture.allowScreenCaptureAsync();
}
