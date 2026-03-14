import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../../design/theme';
import { HeaderActions } from '../../features/shared/ui/HeaderActions';
import { AppHeaderLeft } from '../../features/shared/ui/AppHeaderLeft';

const tabIcon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} size={size} color={color} />;

export default function DoctorTabsLayout() {
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
        name="rounds"
        options={{
          title: 'Rounds',
          tabBarIcon: tabIcon('bed-outline'),
        }}
      />
      <Tabs.Screen
        name="postvisit"
        options={{
          title: 'PostVisit',
          tabBarIcon: tabIcon('sparkles-outline'),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: tabIcon('mail-outline'),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: tabIcon('chatbubbles-outline'),
        }}
      />
      <Tabs.Screen
        name="ai-assist"
        options={{
          title: 'AI Assist',
          tabBarIcon: tabIcon('sparkles'),
        }}
      />
    </Tabs>
  );
}
