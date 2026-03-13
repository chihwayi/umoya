import React from 'react';
import { Tabs } from 'expo-router';
import { theme } from '../../design/theme';
import { LogoutButton } from '../../features/shared/ui/LogoutButton';

export default function DoctorTabsLayout() {
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
      <Tabs.Screen name="rounds" options={{ title: 'Rounds' }} />
      <Tabs.Screen name="postvisit" options={{ title: 'PostVisit' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="ai-assist" options={{ title: 'AI Assist' }} />
    </Tabs>
  );
}
