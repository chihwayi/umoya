import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { format, parseISO, isToday, isPast, isFuture } from 'date-fns';
import appointmentService, { Appointment } from '../../services/appointment.service';
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

const DoctorDashboard: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // Reload appointments when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTodayAppointments();
    }, [])
  );

  const loadTodayAppointments = async () => {
    try {
      setLoading(true);
      const todayAppointments = await appointmentService.getTodayAppointments();
      setAppointments(todayAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTodayAppointments();
    setRefreshing(false);
  };

  const getAppointmentStatusColor = (status: Appointment['status']) => {
    switch (status) {
      case 'checked_in':
        return colors.info;
      case 'in_progress':
        return colors.primary;
      case 'completed':
        return colors.success;
      case 'cancelled':
      case 'no_show':
        return colors.error;
      default:
        return colors.textTertiary;
    }
  };

  const getAppointmentStatusText = (status: Appointment['status']) => {
    switch (status) {
      case 'checked_in':
        return 'Checked In';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'no_show':
        return 'No Show';
      default:
        return 'Scheduled';
    }
  };

  const getTimeStatus = (appointmentDate: string) => {
    const aptTime = parseISO(appointmentDate);
    const now = new Date();
    const diffMinutes = Math.floor((aptTime.getTime() - now.getTime()) / 60000);

    if (diffMinutes < 0) {
      return { type: 'past', text: `${Math.abs(diffMinutes)}m ago`, color: colors.textTertiary };
    } else if (diffMinutes <= 15) {
      return { type: 'upcoming', text: `in ${diffMinutes}m`, color: colors.warning };
    } else {
      return { type: 'future', text: format(aptTime, 'h:mm a'), color: colors.textSecondary };
    }
  };

  const handleAppointmentPress = (appointment: Appointment) => {
    (navigation as any).navigate('PatientDetail', { patientId: appointment.patient.id });
  };

  const handleQuickAction = (action: string, appointment?: Appointment) => {
    switch (action) {
      case 'checkin':
        if (appointment) {
          appointmentService.checkInPatient(appointment.id).then(() => loadTodayAppointments());
        }
        break;
      case 'start':
        if (appointment) {
          appointmentService.startAppointment(appointment.id).then(() => loadTodayAppointments());
        }
        break;
      case 'prescribe':
        (navigation as any).navigate('CreatePrescription', {
          patientId: appointment?.patient.id,
        });
        break;
      case 'lab':
        (navigation as any).navigate('LabOrder', {
          patientId: appointment?.patient.id,
        });
        break;
      default:
        break;
    }
  };

  // Group appointments by status
  const scheduledAppointments = appointments.filter((apt) => apt.status === 'scheduled');
  const checkedInAppointments = appointments.filter((apt) => apt.status === 'checked_in');
  const inProgressAppointments = appointments.filter((apt) => apt.status === 'in_progress');
  // Show all scheduled appointments for today (not just future ones)
  const todayScheduledAppointments = scheduledAppointments.filter((apt) => {
    const aptTime = parseISO(apt.appointmentDate);
    return isToday(aptTime);
  });

  const stats = {
    total: appointments.length,
    upcoming: todayScheduledAppointments.length,
    checkedIn: checkedInAppointments.length,
    inProgress: inProgressAppointments.length,
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

  const userName = user
    ? `${(user as any).first_name || (user as any).firstName || ''} ${(user as any).last_name || (user as any).lastName || ''}`.trim()
    : 'Doctor';

  if (loading && appointments.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader 
          title="Today's Schedule" 
          subtitle={`Welcome, Dr. ${userName}`} 
          showBack={false}
          rightAction={logoutButton}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Today's Schedule" 
        subtitle={`Welcome, Dr. ${userName}`} 
        showBack={false}
        rightAction={logoutButton}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <GlassCard style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.upcoming}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.info }]}>{stats.checkedIn}</Text>
              <Text style={styles.statLabel}>Checked In</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{stats.inProgress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </GlassCard>
          </View>

          {/* Patient Queue - Checked In */}
          {checkedInAppointments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Patient Queue</Text>
                <View style={[styles.badge, { backgroundColor: colors.info }]}>
                  <Text style={styles.badgeText}>{checkedInAppointments.length}</Text>
                </View>
              </View>
              {checkedInAppointments.map((appointment) => (
                <GlassCard key={appointment.id} style={styles.appointmentCard}>
                  <TouchableOpacity
                    onPress={() => handleAppointmentPress(appointment)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.appointmentHeader}>
                      <View style={styles.patientInfo}>
                        <Text style={styles.patientName}>
                          {appointment.patient.firstName} {appointment.patient.lastName}
                        </Text>
                        {appointment.patient.patientNumber && (
                          <Text style={styles.patientNumber}>ID: {appointment.patient.patientNumber}</Text>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getAppointmentStatusColor(appointment.status) }]}>
                        <Text style={styles.statusText}>{getAppointmentStatusText(appointment.status)}</Text>
                      </View>
                    </View>
                    <View style={styles.appointmentMeta}>
                      <Text style={styles.appointmentType}>{appointment.appointmentType}</Text>
                      <Text style={styles.appointmentTime}>
                        {format(parseISO(appointment.appointmentDate), 'h:mm a')}
                      </Text>
                    </View>
                    {appointment.reason && (
                      <Text style={styles.appointmentReason} numberOfLines={1}>
                        {appointment.reason}
                      </Text>
                    )}
                    <View style={styles.quickActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                        onPress={() => handleQuickAction('start', appointment)}
                      >
                        <Text style={styles.actionButtonText}>Start Visit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.glassCard, borderWidth: 1, borderColor: colors.primary }]}
                        onPress={() => handleQuickAction('prescribe', appointment)}
                      >
                        <Text style={[styles.actionButtonText, { color: colors.primary }]}>Prescribe</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </GlassCard>
              ))}
            </View>
          )}

          {/* In Progress */}
          {inProgressAppointments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>In Progress</Text>
                <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                  <Text style={styles.badgeText}>{inProgressAppointments.length}</Text>
                </View>
              </View>
              {inProgressAppointments.map((appointment) => (
                <GlassCard key={appointment.id} style={[styles.appointmentCard, { borderColor: colors.primary, borderWidth: 2 }]}>
                  <TouchableOpacity
                    onPress={() => handleAppointmentPress(appointment)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.appointmentHeader}>
                      <View style={styles.patientInfo}>
                        <Text style={styles.patientName}>
                          {appointment.patient.firstName} {appointment.patient.lastName}
                        </Text>
                        {appointment.patient.patientNumber && (
                          <Text style={styles.patientNumber}>ID: {appointment.patient.patientNumber}</Text>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.statusText}>In Progress</Text>
                      </View>
                    </View>
                    <View style={styles.appointmentMeta}>
                      <Text style={styles.appointmentType}>{appointment.appointmentType}</Text>
                      <Text style={styles.appointmentTime}>
                        Started: {appointment.actualStartTime ? format(parseISO(appointment.actualStartTime), 'h:mm a') : 'Now'}
                      </Text>
                    </View>
                    <View style={styles.quickActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.success, flex: 1 }]}
                        onPress={() => {
                          appointmentService.completeAppointment(appointment.id).then(() => loadTodayAppointments());
                        }}
                      >
                        <Text style={styles.actionButtonText}>Complete Visit</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </GlassCard>
              ))}
            </View>
          )}

          {/* Today's Schedule */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('Schedule')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {todayScheduledAppointments.length > 0 ? (
              todayScheduledAppointments.slice(0, 5).map((appointment) => {
                const timeStatus = getTimeStatus(appointment.appointmentDate);
                return (
                  <GlassCard key={appointment.id} style={styles.appointmentCard}>
                    <TouchableOpacity
                      onPress={() => handleAppointmentPress(appointment)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.appointmentHeader}>
                        <View style={styles.patientInfo}>
                          <Text style={styles.patientName}>
                            {appointment.patient.firstName} {appointment.patient.lastName}
                          </Text>
                          {appointment.patient.patientNumber && (
                            <Text style={styles.patientNumber}>ID: {appointment.patient.patientNumber}</Text>
                          )}
                        </View>
                        <View style={[styles.timeBadge, { backgroundColor: timeStatus.color + '20' }]}>
                          <Text style={[styles.timeText, { color: timeStatus.color }]}>{timeStatus.text}</Text>
                        </View>
                      </View>
                      <View style={styles.appointmentMeta}>
                        <Text style={styles.appointmentType}>{appointment.appointmentType}</Text>
                        <Text style={styles.appointmentTime}>
                          {format(parseISO(appointment.appointmentDate), 'h:mm a')} • {appointment.durationMinutes} min
                        </Text>
                      </View>
                      {appointment.reason && (
                        <Text style={styles.appointmentReason} numberOfLines={1}>
                          {appointment.reason}
                        </Text>
                      )}
                      {appointment.status === 'scheduled' && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.info, marginTop: spacing.sm }]}
                          onPress={() => handleQuickAction('checkin', appointment)}
                        >
                          <Text style={styles.actionButtonText}>Check In</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </GlassCard>
                );
              })
            ) : (
              <GlassCard style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>No More Appointments</Text>
                <Text style={styles.emptySubtitle}>You're all caught up for today!</Text>
              </GlassCard>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => (navigation as any).navigate('PatientSearch')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.info + '20' }]}>
                  <Text style={styles.quickActionEmoji}>🔍</Text>
                </View>
                <Text style={styles.quickActionText}>Search Patient</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => (navigation as any).navigate('Schedule')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.success + '20' }]}>
                  <Text style={styles.quickActionEmoji}>📅</Text>
                </View>
                <Text style={styles.quickActionText}>Full Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => (navigation as any).navigate('ProviderMessaging')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={styles.quickActionEmoji}>💬</Text>
                </View>
                <Text style={styles.quickActionText}>Messages</Text>
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  statValue: {
    ...typography.h3,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    fontSize: 20,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  viewAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  appointmentCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...typography.h4,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  patientNumber: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  timeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  timeText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  appointmentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  appointmentType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  appointmentTime: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  appointmentReason: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickActionCard: {
    width: (width - spacing.lg * 2 - spacing.md * 2) / 3,
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DoctorDashboard;
