import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Doctor Screens
import DoctorDashboard from '../screens/doctor/DoctorDashboard';
import PatientSearchScreen from '../screens/doctor/PatientSearchScreen';
import PatientDetailScreen from '../screens/doctor/PatientDetailScreen';
import ScheduleScreen from '../screens/doctor/ScheduleScreen';
import PrescribeScreen from '../screens/doctor/PrescribeScreen';
import CreatePrescriptionScreen from '../screens/doctor/CreatePrescriptionScreen';
import CreateAppointmentScreen from '../screens/doctor/CreateAppointmentScreen';
import LabOrderScreen from '../screens/doctor/LabOrderScreen';
import ClinicalNotesScreen from '../screens/doctor/ClinicalNotesScreen';
import ProblemListScreen from '../screens/doctor/ProblemListScreen';
import AllergiesScreen from '../screens/doctor/AllergiesScreen';
import ChartReviewScreen from '../screens/doctor/ChartReviewScreen';
import VisitManagementScreen from '../screens/doctor/VisitManagementScreen';
import PrescriptionHistoryScreen from '../screens/doctor/PrescriptionHistoryScreen';
import LabResultsDashboardScreen from '../screens/doctor/LabResultsDashboardScreen';
import ClinicalAlertsScreen from '../screens/doctor/ClinicalAlertsScreen';
import DocumentManagementScreen from '../screens/doctor/DocumentManagementScreen';
import ProviderMessagingScreen from '../screens/provider/ProviderMessagingScreen';

// Shared Screens
import FinanceDashboard from '../screens/finance/FinanceDashboard';
import ComposeMessageScreen from '../screens/shared/ComposeMessageScreen';
import MessageThreadScreen from '../screens/shared/MessageThreadScreen';
import MoreScreen from '../screens/shared/MoreScreen';

const Stack = createStackNavigator();

const DoctorNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="DoctorDashboard"
        component={DoctorDashboard}
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
        name="Prescribe"
        component={PrescribeScreen}
      />
      <Stack.Screen
        name="CreatePrescription"
        component={CreatePrescriptionScreen}
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
        name="LabOrder"
        component={LabOrderScreen}
      />
      <Stack.Screen
        name="ClinicalNotes"
        component={ClinicalNotesScreen}
      />
      <Stack.Screen
        name="ProblemList"
        component={ProblemListScreen}
      />
      <Stack.Screen
        name="Allergies"
        component={AllergiesScreen}
      />
      <Stack.Screen
        name="ChartReview"
        component={ChartReviewScreen}
      />
      <Stack.Screen
        name="VisitManagement"
        component={VisitManagementScreen}
      />
      <Stack.Screen
        name="PrescriptionHistory"
        component={PrescriptionHistoryScreen}
      />
      <Stack.Screen
        name="LabResultsDashboard"
        component={LabResultsDashboardScreen}
      />
      <Stack.Screen
        name="ClinicalAlerts"
        component={ClinicalAlertsScreen}
      />
      <Stack.Screen
        name="DocumentManagement"
        component={DocumentManagementScreen}
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

export default DoctorNavigator;
