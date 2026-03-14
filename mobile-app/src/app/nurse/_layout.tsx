import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../../design/theme';
import { HeaderActions } from '../../features/shared/ui/HeaderActions';
import { AppHeaderLeft } from '../../features/shared/ui/AppHeaderLeft';
import { useProviderUnreadCount } from '../../features/provider/hooks/useProviderMessaging';

const tabIcon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} size={size} color={color} />;

function useMessageBadge(): number | string | undefined {
  const { data } = useProviderUnreadCount();
  const count = data?.count ?? 0;
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : count;
}

export default function NurseTabsLayout() {
  const messageBadge = useMessageBadge();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.textPrimary,
        headerTitle: '',
        headerLeft: () => <AppHeaderLeft />,
        headerRight: () => <HeaderActions />,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.accentTeal,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="shift"
        options={{
          title: 'Shift',
          tabBarIcon: tabIcon('list-outline'),
        }}
      />
      <Tabs.Screen
        name="vitals"
        options={{
          title: 'Vitals',
          tabBarIcon: tabIcon('pulse-outline'),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: tabIcon('chatbubbles-outline'),
          tabBarBadge: messageBadge,
        }}
      />
    </Tabs>
  );
}
