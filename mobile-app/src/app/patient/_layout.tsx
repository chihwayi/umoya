import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../../design/theme';
import { HeaderActions } from '../../features/shared/ui/HeaderActions';
import { AppHeaderLeft } from '../../features/shared/ui/AppHeaderLeft';

const tabIcon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} size={size} color={color} />;

export default function PatientTabsLayout() {
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
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home-outline'),
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
        name="medications"
        options={{
          title: 'Medications',
          tabBarIcon: tabIcon('medkit-outline'),
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: 'Bills',
          tabBarIcon: tabIcon('receipt-outline'),
        }}
      />
      <Tabs.Screen
        name="my-health"
        options={{
          title: 'My Health',
          tabBarIcon: tabIcon('heart-outline'),
        }}
      />
    </Tabs>
  );
}
