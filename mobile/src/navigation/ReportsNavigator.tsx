import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { C } from '../design/tokens';
import ReportsHomeScreen from '../screens/reports/ReportsHomeScreen';
import CascadeDetailScreen from '../screens/reports/CascadeDetailScreen';
import EquitySummaryScreen from '../screens/reports/EquitySummaryScreen';
import MdsrMobileScreen from '../screens/reports/MdsrMobileScreen';
import PharmacyReportsScreen from '../screens/reports/PharmacyReportsScreen';
import DhisAlertsScreen from '../screens/reports/DhisAlertsScreen';
import LabQualityScreen from '../screens/reports/LabQualityScreen';
import AiGovernanceMobileScreen from '../screens/reports/AiGovernanceMobileScreen';

const Stack = createNativeStackNavigator();

const SCREEN_OPTIONS = {
  headerShown: true,
  headerStyle: { backgroundColor: C.bg },
  headerTintColor: C.text,
  headerTitleStyle: { color: C.text },
};

export default function ReportsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReportsHome" component={ReportsHomeScreen} />
      <Stack.Screen
        name="CascadeDetail"
        component={CascadeDetailScreen}
        options={{ ...SCREEN_OPTIONS, title: 'HIV Cascade' }}
      />
      <Stack.Screen
        name="EquitySummary"
        component={EquitySummaryScreen}
        options={{ ...SCREEN_OPTIONS, title: 'Equity Analytics' }}
      />
      <Stack.Screen
        name="MdsrMobile"
        component={MdsrMobileScreen}
        options={{ ...SCREEN_OPTIONS, title: 'MDSR Review' }}
      />
      <Stack.Screen
        name="PharmacyReports"
        component={PharmacyReportsScreen}
        options={{ ...SCREEN_OPTIONS, title: 'Pharmacy Intelligence' }}
      />
      <Stack.Screen
        name="DhisAlerts"
        component={DhisAlertsScreen}
        options={{ ...SCREEN_OPTIONS, title: 'DHIS2 Alerts' }}
      />
      <Stack.Screen
        name="LabQuality"
        component={LabQualityScreen}
        options={{ ...SCREEN_OPTIONS, title: 'Lab Quality' }}
      />
      <Stack.Screen
        name="AiGovernanceMobile"
        component={AiGovernanceMobileScreen}
        options={{ ...SCREEN_OPTIONS, title: 'AI Governance' }}
      />
    </Stack.Navigator>
  );
}
