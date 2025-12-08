import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Nurse Screens
import NurseDashboard from '../screens/nurse/NurseDashboard';
import VitalsScreen from '../screens/nurse/VitalsScreen';
import MARScreen from '../screens/nurse/MARScreen';
import ProviderMessagingScreen from '../screens/provider/ProviderMessagingScreen';

// Shared Screens
import PatientSearchScreen from '../screens/doctor/PatientSearchScreen';
import PatientDetailScreen from '../screens/doctor/PatientDetailScreen';
import ScheduleScreen from '../screens/doctor/ScheduleScreen';
import CreateAppointmentScreen from '../screens/doctor/CreateAppointmentScreen';
import FinanceDashboard from '../screens/finance/FinanceDashboard';
import MoreScreen from '../screens/shared/MoreScreen';
import ComposeMessageScreen from '../screens/shared/ComposeMessageScreen';
import MessageThreadScreen from '../screens/shared/MessageThreadScreen';

const Stack = createStackNavigator();

const NurseNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="NurseDashboard"
        component={NurseDashboard}
      />
      <Stack.Screen
        name="Vitals"
        component={VitalsScreen}
      />
      <Stack.Screen
        name="MAR"
        component={MARScreen}
      />
      <Stack.Screen
        name="Schedule"
        component={ScheduleScreen}
      />
      <Stack.Screen
        name="PatientSearch"
        component={PatientSearchScreen}
      />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
      />
      <Stack.Screen
        name="CreateAppointment"
        component={CreateAppointmentScreen}
      />
      <Stack.Screen
        name="FinanceDashboard"
        component={FinanceDashboard}
      />
      <Stack.Screen
        name="ProviderMessaging"
        component={ProviderMessagingScreen}
      />
      <Stack.Screen
        name="ComposeMessage"
        component={ComposeMessageScreen}
      />
      <Stack.Screen
        name="MessageThread"
        component={MessageThreadScreen}
      />
      <Stack.Screen
        name="More"
        component={MoreScreen}
      />
    </Stack.Navigator>
  );
};

export default NurseNavigator;

