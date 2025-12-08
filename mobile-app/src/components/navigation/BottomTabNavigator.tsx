import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from '../shared/Icon';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';

interface TabItem {
  name: string;
  label: string;
  icon: string;
  route: string;
}

const tabs: TabItem[] = [
  { name: 'Dashboard', label: 'Dashboard', icon: 'home', route: 'DoctorDashboard' },
  { name: 'Schedule', label: 'Schedule', icon: 'calendar', route: 'Schedule' },
  { name: 'Patients', label: 'Patients', icon: 'patients', route: 'PatientSearch' },
  { name: 'Messages', label: 'Messages', icon: 'messages', route: 'ProviderMessaging' },
  { name: 'More', label: 'More', icon: 'more', route: 'More' },
];

const BottomTabNavigator: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const isActive = (tabRoute: string) => {
    return route.name === tabRoute;
  };

  const handlePress = (tab: TabItem) => {
    if (tab.route && !isActive(tab.route)) {
      navigation.navigate(tab.route as never);
    }
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = isActive(tab.route);
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab)}
            activeOpacity={0.7}
          >
            <View style={[styles.tabIconContainer, active && styles.tabIconContainerActive]}>
              <Icon name={tab.icon} size={24} color={active ? colors.primary : colors.textTertiary} />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
    ...shadows.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tabIconContainerActive: {
    backgroundColor: colors.primary + '20',
  },
  tabLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 10,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default BottomTabNavigator;

