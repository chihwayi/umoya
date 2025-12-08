import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { clearCredentials } from '../../store/slices/auth.slice';
import { storageUtils } from '../../utils/storage';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import Icon from '../../components/shared/Icon';
import { useAlert } from '../../hooks/useAlert';
import { useToast } from '../../hooks/useToast';

const MoreScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();

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

  const menuItems = [
    {
      id: 'profile',
      title: 'Profile',
      icon: 'user',
      subtitle: user?.email || user?.firstName || 'View your profile',
      onPress: () => {
        showToast('Profile feature coming soon', 'info', 'Profile');
      },
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings',
      subtitle: 'App preferences and configuration',
      onPress: () => {
        showToast('Settings feature coming soon', 'info', 'Settings');
      },
    },
    {
      id: 'about',
      title: 'About',
      icon: 'info',
      subtitle: 'App version and information',
      onPress: () => {
        showToast('MediCore Mobile App v1.0.0', 'info', 'About');
      },
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title="More" subtitle="Settings & Account" showBack={false} />
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
          {/* User Info Card */}
          <GlassCard style={styles.userCard} padding={spacing.lg}>
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || 'User'}
                </Text>
                <Text style={styles.userEmail}>{user?.email || ''}</Text>
                {user?.role && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </View>
          </GlassCard>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <GlassCard style={styles.menuCard} padding={spacing.md}>
                  <View style={styles.menuItemContent}>
                    <View style={styles.menuIconContainer}>
                      <Icon name={item.icon} size={24} color={colors.primary} />
                    </View>
                    <View style={styles.menuItemText}>
                      <Text style={styles.menuItemTitle}>{item.title}</Text>
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Icon name="chevronRight" size={20} color={colors.textTertiary} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <GlassCard
              style={[styles.logoutCard, { borderColor: colors.error + '40' }]}
              padding={spacing.md}
            >
              <View style={styles.logoutContent}>
                <View style={[styles.menuIconContainer, { backgroundColor: colors.error + '20' }]}>
                  <Icon name="logout" size={24} color={colors.error} />
                </View>
                <View style={styles.menuItemText}>
                  <Text style={[styles.menuItemTitle, { color: colors.error }]}>Logout</Text>
                  <Text style={styles.menuItemSubtitle}>Sign out of your account</Text>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
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
    paddingBottom: spacing.xl * 2,
  },
  content: {
    flex: 1,
  },
  userCard: {
    marginBottom: spacing.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    color: colors.textOnPrimary,
    fontSize: 28,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  userEmail: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  roleText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 10,
  },
  menuSection: {
    marginBottom: spacing.lg,
  },
  menuItem: {
    marginBottom: spacing.md,
  },
  menuCard: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  menuItemSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontSize: 12,
  },
  logoutButton: {
    marginTop: spacing.md,
  },
  logoutCard: {
    borderWidth: 2,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default MoreScreen;

