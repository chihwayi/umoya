import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import {
  useFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { DefaultTheme } from '@react-navigation/native';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/useAuthStore';
import { buildApiClient } from './src/services/api';
import { C, FONT } from './src/design/tokens';
import { useAppPrivacyState, useInactivityLock, audit, suspectCompromisedEnvironment } from './src/utils/security';

// Keep splash visible until fonts + auth are ready
SplashScreen.preventAutoHideAsync();

const NAVIGATION_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary:      C.teal,
    background:   C.bg,
    card:         C.surface,
    text:         C.textPrimary,
    border:       C.border,
    notification: C.red,
  },
};

export default function App() {
  const { hydrate, tenant, isLoading, clearTenant } = useAuthStore();
  const { isPrivate } = useAppPrivacyState();

  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  // Lock session after 5 min of inactivity — force re-login
  const handleInactivityLock = useCallback(() => {
    audit('SESSION_LOCK', { detail: 'inactivity_timeout_5min' });
    clearTenant(); // returns to TenantSelect / Login flow
  }, [clearTenant]);
  useInactivityLock(handleInactivityLock);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(C.bg);
  }, []);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (suspectCompromisedEnvironment()) {
      audit('SESSION_LOCK', { detail: 'compromised_environment_detected' });
      // In a production build, show a blocking modal here.
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      if (tenant?.baseUrl) {
        buildApiClient(tenant.baseUrl);
      }
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading, tenant]);

  if (!fontsLoaded || isLoading) {
    return <View style={styles.splash} />;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <NavigationContainer theme={NAVIGATION_THEME}>
          <RootNavigator />
        </NavigationContainer>

        {/* HIPAA screen privacy overlay — covers app-switcher snapshot & screen record */}
        {isPrivate && (
          <View style={styles.privacyOverlay} accessibilityElementsHidden>
            <View style={styles.privacyContent}>
              <View style={styles.privacyLock}>
                <Text style={styles.privacyLockIcon}>🔒</Text>
              </View>
              <Text style={styles.privacyTitle}>MediCore Clinical</Text>
              <Text style={styles.privacySubtitle}>Screen hidden for patient privacy</Text>
            </View>
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, backgroundColor: C.bg },

  // Privacy overlay — full-screen opaque cover shown in app switcher
  privacyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030B18',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  privacyContent: {
    alignItems: 'center',
    gap: 12,
  },
  privacyLock: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.teal + '22',
    borderWidth: 1.5,
    borderColor: C.teal + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  privacyLockIcon:   { fontSize: 30 },
  privacyTitle:      { fontFamily: FONT.uiBk, fontSize: 20, color: C.text, letterSpacing: -0.3 },
  privacySubtitle:   { fontFamily: FONT.ui,   fontSize: 13, color: C.textMuted },
});
