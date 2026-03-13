import React from 'react';
import { Tabs } from 'expo-router';
import { theme } from '../../design/theme';
import { LogoutButton } from '../../features/shared/ui/LogoutButton';

export default function PatientTabsLayout() {
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
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="postvisit" options={{ title: 'PostVisit' }} />
      <Tabs.Screen name="medications" options={{ title: 'Medications' }} />
      <Tabs.Screen name="bills" options={{ title: 'Bills' }} />
      <Tabs.Screen name="my-health" options={{ title: 'My Health' }} />
    </Tabs>
  );
}
