import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import vitalsService, { Vitals } from '../../services/vitals.service';
import { useToast } from '../../hooks/useToast';

const VitalsScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { showToast, ToastComponent } = useToast();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [temperature, setTemperature] = useState('');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState('');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [bmi, setBmi] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Get patientId from route params if available
    const params = route.params as { patientId?: string } | undefined;
    if (params?.patientId) {
      setPatientId(params.patientId);
    }
  }, [route.params]);

  // Calculate BMI when weight or height changes
  useEffect(() => {
    if (weight && height) {
      const weightNum = parseFloat(weight);
      const heightNum = parseFloat(height);
      if (weightNum > 0 && heightNum > 0) {
        const heightInMeters = heightNum / 100; // Convert cm to meters
        const calculatedBmi = weightNum / (heightInMeters * heightInMeters);
        setBmi(parseFloat(calculatedBmi.toFixed(1)));
      } else {
        setBmi(null);
      }
    } else {
      setBmi(null);
    }
  }, [weight, height]);

  const handleSave = async () => {
    if (!patientId) {
      Alert.alert('Error', 'Patient ID is required');
      return;
    }

    // Get current user ID for recordedBy field
    const currentUserId = (user as any)?.id || (user as any)?.user?.id;
    if (!currentUserId) {
      Alert.alert('Error', 'User information not available. Please log in again.');
      return;
    }

    // Validate at least one vital sign is entered
    if (
      !temperature &&
      !bloodPressureSystolic &&
      !bloodPressureDiastolic &&
      !heartRate &&
      !respiratoryRate &&
      !oxygenSaturation &&
      !weight &&
      !height &&
      !bloodGlucose
    ) {
      Alert.alert('Validation Error', 'Please enter at least one vital sign');
      return;
    }
    
    // Validate BP: if one is entered, both should ideally be entered (but allow partial)
    if (bloodPressureSystolic && !bloodPressureDiastolic) {
      // Allow systolic only, but warn
      console.warn('⚠️ Only systolic BP entered');
    }
    if (bloodPressureDiastolic && !bloodPressureSystolic) {
      // Allow diastolic only, but warn
      console.warn('⚠️ Only diastolic BP entered');
    }

    try {
      setSaving(true);
      
      const vitalsData: Vitals = {
        patientId,
        recordedBy: currentUserId, // Required field - user who recorded the vitals
        temperature: temperature ? parseFloat(temperature) : undefined,
        bloodPressureSystolic: bloodPressureSystolic ? parseFloat(bloodPressureSystolic) : undefined,
        bloodPressureDiastolic: bloodPressureDiastolic ? parseFloat(bloodPressureDiastolic) : undefined,
        heartRate: heartRate ? parseFloat(heartRate) : undefined,
        respiratoryRate: respiratoryRate ? parseFloat(respiratoryRate) : undefined,
        oxygenSaturation: oxygenSaturation ? parseFloat(oxygenSaturation) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        height: height ? parseFloat(height) : undefined,
        bmi: bmi || undefined,
        bloodGlucose: bloodGlucose ? parseFloat(bloodGlucose) : undefined,
        notes: notes || undefined,
        recordedAt: new Date().toISOString(),
      };

      await vitalsService.recordVitals(vitalsData);
      
      showToast('Vitals recorded successfully', 'success', 'Success');
      
      // Clear form
      setTemperature('');
      setBloodPressureSystolic('');
      setBloodPressureDiastolic('');
      setHeartRate('');
      setRespiratoryRate('');
      setOxygenSaturation('');
      setWeight('');
      setHeight('');
      setBloodGlucose('');
      setBmi(null);
      setNotes('');
      
      // Navigate back after a short delay
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (error: any) {
      console.error('Error recording vitals:', error);
      const errorMessage = error.message || 'Failed to record vitals. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!patientId) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Record Vitals" subtitle="Record patient vital signs" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>Select a Patient</Text>
              <Text style={styles.emptySubtitle}>
                Please select a patient to record vital signs
              </Text>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Record Vitals" subtitle="Enter patient vital signs" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.formCard} padding={spacing.lg}>
            <Text style={styles.sectionTitle}>Vital Signs</Text>
            
            {/* Temperature */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Temperature (°C)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 36.5"
                value={temperature}
                onChangeText={setTemperature}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Blood Pressure */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Blood Pressure (mmHg)</Text>
              <View style={styles.bpRow}>
                <TextInput
                  style={[styles.input, styles.bpInput]}
                  placeholder="Systolic"
                  value={bloodPressureSystolic}
                  onChangeText={setBloodPressureSystolic}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.bpSeparator}>/</Text>
                <TextInput
                  style={[styles.input, styles.bpInput]}
                  placeholder="Diastolic"
                  value={bloodPressureDiastolic}
                  onChangeText={setBloodPressureDiastolic}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            {/* Heart Rate */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Heart Rate (bpm)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 72"
                value={heartRate}
                onChangeText={setHeartRate}
                keyboardType="number-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Respiratory Rate */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Respiratory Rate (per min)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 16"
                value={respiratoryRate}
                onChangeText={setRespiratoryRate}
                keyboardType="number-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Oxygen Saturation */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Oxygen Saturation (SpO2 %)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 98"
                value={oxygenSaturation}
                onChangeText={setOxygenSaturation}
                keyboardType="number-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Weight */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 70.5"
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Height */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 175"
                value={height}
                onChangeText={setHeight}
                keyboardType="number-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* BMI - Auto-calculated */}
            {bmi !== null && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>BMI (Body Mass Index)</Text>
                <View style={styles.bmiContainer}>
                  <Text style={styles.bmiValue}>{bmi}</Text>
                  <Text style={styles.bmiCategory}>
                    {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'}
                  </Text>
                </View>
              </View>
            )}

            {/* Blood Glucose */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Blood Glucose (mg/dL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 95"
                value={bloodGlucose}
                onChangeText={setBloodGlucose}
                keyboardType="number-pad"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional notes..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textTertiary}
                textAlignVertical="top"
              />
            </View>

            <PrimaryButton
              title={saving ? 'Saving...' : 'Save Vitals'}
              onPress={handleSave}
              disabled={saving}
              icon={saving ? undefined : '💾'}
            />
          </GlassCard>
        </Animated.View>
      </ScrollView>
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
    paddingBottom: spacing.xl,
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
  },
  bpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bpInput: {
    flex: 1,
  },
  bpSeparator: {
    ...typography.h4,
    color: colors.textSecondary,
    marginHorizontal: spacing.sm,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },
  bmiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  bmiValue: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  bmiCategory: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default VitalsScreen;
