import React from 'react';
import { Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens
import PatientDashboard from '../screens/patient/PatientDashboard';
import AppointmentsScreen from '../screens/patient/AppointmentsScreen';
import PrescriptionsScreen from '../screens/patient/PrescriptionsScreen';
import LabResultsScreen from '../screens/patient/LabResultsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const PatientTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={PatientDashboard}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          tabBarLabel: 'Appointments',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text>,
        }}
      />
      <Tab.Screen
        name="Prescriptions"
        component={PrescriptionsScreen}
        options={{
          tabBarLabel: 'Prescriptions',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>💊</Text>,
        }}
      />
      <Tab.Screen
        name="LabResults"
        component={LabResultsScreen}
        options={{
          tabBarLabel: 'Lab Results',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔬</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

const PatientNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PatientTabs" component={PatientTabs} />
      {/* Additional screens can be added here as Stack screens */}
    </Stack.Navigator>
  );
};

export default PatientNavigator;

