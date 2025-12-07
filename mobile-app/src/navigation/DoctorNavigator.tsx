import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Screens
import DoctorDashboard from '../screens/doctor/DoctorDashboard';
import PatientSearchScreen from '../screens/doctor/PatientSearchScreen';
import PatientDetailScreen from '../screens/doctor/PatientDetailScreen';
import ScheduleScreen from '../screens/doctor/ScheduleScreen';
import CreatePrescriptionScreen from '../screens/doctor/CreatePrescriptionScreen';

const Stack = createStackNavigator();

const DoctorNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="DoctorDashboard"
        component={DoctorDashboard}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ title: "Today's Schedule" }}
      />
      <Stack.Screen
        name="PatientSearch"
        component={PatientSearchScreen}
        options={{ title: 'Search Patients' }}
      />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetailScreen}
        options={{ title: 'Patient Details' }}
      />
      <Stack.Screen
        name="CreatePrescription"
        component={CreatePrescriptionScreen}
        options={{ title: 'New Prescription' }}
      />
    </Stack.Navigator>
  );
};

export default DoctorNavigator;

