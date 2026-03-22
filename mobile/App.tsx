import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
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
import { C } from './src/design/tokens';

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
  const { hydrate, tenant, isLoading } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(C.bg);
  }, []);

  useEffect(() => {
    hydrate();
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, backgroundColor: C.bg },
});
