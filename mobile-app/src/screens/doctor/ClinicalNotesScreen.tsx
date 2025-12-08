import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import clinicalNotesService from '../../services/clinical-notes.service';
import appointmentService from '../../services/appointment.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';

const ClinicalNotesScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { appointmentId, patientId } = route.params as { appointmentId?: string; patientId: string };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // SOAP Note fields
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [physicalExamination, setPhysicalExamination] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  useEffect(() => {
    loadExistingNotes();
  }, [appointmentId]);

  const loadExistingNotes = async () => {
    if (!appointmentId) return;

    try {
      setLoading(true);
      const appointment = await appointmentService.getAppointmentById(appointmentId);
      
      if (appointment?.notes) {
        try {
          const notes = typeof appointment.notes === 'string' 
            ? JSON.parse(appointment.notes) 
            : appointment.notes;
          
          const clinicalDoc = notes.clinicalDocumentation || {};
          setChiefComplaint(clinicalDoc.chiefComplaint || '');
          setHistoryOfPresentIllness(clinicalDoc.historyOfPresentIllness || '');
          setPhysicalExamination(clinicalDoc.physicalExamination || '');
          setAssessment(clinicalDoc.clinicalAssessment || '');
          setPlan(clinicalDoc.plan || '');
          setAdditionalNotes(notes.notes || clinicalDoc.additionalNotes || '');
        } catch (e) {
          // If notes is plain text, put it in additionalNotes
          setAdditionalNotes(appointment.notes);
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!appointmentId) {
      Alert.alert('Error', 'Appointment ID is required');
      return;
    }

    try {
      setSaving(true);
      
      await clinicalNotesService.updateAppointmentNotes(appointmentId, {
        clinicalDocumentation: {
          chiefComplaint,
          historyOfPresentIllness,
          physicalExamination,
          clinicalAssessment: assessment,
          plan,
          additionalNotes,
        },
        notes: additionalNotes,
      });

      Alert.alert('Success', 'Clinical notes saved successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', error.message || 'Failed to save clinical notes');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!appointmentId) return;
    
    try {
      setSaving(true);
      await clinicalNotesService.updateAppointmentNotes(appointmentId, {
        clinicalDocumentation: {
          chiefComplaint,
          historyOfPresentIllness,
          physicalExamination,
          clinicalAssessment: assessment,
          plan,
          additionalNotes,
        },
        notes: additionalNotes,
      });
      Alert.alert('Draft Saved', 'Your notes have been saved as draft');
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Clinical Notes" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScreenHeader title="Clinical Notes" subtitle="SOAP Documentation" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="stethoscope" size={24} />
            <Text style={styles.sectionTitle}>Subjective</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Chief Complaint</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter chief complaint..."
              placeholderTextColor={colors.textMuted}
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>History of Present Illness (HPI)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe the history of present illness..."
              placeholderTextColor={colors.textMuted}
              value={historyOfPresentIllness}
              onChangeText={setHistoryOfPresentIllness}
              multiline
              numberOfLines={6}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="chart" size={24} />
            <Text style={styles.sectionTitle}>Objective</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Physical Examination</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Document physical examination findings..."
              placeholderTextColor={colors.textMuted}
              value={physicalExamination}
              onChangeText={setPhysicalExamination}
              multiline
              numberOfLines={8}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="problem" size={24} />
            <Text style={styles.sectionTitle}>Assessment</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Clinical Assessment / Diagnosis</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Enter assessment and diagnosis..."
              placeholderTextColor={colors.textMuted}
              value={assessment}
              onChangeText={setAssessment}
              multiline
              numberOfLines={5}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="prescription" size={24} />
            <Text style={styles.sectionTitle}>Plan</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Treatment Plan</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Document treatment plan, medications, follow-up..."
              placeholderTextColor={colors.textMuted}
              value={plan}
              onChangeText={setPlan}
              multiline
              numberOfLines={6}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card} padding={spacing.lg}>
          <View style={styles.sectionHeader}>
            <Icon name="notes" size={24} />
            <Text style={styles.sectionTitle}>Additional Notes</Text>
          </View>
          
          <View style={styles.fieldContainer}>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Any additional notes or observations..."
              placeholderTextColor={colors.textMuted}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              multiline
              numberOfLines={4}
            />
          </View>
        </GlassCard>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.draftButton}
            onPress={handleSaveDraft}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Icon name="save" size={20} />
            <Text style={styles.draftButtonText}>Save Draft</Text>
          </TouchableOpacity>
          
          <PrimaryButton
            title="Save Notes"
            onPress={handleSave}
            disabled={saving}
            icon="check"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.primary,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
    color: colors.textSecondary,
  },
  textInput: {
    ...typography.body,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    minHeight: 50,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  draftButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default ClinicalNotesScreen;

