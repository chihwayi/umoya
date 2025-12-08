import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import appointmentService, { Appointment } from '../../services/appointment.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';
import { format, parseISO } from 'date-fns';

const VisitManagementScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { appointmentId } = route.params as { appointmentId: string };

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const data = await appointmentService.getAppointmentById(appointmentId);
      setAppointment(data);
    } catch (error) {
      console.error('Error loading appointment:', error);
      Alert.alert('Error', 'Failed to load appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setUpdating(true);
      await appointmentService.checkInPatient(appointmentId);
      await loadAppointment();
      Alert.alert('Success', 'Patient checked in');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to check in patient');
    } finally {
      setUpdating(false);
    }
  };

  const handleStartVisit = async () => {
    try {
      setUpdating(true);
      await appointmentService.startAppointment(appointmentId);
      await loadAppointment();
      Alert.alert('Success', 'Visit started');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start visit');
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteVisit = async () => {
    Alert.alert(
      'Complete Visit',
      'Are you sure you want to complete this visit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              setUpdating(true);
              await appointmentService.completeAppointment(appointmentId);
              await loadAppointment();
              Alert.alert('Success', 'Visit completed', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to complete visit');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'scheduled':
        return colors.appointmentScheduled;
      case 'checked_in':
        return colors.appointmentCheckedIn;
      case 'in_progress':
        return colors.appointmentInProgress;
      case 'completed':
        return colors.appointmentCompleted;
      case 'cancelled':
        return colors.appointmentCancelled;
      default:
        return colors.textTertiary;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'scheduled':
        return '📅';
      case 'checked_in':
        return '✅';
      case 'in_progress':
        return '🩺';
      case 'completed':
        return '✓';
      case 'cancelled':
        return '❌';
      default:
        return '📋';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Visit Management" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Visit Management" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Appointment not found</Text>
        </View>
      </View>
    );
  }

  const canCheckIn = appointment.status === 'scheduled';
  const canStart = appointment.status === 'checked_in' || appointment.status === 'scheduled';
  const canComplete = appointment.status === 'in_progress';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Visit Management" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Info */}
        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.patientHeader}>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>
                {appointment.patient.firstName} {appointment.patient.lastName}
              </Text>
              {appointment.patient.patientNumber && (
                <Text style={styles.patientId}>
                  ID: {appointment.patient.patientNumber}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(appointment.status) + '20' },
              ]}
            >
              <Text style={styles.statusIcon}>
                {getStatusIcon(appointment.status)}
              </Text>
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(appointment.status) },
                ]}
              >
                {appointment.status?.toUpperCase().replace('_', ' ') || 'UNKNOWN'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Appointment Details */}
        <GlassCard style={styles.card} padding={spacing.lg}>
          <Text style={styles.sectionTitle}>Appointment Details</Text>
          <View style={styles.detailRow}>
            <Icon name="clock" size={20} />
            <Text style={styles.detailLabel}>Date & Time:</Text>
            <Text style={styles.detailValue}>
              {format(parseISO(appointment.appointmentDate), 'MMM dd, yyyy h:mm a')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="stethoscope" size={20} />
            <Text style={styles.detailLabel}>Type:</Text>
            <Text style={styles.detailValue}>{appointment.appointmentType || 'General'}</Text>
          </View>
          {appointment.reason && (
            <View style={styles.detailRow}>
              <Icon name="notes" size={20} />
              <Text style={styles.detailLabel}>Reason:</Text>
              <Text style={styles.detailValue}>{appointment.reason}</Text>
            </View>
          )}
          {appointment.checkInTime && (
            <View style={styles.detailRow}>
              <Icon name="check" size={20} />
              <Text style={styles.detailLabel}>Checked In:</Text>
              <Text style={styles.detailValue}>
                {format(parseISO(appointment.checkInTime), 'h:mm a')}
              </Text>
            </View>
          )}
          {appointment.actualStartTime && (
            <View style={styles.detailRow}>
              <Icon name="stethoscope" size={20} />
              <Text style={styles.detailLabel}>Started:</Text>
              <Text style={styles.detailValue}>
                {format(parseISO(appointment.actualStartTime), 'h:mm a')}
              </Text>
            </View>
          )}
          {appointment.actualEndTime && (
            <View style={styles.detailRow}>
              <Icon name="check" size={20} />
              <Text style={styles.detailLabel}>Completed:</Text>
              <Text style={styles.detailValue}>
                {format(parseISO(appointment.actualEndTime), 'h:mm a')}
              </Text>
            </View>
          )}
        </GlassCard>

        {/* Quick Actions */}
        <GlassCard style={styles.card} padding={spacing.lg}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() =>
                navigation.navigate('ClinicalNotes' as never, {
                  appointmentId,
                  patientId: appointment.patient.id,
                } as never)
              }
              activeOpacity={0.7}
            >
              <Icon name="notes" size={24} />
              <Text style={styles.quickActionText}>Clinical Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() =>
                navigation.navigate('ProblemList' as never, {
                  patientId: appointment.patient.id,
                } as never)
              }
              activeOpacity={0.7}
            >
              <Icon name="problem" size={24} />
              <Text style={styles.quickActionText}>Problems</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() =>
                navigation.navigate('Allergies' as never, {
                  patientId: appointment.patient.id,
                } as never)
              }
              activeOpacity={0.7}
            >
              <Icon name="allergy" size={24} />
              <Text style={styles.quickActionText}>Allergies</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() =>
                navigation.navigate('ChartReview' as never, {
                  patientId: appointment.patient.id,
                } as never)
              }
              activeOpacity={0.7}
            >
              <Icon name="chart" size={24} />
              <Text style={styles.quickActionText}>Chart</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Visit Actions */}
        <View style={styles.actions}>
          {canCheckIn && (
            <PrimaryButton
              title="Check In Patient"
              onPress={handleCheckIn}
              disabled={updating}
              icon="check"
            />
          )}
          {canStart && (
            <PrimaryButton
              title="Start Visit"
              onPress={handleStartVisit}
              disabled={updating}
              icon="stethoscope"
            />
          )}
          {canComplete && (
            <PrimaryButton
              title="Complete Visit"
              onPress={handleCompleteVisit}
              disabled={updating}
              icon="check"
            />
          )}
          {appointment.status === 'completed' && (
            <GlassCard style={styles.completedCard} padding={spacing.md}>
              <Icon name="success" size={32} />
              <Text style={styles.completedText}>Visit Completed</Text>
            </GlassCard>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.lg,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  patientId: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusIcon: {
    fontSize: 16,
  },
  statusText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.label,
    width: 100,
    color: colors.textTertiary,
  },
  detailValue: {
    ...typography.body,
    flex: 1,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  quickActionText: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  completedCard: {
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    borderColor: colors.success,
  },
  completedText: {
    ...typography.h5,
    color: colors.success,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
});

export default VisitManagementScreen;

