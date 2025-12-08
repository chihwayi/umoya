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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import prescriptionService from '../../services/prescription.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const CreatePrescriptionScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSubmit = async () => {
    if (!medication || !dosage || !frequency || !duration) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await prescriptionService.createPrescription({
        patientId,
        medicationId: medication,
        dosage,
        frequency,
        duration,
        instructions: instructions || undefined,
        quantity: quantity ? parseInt(quantity) : undefined,
      });

      Alert.alert('Success', 'Prescription created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create prescription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="New Prescription" subtitle="Create a new medication prescription" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.form} padding={spacing.lg}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Medication *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>💊</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter medication name"
                  placeholderTextColor={colors.textTertiary}
                  value={medication}
                  onChangeText={setMedication}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Dosage *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📏</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 500mg"
                  placeholderTextColor={colors.textTertiary}
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>⏰</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Twice daily"
                  placeholderTextColor={colors.textTertiary}
                  value={frequency}
                  onChangeText={setFrequency}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Duration *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📅</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 7 days"
                  placeholderTextColor={colors.textTertiary}
                  value={duration}
                  onChangeText={setDuration}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantity</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔢</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Number of tablets/capsules"
                  placeholderTextColor={colors.textTertiary}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instructions</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Additional instructions for patient"
                  placeholderTextColor={colors.textTertiary}
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>

            <PrimaryButton
              title="Create Prescription"
              onPress={handleSubmit}
              loading={loading}
              icon="💊"
            />
          </GlassCard>
        </Animated.View>
      </ScrollView>
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
  form: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
});

export default CreatePrescriptionScreen;
