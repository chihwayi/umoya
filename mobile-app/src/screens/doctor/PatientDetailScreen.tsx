import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import patientService, { Patient } from '../../services/patient.service';
import prescriptionService from '../../services/prescription.service';
import labService from '../../services/lab.service';
import vitalsService, { Vitals } from '../../services/vitals.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import PatientSummaryCard from '../../components/patient/PatientSummaryCard';
import Icon from '../../components/shared/Icon';

const PatientDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };
  const { user } = useSelector((state: RootState) => state.auth);
  
  // Determine user role - check multiple possible locations
  const userRole = (user as any)?.role || (user as any)?.user?.role || (user as any)?.userRole || 'doctor';
  const roleLower = String(userRole || '').toLowerCase();
  const isNurse = roleLower === 'nurse';
  const isDoctor = roleLower === 'doctor';
  
  // Debug logging - ALWAYS log to help troubleshoot
  console.log('👤 PatientDetailScreen - Full user object:', JSON.stringify(user, null, 2));
  console.log('👤 PatientDetailScreen - User role:', userRole, 'roleLower:', roleLower, 'isNurse:', isNurse, 'isDoctor:', isDoctor);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activePrescriptions, setActivePrescriptions] = useState<any[]>([]);
  const [recentLabs, setRecentLabs] = useState<any[]>([]);
  const [latestVitals, setLatestVitals] = useState<Vitals | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPatientData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const [patientData, prescriptions, labs] = await Promise.allSettled([
        patientService.getPatientProfile(patientId),
        prescriptionService.getActivePrescriptions(patientId),
        labService.getPatientLabResults(patientId),
      ]);
      
      // Load vitals separately
      try {
        setLoadingVitals(true);
        const vitals = await vitalsService.getLatestVitals(patientId);
        setLatestVitals(vitals);
      } catch (error) {
        console.error('Error loading vitals:', error);
        setLatestVitals(null);
      } finally {
        setLoadingVitals(false);
      }

      if (patientData.status === 'fulfilled') {
        setPatient(patientData.value);
      } else {
        console.error('Error loading patient:', patientData.reason);
      }

      if (prescriptions.status === 'fulfilled') {
        setActivePrescriptions(prescriptions.value || []);
      } else {
        console.error('Error loading prescriptions:', prescriptions.reason);
        // Don't show error to user - just show empty state
        // The prescription service already returns [] on error
        setActivePrescriptions([]);
      }

      if (labs.status === 'fulfilled') {
        setRecentLabs(Array.isArray(labs.value) ? labs.value.slice(0, 5) : []);
      } else {
        console.error('Error loading labs:', labs.reason);
        setRecentLabs([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Patient Details" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Patient Details" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Patient not found</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={patient.patientNumber ? `ID: ${patient.patientNumber}` : undefined}
      />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Enhanced Patient Summary Card */}
        <PatientSummaryCard patientId={patientId} patient={patient} />

        {/* Latest Vitals - Show for both nurses and doctors */}
        <GlassCard style={styles.section} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Vitals</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Vitals' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButton}>
                {latestVitals ? 'Update' : 'Record'}
              </Text>
            </TouchableOpacity>
          </View>
          {loadingVitals ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : latestVitals ? (
            <View style={styles.vitalsGrid}>
              {latestVitals.temperature && (
                <View style={styles.vitalItem}>
                  <Icon name="thermometer" size={20} />
                  <Text style={styles.vitalLabel}>Temp</Text>
                  <Text style={styles.vitalValue}>{latestVitals.temperature}°C</Text>
                </View>
              )}
              {(latestVitals.bloodPressureSystolic || latestVitals.bloodPressureDiastolic) && (
                <View style={styles.vitalItem}>
                  <Icon name="blood-pressure" size={20} />
                  <Text style={styles.vitalLabel}>BP</Text>
                  <Text style={styles.vitalValue}>
                    {latestVitals.bloodPressureSystolic || '--'}/{latestVitals.bloodPressureDiastolic || '--'}
                  </Text>
                </View>
              )}
              {latestVitals.heartRate && (
                <View style={styles.vitalItem}>
                  <Icon name="heart-pulse" size={20} />
                  <Text style={styles.vitalLabel}>HR</Text>
                  <Text style={styles.vitalValue}>{latestVitals.heartRate} bpm</Text>
                </View>
              )}
              {latestVitals.oxygenSaturation && (
                <View style={styles.vitalItem}>
                  <Icon name="lungs" size={20} />
                  <Text style={styles.vitalLabel}>SpO2</Text>
                  <Text style={styles.vitalValue}>{latestVitals.oxygenSaturation}%</Text>
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
            <View style={styles.emptyVitalsContainer}>
              <Text style={styles.emptyVitalsText}>No vitals recorded</Text>
              <TouchableOpacity
                style={styles.recordVitalsButton}
                onPress={() => navigation.navigate('Vitals' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.recordVitalsButtonText}>Record Vitals</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.section} padding={spacing.lg}>
          <Text style={styles.sectionTitle}>Demographics</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date of Birth:</Text>
            <Text style={styles.infoValue}>{patient.dateOfBirth}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender:</Text>
            <Text style={styles.infoValue}>{patient.gender}</Text>
          </View>
          {patient.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{patient.phone}</Text>
            </View>
          )}
          {patient.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{patient.email}</Text>
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.section} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Prescriptions</Text>
            {isDoctor && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButton}>+ Prescribe</Text>
              </TouchableOpacity>
            )}
          </View>
          {activePrescriptions.length > 0 ? (
            activePrescriptions.map((prescription) => (
              <View key={prescription.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{prescription.medication}</Text>
                <Text style={styles.itemSubtitle}>
                  {prescription.dosage} - {prescription.frequency}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active prescriptions</Text>
          )}
        </GlassCard>

        <GlassCard style={styles.section} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Lab Results</Text>
            {isDoctor && (
              <TouchableOpacity
                onPress={() => navigation.navigate('LabOrder' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButton}>+ Order Lab</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentLabs.length > 0 ? (
            recentLabs.map((lab) => (
              <View key={lab.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{lab.testName}</Text>
                <Text style={styles.itemSubtitle}>
                  {lab.value} {lab.unit} - {lab.status}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent lab results</Text>
          )}
        </GlassCard>

        {/* Quick Actions - Different for Nurses vs Doctors */}
        <GlassCard style={styles.section} padding={spacing.lg}>
          <Text style={styles.sectionTitle}>
            {isNurse ? 'Quick Actions' : 'Clinical Documentation'}
          </Text>
          <View style={styles.quickActionsGrid}>
            {isNurse && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('Vitals' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickActionIcon}>🩺</Text>
                <Text style={styles.quickActionText}>Record Vitals</Text>
              </TouchableOpacity>
            )}
            {isNurse && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('MAR' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickActionIcon}>💉</Text>
                <Text style={styles.quickActionText}>Medication Administration Record</Text>
              </TouchableOpacity>
            )}
            {isDoctor && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('ClinicalNotes' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickActionIcon}>📝</Text>
                <Text style={styles.quickActionText}>Clinical Notes</Text>
              </TouchableOpacity>
            )}
            {isDoctor && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('ProblemList' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickActionIcon}>⚠️</Text>
                <Text style={styles.quickActionText}>Problems</Text>
              </TouchableOpacity>
            )}
            {isDoctor && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('Allergies' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickActionIcon}>🚨</Text>
                <Text style={styles.quickActionText}>Allergies</Text>
              </TouchableOpacity>
            )}
            {isDoctor && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('ChartReview' as never, { patientId } as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickActionIcon}>📋</Text>
                <Text style={styles.quickActionText}>Chart Review</Text>
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>

        {/* Actions - Only show for doctors, nurses use Quick Actions above */}
        {isDoctor && (
          <View style={styles.actions}>
            <PrimaryButton
              title="Create Appointment"
              onPress={() => navigation.navigate('CreateAppointment' as never, { patientId } as never)}
              icon="📅"
            />
            <PrimaryButton
              title="Prescribe Medication"
              onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
              icon="💊"
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('LabOrder' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Order Lab Test</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* For nurses, show Schedule Appointment option */}
        {isNurse && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('CreateAppointment' as never, { patientId } as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Schedule Appointment</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  content: {
    padding: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.label,
    width: 120,
    color: colors.textTertiary,
  },
  infoValue: {
    ...typography.body,
    flex: 1,
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  actionButton: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  vitalItem: {
    width: '47%',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
  },
  vitalLabel: {
    ...typography.label,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  vitalValue: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  emptyVitalsContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyVitalsText: {
    ...typography.body,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  recordVitalsButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  recordVitalsButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  quickActionsGrid: {
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
  quickActionIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  quickActionText: {
    ...typography.bodySmall,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PatientDetailScreen;
