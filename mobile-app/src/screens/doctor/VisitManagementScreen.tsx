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
import vitalsService, { Vitals } from '../../services/vitals.service';
import allergyService from '../../services/allergy.service';
import problemService from '../../services/problem.service';
import { ehrApi } from '../../config/api';
import { API_ENDPOINTS } from '../../config/api';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';
import { format, parseISO } from 'date-fns';
import { checkVitalsAlerts, hasCriticalAlerts, VitalsAlert } from '../../utils/vitalsAlerts';

interface Problem {
  id: string;
  problem: string;
  status: string;
  onsetDate?: string;
}

interface Allergy {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: string;
}

const VisitManagementScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { appointmentId } = route.params as { appointmentId: string };

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [updating, setUpdating] = useState(false);
  const [loadingPatientData, setLoadingPatientData] = useState(false);
  
  // Patient clinical data
  const [latestVitals, setLatestVitals] = useState<Vitals | null>(null);
  const [vitalsAlerts, setVitalsAlerts] = useState<VitalsAlert[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  useEffect(() => {
    if (appointment?.patient?.id && appointment.status === 'in_progress') {
      loadPatientData();
    }
  }, [appointment?.patient?.id, appointment?.status]);

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

  const loadPatientData = async () => {
    if (!appointment?.patient?.id) return;
    
    try {
      setLoadingPatientData(true);
      const patientId = appointment.patient.id;
      
      // Load vitals, problems, and allergies in parallel
      const [vitalsData, problemsData, allergiesData] = await Promise.all([
        vitalsService.getLatestVitals(patientId).catch((err) => {
          console.error('Error loading vitals:', err);
          return null;
        }),
        problemService.getPatientProblems(patientId).catch((err) => {
          console.error('Error loading problems:', err);
          return [];
        }),
        allergyService.getPatientAllergies(patientId).catch((err) => {
          console.error('Error loading allergies:', err);
          return [];
        }),
      ]);
      
      console.log('🩺 [VisitManagementScreen] Loaded vitals:', JSON.stringify(vitalsData, null, 2));
      console.log('🩺 [VisitManagementScreen] Loaded problems:', problemsData?.length || 0);
      console.log('🩺 [VisitManagementScreen] Loaded allergies:', allergiesData?.length || 0);
      
      setLatestVitals(vitalsData);
      
      // Check for abnormal vitals
      if (vitalsData) {
        const alerts = checkVitalsAlerts({
          temperature: vitalsData.temperature,
          bloodPressureSystolic: vitalsData.bloodPressureSystolic,
          bloodPressureDiastolic: vitalsData.bloodPressureDiastolic,
          heartRate: vitalsData.heartRate,
          oxygenSaturation: vitalsData.oxygenSaturation,
          respiratoryRate: vitalsData.respiratoryRate,
          bloodGlucose: vitalsData.bloodGlucose,
        });
        setVitalsAlerts(alerts);
        console.log('🚨 [VisitManagementScreen] Vitals alerts:', alerts.length);
      } else {
        setVitalsAlerts([]);
      }
      
      setProblems(Array.isArray(problemsData) ? problemsData : []);
      setAllergies(Array.isArray(allergiesData) ? allergiesData : []);
    } catch (error) {
      console.error('Error loading patient data:', error);
      // Don't show alert - just log the error
    } finally {
      setLoadingPatientData(false);
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
      // Load patient data after starting visit
      if (appointment?.patient?.id) {
        await loadPatientData();
      }
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

        {/* Critical Patient Information - Only show when visit is in progress */}
        {appointment.status === 'in_progress' && (
          <>
            {/* Vitals Alerts - DANGER STYLING */}
            {vitalsAlerts.length > 0 && (
              <GlassCard style={[styles.card, styles.dangerAlertCard]} padding={spacing.lg}>
                <View style={styles.dangerHeader}>
                  <Text style={styles.dangerTitle}>🚨 ABNORMAL VITALS ALERT 🚨</Text>
                  <View style={styles.dangerBadge}>
                    <Text style={styles.dangerBadgeText}>{vitalsAlerts.length}</Text>
                  </View>
                </View>
                {vitalsAlerts.map((alert, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dangerAlertItem,
                      alert.type === 'critical' && styles.criticalDangerAlert,
                      alert.type === 'warning' && styles.warningDangerAlert,
                    ]}
                  >
                    <View style={styles.dangerAlertHeader}>
                      <Text style={styles.dangerAlertIcon}>
                        {alert.type === 'critical' ? '🔴' : '🟠'}
                      </Text>
                      <Text style={styles.dangerAlertVital}>{alert.vital}</Text>
                    </View>
                    <Text style={styles.dangerAlertMessage}>{alert.message}</Text>
                    <View style={styles.dangerAlertDetails}>
                      <Text style={styles.dangerAlertValueLabel}>Current Value:</Text>
                      <Text style={styles.dangerAlertValue}>{alert.value}</Text>
                    </View>
                    <View style={styles.dangerAlertDetails}>
                      <Text style={styles.dangerAlertNormalLabel}>Normal Range:</Text>
                      <Text style={styles.dangerAlertNormal}>{alert.normalRange}</Text>
                    </View>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Recent Vitals */}
            <GlassCard style={styles.card} padding={spacing.lg}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Vitals</Text>
                {loadingPatientData && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              {latestVitals ? (
                <View style={styles.vitalsGrid}>
                  {latestVitals.temperature && (
                    <View style={styles.vitalItem}>
                      <Icon name="thermometer" size={20} />
                      <Text style={styles.vitalLabel}>Temp</Text>
                      <Text style={[
                        styles.vitalValue,
                        vitalsAlerts.find(a => a.vital === 'Temperature') && {
                          color: vitalsAlerts.find(a => a.vital === 'Temperature')?.type === 'critical' 
                            ? colors.error 
                            : colors.warning
                        }
                      ]}>
                        {latestVitals.temperature}°C
                      </Text>
                    </View>
                  )}
                  {(latestVitals.bloodPressureSystolic || latestVitals.bloodPressureDiastolic) ? (
                    <View style={styles.vitalItem}>
                      <Icon name="blood-pressure" size={20} />
                      <Text style={styles.vitalLabel}>BP</Text>
                      <Text style={[
                        styles.vitalValue,
                        vitalsAlerts.find(a => a.vital === 'Blood Pressure') && {
                          color: vitalsAlerts.find(a => a.vital === 'Blood Pressure')?.type === 'critical' 
                            ? colors.error 
                            : colors.warning
                        }
                      ]}>
                        {latestVitals.bloodPressureSystolic || '--'}/{latestVitals.bloodPressureDiastolic || '--'}
                      </Text>
                    </View>
                  ) : null}
                  {latestVitals.heartRate && (
                    <View style={styles.vitalItem}>
                      <Icon name="heart-pulse" size={20} />
                      <Text style={styles.vitalLabel}>HR</Text>
                      <Text style={[
                        styles.vitalValue,
                        vitalsAlerts.find(a => a.vital === 'Heart Rate') && {
                          color: vitalsAlerts.find(a => a.vital === 'Heart Rate')?.type === 'critical' 
                            ? colors.error 
                            : colors.warning
                        }
                      ]}>
                        {latestVitals.heartRate} bpm
                      </Text>
                    </View>
                  )}
                  {latestVitals.oxygenSaturation && (
                    <View style={styles.vitalItem}>
                      <Icon name="lungs" size={20} />
                      <Text style={styles.vitalLabel}>SpO2</Text>
                      <Text style={[
                        styles.vitalValue,
                        vitalsAlerts.find(a => a.vital === 'Oxygen Saturation') && {
                          color: vitalsAlerts.find(a => a.vital === 'Oxygen Saturation')?.type === 'critical' 
                            ? colors.error 
                            : colors.warning
                        }
                      ]}>
                        {latestVitals.oxygenSaturation}%
                      </Text>
                    </View>
                  )}
                  {latestVitals.weight && (
                    <View style={styles.vitalItem}>
                      <Icon name="weight" size={20} />
                      <Text style={styles.vitalLabel}>Weight</Text>
                      <Text style={styles.vitalValue}>{latestVitals.weight} kg</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.noDataText}>No vitals recorded</Text>
              )}
            </GlassCard>

            {/* Active Problems */}
            <GlassCard style={styles.card} padding={spacing.lg}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Problems</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('ProblemList' as never, {
                      patientId: appointment.patient.id,
                    } as never)
                  }
                >
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              {problems.length > 0 ? (
                <View style={styles.listContainer}>
                  {problems.slice(0, 3).map((problem) => (
                    <View key={problem.id} style={styles.listItem}>
                      <Text style={styles.listItemText}>{problem.problem}</Text>
                      {problem.status && (
                        <Text style={styles.listItemStatus}>{problem.status}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>No active problems</Text>
              )}
            </GlassCard>

            {/* Allergies */}
            <GlassCard style={styles.card} padding={spacing.lg}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Allergies</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('Allergies' as never, {
                      patientId: appointment.patient.id,
                    } as never)
                  }
                >
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              {allergies.length > 0 ? (
                <View style={styles.listContainer}>
                  {allergies.slice(0, 3).map((allergy) => (
                    <View key={allergy.id} style={styles.listItem}>
                      <Text style={styles.listItemText}>{allergy.allergen}</Text>
                      {allergy.reaction && (
                        <Text style={styles.listItemSubtext}>{allergy.reaction}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>No known allergies</Text>
              )}
            </GlassCard>
          </>
        )}

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
                (navigation as any).navigate('CreatePrescription', {
                  patientId: appointment.patient.id,
                })
              }
              activeOpacity={0.7}
            >
              <Icon name="prescription" size={24} />
              <Text style={styles.quickActionText}>Prescribe</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() =>
                (navigation as any).navigate('LabOrder', {
                  patientId: appointment.patient.id,
                })
              }
              activeOpacity={0.7}
            >
              <Icon name="lab" size={24} />
              <Text style={styles.quickActionText}>Lab Order</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  vitalItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  vitalLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  vitalValue: {
    ...typography.h5,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  listContainer: {
    gap: spacing.sm,
  },
  listItem: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  listItemText: {
    ...typography.body,
    fontWeight: '600',
  },
  listItemStatus: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  listItemSubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  noDataText: {
    ...typography.body,
    color: colors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  viewAllText: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '600',
  },
  dangerAlertCard: {
    borderWidth: 3,
    borderColor: colors.error,
    backgroundColor: colors.error + '15',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dangerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.error,
  },
  dangerTitle: {
    ...typography.h3,
    color: colors.error,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  dangerBadge: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBadgeText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  dangerAlertItem: {
    padding: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
  },
  criticalDangerAlert: {
    borderColor: colors.error,
    backgroundColor: colors.error + '20',
    borderLeftWidth: 6,
    borderLeftColor: colors.error,
  },
  warningDangerAlert: {
    borderColor: colors.warning,
    backgroundColor: colors.warning + '20',
    borderLeftWidth: 6,
    borderLeftColor: colors.warning,
  },
  dangerAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  dangerAlertIcon: {
    fontSize: 24,
  },
  dangerAlertVital: {
    ...typography.h4,
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  dangerAlertMessage: {
    ...typography.bodyBold,
    fontSize: 15,
    marginBottom: spacing.md,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  dangerAlertDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dangerAlertValueLabel: {
    ...typography.label,
    fontSize: 13,
    color: colors.textSecondary,
  },
  dangerAlertValue: {
    ...typography.bodyBold,
    fontSize: 15,
    fontWeight: '800',
    color: colors.error,
  },
  dangerAlertNormalLabel: {
    ...typography.label,
    fontSize: 13,
    color: colors.textSecondary,
  },
  dangerAlertNormal: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
  },
});

export default VisitManagementScreen;

