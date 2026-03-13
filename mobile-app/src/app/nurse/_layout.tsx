import React from 'react';
import { Tabs } from 'expo-router';
import { theme } from '../../design/theme';
import { LogoutButton } from '../../features/shared/ui/LogoutButton';

export default function NurseTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.textPrimary,
        headerRight: () => <LogoutButton />,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.accentTeal,
        tabBarInactiveTintColor: theme.colors.textMuted
      }}
    >
      <Tabs.Screen name="shift" options={{ title: 'Shift' }} />
      <Tabs.Screen name="vitals" options={{ title: 'Vitals' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
    </Tabs>
  );
}
