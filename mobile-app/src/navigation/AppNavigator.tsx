import React, { useMemo, useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { RootState } from '../store';
import { setCurrentTenant } from '../store/slices/tenant.slice';
import { storageUtils } from '../utils/storage';
import { colors } from '../theme/designSystem';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import TenantSelectionScreen from '../screens/auth/TenantSelectionScreen';

// Navigators
import DoctorNavigator from './DoctorNavigator';
import PatientNavigator from './PatientNavigator';
import NurseNavigator from './NurseNavigator';
import FinanceNavigator from './FinanceNavigator';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const dispatch = useDispatch();
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [hasTenant, setHasTenant] = useState(false);

  // Load cached tenant on mount - this runs every time app starts
  useEffect(() => {
    const loadCachedTenant = async () => {
      try {
        // Always check for cached tenant first
        const cached = await storageUtils.getCachedTenant();
        if (cached) {
          // Load tenant into Redux store
          dispatch(
            setCurrentTenant({
              id: cached.id,
              name: cached.name,
              slug: cached.slug,
            })
          );
          // Ensure tenant slug is stored for API calls
          await storageUtils.setTenantSlug(cached.subdomain || cached.slug);
          setHasTenant(true);
        } else {
          setHasTenant(false);
        }
      } catch (error) {
        console.error('Error loading cached tenant:', error);
        setHasTenant(false);
      } finally {
        setLoadingTenant(false);
      }
    };
    loadCachedTenant();
  }, []);

  const userRole = useMemo(() => {
    const role = user?.role || user?.user_type || 'patient';
    // Normalize finance role names
    if (role === 'finance' || role === 'accountant' || role === 'accounts' || role === 'account') {
      return 'finance';
    }
    return role;
  }, [user]);

  // Show loading screen while checking for tenant
  if (loadingTenant) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // If not authenticated, check if tenant is selected
  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasTenant && !currentTenant ? (
          // No tenant selected - show tenant selection first
          <>
            <Stack.Screen name="TenantSelection" component={TenantSelectionScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : (
          // Tenant is selected - go straight to login
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="TenantSelection" component={TenantSelectionScreen} />
          </>
        )}
      </Stack.Navigator>
    );
  }

          // Route based on user role
          if (userRole === 'doctor' || userRole === 'physician') {
            return <DoctorNavigator />;
          }

          if (userRole === 'nurse') {
            return <NurseNavigator />;
          }

          if (userRole === 'finance') {
            return <FinanceNavigator />;
          }

          return <PatientNavigator />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default AppNavigator;


