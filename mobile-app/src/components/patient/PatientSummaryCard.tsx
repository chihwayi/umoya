import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import problemService from '../../services/problem.service';
import allergyService from '../../services/allergy.service';
import vitalsService from '../../services/vitals.service';
import prescriptionService from '../../services/prescription.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import GlassCard from '../shared/GlassCard';
import Icon from '../shared/Icon';

interface PatientSummaryCardProps {
  patientId: string;
  patient: {
    firstName: string;
    lastName: string;
    patientNumber?: string;
    dateOfBirth?: string;
    gender?: string;
  };
}

const PatientSummaryCard: React.FC<PatientSummaryCardProps> = ({ patientId, patient }) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    activeProblems: 0,
    allergies: 0,
    criticalAllergies: 0,
    latestVitals: null as any,
    activePrescriptions: 0,
    alerts: [] as Array<{ type: 'critical' | 'warning' | 'info'; message: string }>,
  });

  useEffect(() => {
    loadSummary();
  }, [patientId]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const [problems, allergies, vitals, prescriptions] = await Promise.allSettled([
        problemService.getPatientProblems(patientId),
        allergyService.getPatientAllergies(patientId),
        vitalsService.getPatientVitals(patientId),
        prescriptionService.getActivePrescriptions(patientId),
      ]);

      const activeProblems = problems.status === 'fulfilled' 
        ? problems.value.filter((p) => p.status === 'active').length 
        : 0;
      
      const allergiesList = allergies.status === 'fulfilled' ? allergies.value : [];
      const criticalAllergies = allergiesList.filter((a) => a.severity === 'severe').length;
      
      const latestVitals = vitals.status === 'fulfilled' && vitals.value.length > 0
        ? vitals.value[0]
        : null;
      
      const activePrescriptions = prescriptions.status === 'fulfilled' ? prescriptions.value.length : 0;

      // Generate alerts
      const alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string }> = [];
      
      if (criticalAllergies > 0) {
        alerts.push({
          type: 'critical',
          message: `${criticalAllergies} severe allerg${criticalAllergies > 1 ? 'ies' : 'y'} recorded`,
        });
      }
      
      if (activeProblems > 5) {
        alerts.push({
          type: 'warning',
          message: `${activeProblems} active problems`,
        });
      }
      
      if (latestVitals) {
        // Check for abnormal vitals
        if (latestVitals.bloodPressureSystolic && latestVitals.bloodPressureSystolic > 180) {
          alerts.push({
            type: 'critical',
            message: 'High blood pressure detected',
          });
        }
        if (latestVitals.temperature && latestVitals.temperature > 38.5) {
          alerts.push({
            type: 'warning',
            message: 'Elevated temperature',
          });
        }
      }

      setSummary({
        activeProblems,
        allergies: allergiesList.length,
        criticalAllergies,
        latestVitals,
        activePrescriptions,
        alerts,
      });
    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical':
        return colors.error;
      case 'warning':
        return colors.warning;
      default:
        return colors.info;
    }
  };

  if (loading) {
    return (
      <GlassCard style={styles.card} padding={spacing.lg}>
        <ActivityIndicator size="small" color={colors.primary} />
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.card} padding={spacing.lg}>
      <View style={styles.header}>
        <View>
          <Text style={styles.patientName}>
            {patient.firstName} {patient.lastName}
          </Text>
          {patient.patientNumber && (
            <Text style={styles.patientId}>ID: {patient.patientNumber}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ChartReview' as never, { patientId } as never)}
          style={styles.chartButton}
        >
          <Icon name="chart" size={20} />
        </TouchableOpacity>
      </View>

      {/* Critical Alerts */}
      {summary.alerts.length > 0 && (
        <View style={styles.alertsContainer}>
          {summary.alerts.map((alert, index) => (
            <View
              key={index}
              style={[
                styles.alertBadge,
                { backgroundColor: getAlertColor(alert.type) + '20', borderColor: getAlertColor(alert.type) },
              ]}
            >
              <Icon name="alert" size={16} />
              <Text style={[styles.alertText, { color: getAlertColor(alert.type) }]}>
                {alert.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('ProblemList' as never, { patientId } as never)}
        >
          <Text style={styles.statNumber}>{summary.activeProblems}</Text>
          <Text style={styles.statLabel}>Problems</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('Allergies' as never, { patientId } as never)}
        >
          <View style={styles.statHeader}>
            <Text style={styles.statNumber}>{summary.allergies}</Text>
            {summary.criticalAllergies > 0 && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalBadgeText}>{summary.criticalAllergies}</Text>
              </View>
            )}
          </View>
          <Text style={styles.statLabel}>Allergies</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('PrescriptionHistory' as never, { patientId } as never)}
        >
          <Text style={styles.statNumber}>{summary.activePrescriptions}</Text>
          <Text style={styles.statLabel}>Medications</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('Vitals' as never, { patientId } as never)}
        >
          {summary.latestVitals ? (
            <>
              <Text style={styles.statNumber}>
                {summary.latestVitals.bloodPressureSystolic || '--'}/{summary.latestVitals.bloodPressureDiastolic || '--'}
              </Text>
              <Text style={styles.statLabel}>BP (Latest)</Text>
            </>
          ) : (
            <>
              <Icon name="vitals" size={24} />
              <Text style={styles.statLabel}>No Vitals</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('ClinicalNotes' as never, { patientId } as never)}
        >
          <Icon name="notes" size={20} />
          <Text style={styles.quickActionText}>Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('LabResultsDashboard' as never, { patientId } as never)}
        >
          <Icon name="lab" size={20} />
          <Text style={styles.quickActionText}>Labs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
        >
          <Icon name="prescription" size={20} />
          <Text style={styles.quickActionText}>Prescribe</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('CreateAppointment' as never, { patientId } as never)}
        >
          <Icon name="calendar" size={20} />
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  patientName: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  patientId: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  chartButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsContainer: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  alertText: {
    ...typography.bodySmall,
    fontWeight: '600',
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    width: '47%',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statNumber: {
    ...typography.h4,
    color: colors.primary,
  },
  statLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  criticalBadge: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  criticalBadgeText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 10,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  quickAction: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickActionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

export default PatientSummaryCard;

