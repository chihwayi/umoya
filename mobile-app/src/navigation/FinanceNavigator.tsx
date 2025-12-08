import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Finance Screens
import FinanceDashboard from '../screens/finance/FinanceDashboard';

// Shared Screens (only finance-related)
import MoreScreen from '../screens/shared/MoreScreen';

const Stack = createStackNavigator();

const FinanceNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="FinanceDashboard"
        component={FinanceDashboard}
      />
      <Stack.Screen
        name="More"
        component={MoreScreen}
      />
    </Stack.Navigator>
  );
};

export default FinanceNavigator;

