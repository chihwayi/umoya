import React from 'react';
import { Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography } from '../theme/designSystem';

// Patient Screens
import PatientDashboard from '../screens/patient/PatientDashboard';
import AppointmentsScreen from '../screens/patient/AppointmentsScreen';
import PrescriptionsScreen from '../screens/patient/PrescriptionsScreen';
import LabResultsScreen from '../screens/patient/LabResultsScreen';
import MedicalRecordsScreen from '../screens/patient/MedicalRecordsScreen';
import MedicalRecordDetailScreen from '../screens/patient/MedicalRecordDetailScreen';
import DocumentsScreen from '../screens/patient/DocumentsScreen';
import DocumentViewerScreen from '../screens/patient/DocumentViewerScreen';
import BillingScreen from '../screens/patient/BillingScreen';
import PaymentScreen from '../screens/patient/PaymentScreen';
import PaymentHistoryScreen from '../screens/patient/PaymentHistoryScreen';
import PaymentStatusScreen from '../screens/patient/PaymentStatusScreen';
import TelemedicineScreen from '../screens/patient/TelemedicineScreen';
import VideoCallScreen from '../screens/patient/VideoCallScreen';
import PatientMessagingScreen from '../screens/patient/PatientMessagingScreen';

// Shared Screens
import ComposeMessageScreen from '../screens/shared/ComposeMessageScreen';
import MessageThreadScreen from '../screens/shared/MessageThreadScreen';
import MoreScreen from '../screens/shared/MoreScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const PatientTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.backgroundSecondary,
          borderTopWidth: 1,
          borderTopColor: colors.glassBorder,
        },
        tabBarLabelStyle: {
          ...typography.bodySmall,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={PatientDashboard}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          tabBarLabel: 'Appointments',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📅</Text>,
        }}
      />
      <Tab.Screen
        name="Prescriptions"
        component={PrescriptionsScreen}
        options={{
          tabBarLabel: 'Prescriptions',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💊</Text>,
        }}
      />
      <Tab.Screen
        name="LabResults"
        component={LabResultsScreen}
        options={{
          tabBarLabel: 'Lab Results',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔬</Text>,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⋯</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

const PatientNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PatientTabs" component={PatientTabs} />
      <Stack.Screen name="MedicalRecords" component={MedicalRecordsScreen} />
      <Stack.Screen name="MedicalRecordDetail" component={MedicalRecordDetailScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} />
      <Stack.Screen name="Billing" component={BillingScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <Stack.Screen name="PaymentStatus" component={PaymentStatusScreen} />
      <Stack.Screen name="Telemedicine" component={TelemedicineScreen} />
      <Stack.Screen name="VideoCall" component={VideoCallScreen} />
      <Stack.Screen name="PatientMessaging" component={PatientMessagingScreen} />
      <Stack.Screen name="ComposeMessage" component={ComposeMessageScreen} />
      <Stack.Screen name="MessageThread" component={MessageThreadScreen} />
      <Stack.Screen name="More" component={MoreScreen} />
    </Stack.Navigator>
  );
};

export default PatientNavigator;
