import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import Icon from '../../components/shared/Icon';
import { useAlert } from '../../hooks/useAlert';
import { useToast } from '../../hooks/useToast';
import { storageUtils } from '../../utils/storage';
import { clearCredentials } from '../../store/slices/auth.slice';
import { ehrApi, API_ENDPOINTS } from '../../config/api';

const { width } = Dimensions.get('window');

const PatientDashboard: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Beautiful alerts and toasts
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();

  const handleLogout = () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      'confirm',
      {
        confirmText: 'Logout',
        cancelText: 'Cancel',
        onConfirm: async () => {
          try {
            // Call logout API
            try {
              await ehrApi.post(API_ENDPOINTS.AUTH.LOGOUT);
            } catch (error) {
              // Continue with logout even if API call fails
              console.log('Logout API call failed, continuing with local logout');
            }

            // Clear auth state
            await storageUtils.clearAuth();
            dispatch(clearCredentials());

            // Navigate to login
            (navigation as any).reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } catch (error) {
            console.error('Logout error:', error);
            showToast('Error during logout', 'error', 'Logout Failed');
          }
        },
      }
    );
  };

  const logoutButton = (
    <TouchableOpacity
      onPress={handleLogout}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.error + '20',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      activeOpacity={0.7}
    >
      <Icon name="logout" size={20} color={colors.error} />
    </TouchableOpacity>
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const menuItems = [
    { id: 'appointments', title: 'Appointments', icon: '📅', screen: 'Appointments', color: '#3b82f6' },
    { id: 'medical-records', title: 'Medical Records', icon: '📋', screen: 'MedicalRecords', color: '#10b981' },
    { id: 'prescriptions', title: 'Prescriptions', icon: '💊', screen: 'Prescriptions', color: '#f59e0b' },
    { id: 'lab-results', title: 'Lab Results', icon: '🔬', screen: 'LabResults', color: '#8b5cf6' },
    { id: 'documents', title: 'Documents', icon: '📄', screen: 'Documents', color: '#ec4899' },
    { id: 'billing', title: 'Billing', icon: '💳', screen: 'Billing', color: '#06b6d4' },
    { id: 'telemedicine', title: 'Telemedicine', icon: '📹', screen: 'Telemedicine', color: '#ef4444' },
    { id: 'messaging', title: 'Messages', icon: '💬', screen: 'PatientMessaging', color: '#6366f1' },
  ];

  const handleNavigate = (screen: string) => {
    (navigation as any).navigate(screen);
  };

  const userName = user ? `${(user as any).first_name || (user as any).firstName || ''} ${(user as any).last_name || (user as any).lastName || ''}`.trim() : 'User';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Welcome back!"
        subtitle={userName}
        showBack={false}
        rightAction={logoutButton}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Quick Stats Cards */}
          <View style={styles.statsRow}>
            <GlassCard style={styles.statCard} padding={16}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </GlassCard>
            <GlassCard style={styles.statCard} padding={16}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </GlassCard>
          </View>

          {/* Menu Grid */}
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <Animated.View
                key={item.id}
                style={[
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: slideAnim.interpolate({
                          inputRange: [0, 30],
                          outputRange: [0, 30 - index * 5],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate(item.screen)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}20` }]}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
      {/* Beautiful Alerts and Toasts */}
      {AlertComponent}
      {ToastComponent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  content: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  menuItem: {
    width: (width - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.md,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  menuIcon: {
    fontSize: 28,
  },
  menuTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default PatientDashboard;
