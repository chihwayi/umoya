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
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { clearCredentials } from '../../store/slices/auth.slice';
import { storageUtils } from '../../utils/storage';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import { format, parseISO, isToday } from 'date-fns';
import appointmentService, { Appointment } from '../../services/appointment.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import { useAlert } from '../../hooks/useAlert';
import { useToast } from '../../hooks/useToast';

const { width } = Dimensions.get('window');

const NurseDashboard: React.FC = () => {
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

  const isPaymentPending = (appointment: Appointment) => {
    return appointment.paymentStatus === 'awaiting_payment' && appointment.feeAmount && appointment.feeAmount > 0;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '$0.00';
    return `$${amount.toFixed(2)}`;
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
    if (appointment?.patient?.id) {
      (navigation as any).navigate('PatientDetail', { patientId: appointment.patient.id });
    } else {
      Alert.alert('Error', 'Patient information not available');
    }
  };

  // Group appointments by status
  const scheduledAppointments = appointments.filter((apt) => apt.status === 'scheduled');
  const checkedInAppointments = appointments.filter((apt) => apt.status === 'checked_in');
  const inProgressAppointments = appointments.filter((apt) => apt.status === 'in_progress');
  const upcomingAppointments = scheduledAppointments.filter((apt) => {
    const aptTime = parseISO(apt.appointmentDate);
    return isToday(aptTime) && aptTime >= new Date();
  });

  const awaitingPaymentCount = appointments.filter((apt) => isPaymentPending(apt)).length;

  const stats = {
    total: appointments.length,
    awaitingVitals: checkedInAppointments.length,
    inProgress: inProgressAppointments.length,
    upcoming: upcomingAppointments.length,
    awaitingPayment: awaitingPaymentCount,
  };

  const userName = user
    ? `${(user as any).first_name || (user as any).firstName || ''} ${(user as any).last_name || (user as any).lastName || ''}`.trim()
    : 'Nurse';

  if (loading && appointments.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Nurse Dashboard" subtitle={`Welcome, ${userName}`} showBack={false} />
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
        title="Nurse Dashboard" 
        subtitle={`Welcome, ${userName}`} 
        showBack={false}
        rightAction={
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        }
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
              <Text style={[styles.statValue, { color: colors.info }]}>{stats.awaitingVitals}</Text>
              <Text style={styles.statLabel}>Awaiting Vitals</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{stats.inProgress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.upcoming}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </GlassCard>
          </View>

          {/* Payment Alert */}
          {stats.awaitingPayment > 0 && (
            <GlassCard style={[styles.alertCard, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
              <View style={styles.alertContent}>
                <Text style={styles.alertIcon}>⚠️</Text>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>
                    {stats.awaitingPayment} appointment{stats.awaitingPayment > 1 ? 's' : ''} awaiting payment
                  </Text>
                  <Text style={styles.alertSubtitle}>
                    Vitals cannot be recorded until payment is confirmed. Please contact the finance department.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.alertButton, { backgroundColor: colors.warning }]}
                  onPress={() => {
                    showAlert(
                      'Payment Required',
                      `${stats.awaitingPayment} appointment(s) require payment confirmation. Please contact the finance department to process payments before recording vitals.`,
                      'warning'
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.alertButtonText}>Info</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}

          {/* Patient Queue - Awaiting Vitals */}
          {checkedInAppointments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Awaiting Vitals</Text>
                <View style={[styles.badge, { backgroundColor: colors.info }]}>
                  <Text style={styles.badgeText}>{checkedInAppointments.length}</Text>
                </View>
              </View>
              {checkedInAppointments.map((appointment) => {
                const awaitingPayment = isPaymentPending(appointment);
                return (
                  <GlassCard
                    key={appointment.id}
                    style={[styles.appointmentCard, awaitingPayment && styles.paymentPendingCard]}
                  >
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
                      {awaitingPayment && (
                        <View style={styles.paymentWarning}>
                          <Text style={styles.warningIcon}>🔒</Text>
                          <View style={styles.warningContent}>
                            <Text style={styles.warningTitle}>Payment Required</Text>
                            <Text style={styles.warningText}>
                              Fee: {formatCurrency(appointment.feeAmount)} • Accounts must confirm payment before vitals can be recorded
                            </Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.quickActions}>
                        <PrimaryButton
                          title={awaitingPayment ? 'Payment Required' : 'Record Vitals'}
                          onPress={() => {
                            if (awaitingPayment) {
                              showAlert(
                                'Payment Required',
                                `Payment of ${formatCurrency(appointment.feeAmount)} must be confirmed before vitals can be recorded. Please contact the finance department to process the payment.`,
                                'warning'
                              );
                            } else if (appointment?.patient?.id) {
                              (navigation as any).navigate('Vitals', { patientId: appointment.patient.id });
                            } else {
                              showToast('Patient information not available', 'error', 'Error');
                            }
                          }}
                          icon={awaitingPayment ? '🔒' : '🩺'}
                          style={[styles.actionButton, awaitingPayment && styles.disabledButton]}
                          disabled={awaitingPayment}
                        />
                        <TouchableOpacity
                          style={[
                            styles.secondaryButton,
                            { borderColor: colors.primary },
                            awaitingPayment && styles.disabledButton,
                          ]}
                          onPress={() => {
                            if (awaitingPayment) {
                              showAlert('Payment Required', 'Payment must be confirmed before accessing MAR.', 'warning');
                            } else if (appointment?.patient?.id) {
                              (navigation as any).navigate('MAR', { patientId: appointment.patient.id });
                            } else {
                              Alert.alert('Error', 'Patient information not available');
                            }
                          }}
                          activeOpacity={0.7}
                          disabled={awaitingPayment}
                        >
                          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>MAR</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </GlassCard>
                );
              })}
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
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.slice(0, 5).map((appointment) => {
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
                onPress={() => {
                  // Navigate to patient search first if no patient selected
                  (navigation as any).navigate('PatientSearch');
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.error + '20' }]}>
                  <Text style={styles.quickActionEmoji}>🩺</Text>
                </View>
                <Text style={styles.quickActionText}>Record Vitals</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => {
                  // Navigate to patient search first if no patient selected
                  (navigation as any).navigate('PatientSearch');
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.success + '20' }]}>
                  <Text style={styles.quickActionEmoji}>💉</Text>
                </View>
                <Text style={styles.quickActionText}>MAR</Text>
              </TouchableOpacity>
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
                onPress={() => (navigation as any).navigate('CreateAppointment')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={styles.quickActionEmoji}>📅</Text>
                </View>
                <Text style={styles.quickActionText}>Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => {
                  if (stats.awaitingPayment > 0) {
                    showAlert(
                      'Payment Required',
                      `${stats.awaitingPayment} appointment(s) require payment confirmation before vitals can be recorded. Please contact the finance department to process payments.`,
                      'warning'
                    );
                  } else {
                    showToast('All appointments are paid', 'success', 'Payment Status');
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={styles.quickActionEmoji}>💰</Text>
                </View>
                <Text style={styles.quickActionText}>Payment Status</Text>
                {stats.awaitingPayment > 0 && (
                  <View style={styles.quickActionBadge}>
                    <Text style={styles.quickActionBadgeText}>{stats.awaitingPayment}</Text>
                  </View>
                )}
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
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => (navigation as any).navigate('More')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.error + '20' }]}>
                  <Text style={styles.quickActionEmoji}>⚙️</Text>
                </View>
                <Text style={styles.quickActionText}>Settings</Text>
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
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    ...typography.bodySmall,
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
    width: (width - spacing.lg * 2 - spacing.md) / 2,
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
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  quickActionBadgeText: {
    ...typography.labelSmall,
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  paymentPendingCard: {
    borderWidth: 2,
    borderColor: colors.warning,
    backgroundColor: colors.warning + '10',
  },
  paymentWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: spacing.xxs,
  },
  warningText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.warning,
  },
  disabledButton: {
    opacity: 0.5,
  },
  alertCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderWidth: 2,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    ...typography.bodyBold,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  alertSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  alertButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  alertButtonText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 20,
  },
});

export default NurseDashboard;
