import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { format } from 'date-fns';
// Using custom CalendarPicker and TimePicker components
import appointmentService from '../../services/appointment.service';
import { useAlert } from '../../hooks/useAlert';
import { useToast } from '../../hooks/useToast';
import patientService, { Patient } from '../../services/patient.service';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import CalendarPicker from '../../components/shared/CalendarPicker';
import TimePicker from '../../components/shared/TimePicker';

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const CreateAppointmentScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  
  // Safely extract route params with null check
  const routeParams = route.params as {
    patientId?: string;
    selectedDate?: Date;
    selectedTime?: string;
  } | undefined;
  
  const patientId = routeParams?.patientId;
  const selectedDate = routeParams?.selectedDate;
  const selectedTime = routeParams?.selectedTime;

  // Patient search states
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const patientSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Doctor states
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Appointment states
  const [appointmentDate, setAppointmentDate] = useState(selectedDate || new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [appointmentType, setAppointmentType] = useState('consultation');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [recurringPattern, setRecurringPattern] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Beautiful alerts and toasts
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Load doctors on mount
  useEffect(() => {
    loadDoctors();
  }, []);

  // Auto-load patient if patientId is provided
  useEffect(() => {
    if (patientId && !selectedPatient) {
      loadPatientById(patientId);
    }
  }, [patientId]);

  // Auto-select doctor if user is a doctor
  useEffect(() => {
    if (user && (user as any).role === 'doctor' && !selectedDoctor) {
      setSelectedDoctor({
        id: (user as any).id,
        firstName: (user as any).firstName || '',
        lastName: (user as any).lastName || '',
        role: 'doctor',
      });
    }
  }, [user]);

  // Debounced patient search
  useEffect(() => {
    if (patientSearchTimeoutRef.current) {
      clearTimeout(patientSearchTimeoutRef.current);
    }

    if (patientSearchTerm.trim().length >= 2) {
      patientSearchTimeoutRef.current = setTimeout(() => {
        searchPatients(patientSearchTerm);
      }, 500);
    } else {
      setPatientResults([]);
      setShowPatientDropdown(false);
    }

    return () => {
      if (patientSearchTimeoutRef.current) {
        clearTimeout(patientSearchTimeoutRef.current);
      }
    };
  }, [patientSearchTerm]);

  const loadDoctors = async () => {
    try {
      setLoadingDoctors(true);
      const response = await ehrApi.get(API_ENDPOINTS.USERS.BY_ROLE('doctor'));
      const doctorsList = Array.isArray(response) ? response : (response.data || []);
      setDoctors(doctorsList);
      
      // If user is a doctor, auto-select them
      if (user && (user as any).role === 'doctor') {
        const currentUserDoctor = doctorsList.find((d: Doctor) => d.id === (user as any).id);
        if (currentUserDoctor) {
          setSelectedDoctor(currentUserDoctor);
        }
      }
    } catch (error: any) {
      console.error('Error loading doctors:', error);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadPatientById = async (id: string) => {
    try {
      setSearchingPatient(true);
      const foundPatient = await patientService.getPatientById(id);
      setSelectedPatient(foundPatient);
      setPatientSearchTerm(`${foundPatient.firstName} ${foundPatient.lastName}${foundPatient.patientNumber ? ` (${foundPatient.patientNumber})` : ''}`);
      setShowPatientDropdown(false);
    } catch (error: any) {
      console.error('Error loading patient:', error);
    } finally {
      setSearchingPatient(false);
    }
  };

  const searchPatients = async (query: string) => {
    if (query.trim().length < 2) {
      setPatientResults([]);
      setShowPatientDropdown(false);
      return;
    }

    try {
      setSearchingPatient(true);
      const results = await patientService.searchPatients(query);
      setPatientResults(results);
      setShowPatientDropdown(results.length > 0);
    } catch (error: any) {
      console.error('Error searching patients:', error);
      setPatientResults([]);
      setShowPatientDropdown(false);
    } finally {
      setSearchingPatient(false);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearchTerm(`${patient.firstName} ${patient.lastName}${patient.patientNumber ? ` (${patient.patientNumber})` : ''}`);
    setShowPatientDropdown(false);
    setPatientResults([]);
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowDoctorDropdown(false);
  };

  const filterDoctors = () => {
    if (!doctorSearchTerm.trim()) {
      return doctors;
    }
    return doctors.filter(doctor =>
      `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(doctorSearchTerm.toLowerCase())
    );
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      showToast('Please select a patient', 'error', 'Missing Patient');
      return;
    }

    if (!selectedDoctor) {
      showToast('Please select a doctor', 'error', 'Missing Doctor');
      return;
    }

    if (!appointmentDate) {
      showToast('Please select appointment date and time', 'error', 'Missing Date/Time');
      return;
    }

    try {
      setLoading(true);
      // Remove feeAmount - backend will auto-generate it
      const appointmentData = {
        patientId: selectedPatient.id,
        doctorId: selectedDoctor.id,
        appointmentDate: appointmentDate.toISOString(),
        durationMinutes: parseInt(durationMinutes) || 30,
        appointmentType: appointmentType.toLowerCase(),
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        // feeAmount is removed - backend handles it automatically
        recurringPattern: recurringPattern || undefined,
      };

      await appointmentService.createAppointment(appointmentData);
      
      // Beautiful success alert
      showAlert(
        'Appointment Created! 🎉',
        `Appointment scheduled successfully for ${selectedPatient.firstName} ${selectedPatient.lastName} on ${format(appointmentDate, 'EEEE, MMMM d, yyyy')} at ${format(appointmentDate, 'h:mm a')}`,
        'success',
        {
          confirmText: 'Done',
          onConfirm: () => navigation.goBack(),
        }
      );
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      showAlert(
        'Failed to Create Appointment',
        error.response?.data?.message || error.message || 'An error occurred while creating the appointment. Please try again.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const appointmentTypes = ['consultation', 'follow-up', 'check-up', 'procedure', 'emergency', 'telemedicine'];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Create Appointment" subtitle="Schedule a new appointment" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Patient Search */}
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Patient *</Text>
            {!selectedPatient ? (
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Search by name or patient ID (min 2 characters)"
                  placeholderTextColor={colors.textTertiary}
                  value={patientSearchTerm}
                  onChangeText={(text) => {
                    setPatientSearchTerm(text);
                    setSelectedPatient(null);
                  }}
                  onFocus={() => {
                    if (patientResults.length > 0) {
                      setShowPatientDropdown(true);
                    }
                  }}
                />
                {searchingPatient && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={styles.searchIndicator}
                  />
                )}
                {showPatientDropdown && patientResults.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView
                      style={styles.dropdownList}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {patientResults.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.dropdownItem}
                          onPress={() => handlePatientSelect(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownItemName}>
                            {item.firstName} {item.lastName}
                          </Text>
                          {item.patientNumber && (
                            <Text style={styles.dropdownItemSubtext}>ID: {item.patientNumber}</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.selectedCard}>
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedName}>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </Text>
                  {selectedPatient.patientNumber && (
                    <Text style={styles.selectedSubtext}>ID: {selectedPatient.patientNumber}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => {
                    setSelectedPatient(null);
                    setPatientSearchTerm('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>

          {/* Doctor Selection */}
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Doctor *</Text>
            {!selectedDoctor ? (
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Search for doctor"
                  placeholderTextColor={colors.textTertiary}
                  value={doctorSearchTerm}
                  onChangeText={(text) => {
                    setDoctorSearchTerm(text);
                    setShowDoctorDropdown(true);
                  }}
                  onFocus={() => setShowDoctorDropdown(true)}
                />
                {loadingDoctors && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={styles.searchIndicator}
                  />
                )}
                {showDoctorDropdown && filterDoctors().length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView
                      style={styles.dropdownList}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {filterDoctors().map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.dropdownItem}
                          onPress={() => handleDoctorSelect(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownItemName}>
                            Dr. {item.firstName} {item.lastName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.selectedCard}>
                <View style={styles.selectedInfo}>
                  <Text style={styles.selectedName}>
                    Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => {
                    setSelectedDoctor(null);
                    setDoctorSearchTerm('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>

          {/* Date & Time */}
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time *</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateTimeLabel}>Date</Text>
              <Text style={styles.dateTimeValue}>{format(appointmentDate, 'EEEE, MMMM d, yyyy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateTimeLabel}>Time</Text>
              <Text style={styles.dateTimeValue}>{format(appointmentDate, 'h:mm a')}</Text>
            </TouchableOpacity>

          </GlassCard>

          {/* Appointment Details */}
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment Details</Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.input}
                placeholder="30"
                placeholderTextColor={colors.textTertiary}
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Appointment Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                {appointmentTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      appointmentType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setAppointmentType(type)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        appointmentType === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Reason for Visit</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter reason for visit"
                placeholderTextColor={colors.textTertiary}
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional notes"
                placeholderTextColor={colors.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </GlassCard>

          {/* Recurring Appointment */}
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Recurring Appointment (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
              {['', 'daily', 'weekly', 'monthly'].map((pattern) => (
                <TouchableOpacity
                  key={pattern || 'none'}
                  style={[
                    styles.typeButton,
                    recurringPattern === pattern && styles.typeButtonActive,
                  ]}
                  onPress={() => setRecurringPattern(pattern)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      recurringPattern === pattern && styles.typeButtonTextActive,
                    ]}
                  >
                    {pattern ? pattern.charAt(0).toUpperCase() + pattern.slice(1) : 'None'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </GlassCard>

          {/* Submit Button */}
          <PrimaryButton
            title="Create Appointment"
            onPress={handleSubmit}
            loading={loading}
            icon="✓"
            style={styles.submitButton}
          />
        </Animated.View>
      </ScrollView>

      {/* Calendar and Time Pickers - Outside ScrollView to avoid blocking */}
      {showDatePicker && (
        <CalendarPicker
          selectedDate={appointmentDate}
          onDateSelect={(date) => {
            const newDate = new Date(appointmentDate);
            newDate.setFullYear(date.getFullYear());
            newDate.setMonth(date.getMonth());
            newDate.setDate(date.getDate());
            setAppointmentDate(newDate);
            setShowDatePicker(false);
          }}
          minimumDate={new Date()}
          onClose={() => setShowDatePicker(false)}
        />
      )}
      {showTimePicker && (
        <TimePicker
          selectedTime={{
            hours: appointmentDate.getHours(),
            minutes: appointmentDate.getMinutes(),
          }}
          onTimeSelect={(hours, minutes) => {
            const newDate = new Date(appointmentDate);
            newDate.setHours(hours);
            newDate.setMinutes(minutes);
            setAppointmentDate(newDate);
            setShowTimePicker(false);
          }}
          onClose={() => setShowTimePicker(false)}
        />
      )}

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
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  searchContainer: {
    position: 'relative',
  },
  inputWrapper: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  searchIndicator: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md + 4,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    backgroundColor: colors.backgroundSecondary, // Solid background for better readability
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    maxHeight: 200,
    zIndex: 1000,
    ...shadows.lg,
    opacity: 1, // Fully opaque
  },
  dropdownList: {
    maxHeight: 200,
    backgroundColor: 'transparent',
  },
  dropdownItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    backgroundColor: 'transparent', // Transparent within the dropdown container
  },
  dropdownItemName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  dropdownItemSubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  selectedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  selectedSubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  changeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  changeButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  dateTimeButton: {
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dateTimeLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  dateTimeValue: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  dateTimeInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  dateTimeInput: {
    flex: 1,
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  dateTimeInputButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  dateTimeInputButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  typeSelector: {
    marginTop: spacing.sm,
  },
  typeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginRight: spacing.sm,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: colors.textPrimary,
  },
  submitButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});

export default CreateAppointmentScreen;
