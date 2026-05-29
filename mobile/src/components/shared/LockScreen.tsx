import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS } from '../../design/tokens';
import { Icon } from '../ui';
import { useAuthStore } from '../../stores/useAuthStore';

interface LockScreenProps {
  onUnlocked: () => void;
  onSignOut: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlocked, onSignOut }) => {
  const insets = useSafeAreaInsets();
  const { tenant } = useAuthStore();

  const attemptBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!compatible || !enrolled) {
      onSignOut();
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock ${tenant?.name ?? 'Umoya'}`,
      fallbackLabel: 'Use password',
      cancelLabel: 'Sign out',
      disableDeviceFallback: false,
    });

    if (result.success) {
      onUnlocked();
    } else if (result.error === 'user_cancel' || result.error === 'system_cancel') {
      onSignOut();
    } else {
      Alert.alert('Authentication failed', 'Tap the button to try again.');
    }
  };

  useEffect(() => {
    attemptBiometric();
  }, []);

  return (
    <LinearGradient colors={['#030B18', C.bg]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <View style={styles.iconRing}>
          <Icon name="shield" size={40} color={C.teal} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.sub}>{tenant?.name ?? 'Umoya'}</Text>

        <TouchableOpacity style={styles.unlockBtn} onPress={attemptBiometric} activeOpacity={0.8}>
          <LinearGradient
            colors={[C.teal, C.blue]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            <Icon name="shield" size={18} color="#000" />
            <Text style={styles.btnText}>Unlock with Biometrics</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSignOut} style={styles.signOutLink}>
          <Text style={styles.signOutText}>Sign out instead</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  inner: { alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.teal + '18',
    borderWidth: 1.5,
    borderColor: C.teal + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontFamily: FONT.uiBk, fontSize: 28, color: C.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: FONT.ui, fontSize: 14, color: C.textSecondary },
  unlockBtn: { width: '100%', marginTop: 16 },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: RADIUS.md,
  },
  btnText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#000' },
  signOutLink: { marginTop: 8, paddingVertical: 12 },
  signOutText: { fontFamily: FONT.uiSb, fontSize: 13, color: C.textMuted },
});
