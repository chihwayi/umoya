import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import allergyService, { Allergy } from '../../services/allergy.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';

const AllergiesScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [loading, setLoading] = useState(true);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);
  
  // Form state
  const [allergen, setAllergen] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [notes, setNotes] = useState('');

  const commonAllergens = [
    'Penicillin',
    'Aspirin',
    'Ibuprofen',
    'Sulfa drugs',
    'Latex',
    'Peanuts',
    'Shellfish',
    'Eggs',
    'Dairy',
    'Codeine',
    'Morphine',
  ];

  useEffect(() => {
    loadAllergies();
  }, [patientId]);

  const loadAllergies = async () => {
    try {
      setLoading(true);
      const data = await allergyService.getPatientAllergies(patientId);
      setAllergies(data);
    } catch (error) {
      console.error('Error loading allergies:', error);
      Alert.alert('Error', 'Failed to load allergies');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllergy = () => {
    setEditingAllergy(null);
    setAllergen('');
    setReaction('');
    setSeverity('moderate');
    setNotes('');
    setShowAddModal(true);
  };

  const handleEditAllergy = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setAllergen(allergy.allergen);
    setReaction(allergy.reaction || '');
    setSeverity(allergy.severity || 'moderate');
    setNotes(allergy.notes || '');
    setShowAddModal(true);
  };

  const handleSaveAllergy = async () => {
    if (!allergen.trim()) {
      Alert.alert('Error', 'Please enter an allergen');
      return;
    }

    try {
      if (editingAllergy) {
        await allergyService.updateAllergy(patientId, editingAllergy.id!, {
          allergen,
          reaction,
          severity,
          notes,
        });
      } else {
        await allergyService.addAllergy(patientId, {
          allergen,
          reaction,
          severity,
          notes,
          onsetDate: new Date().toISOString().split('T')[0],
        });
      }
      
      setShowAddModal(false);
      loadAllergies();
      Alert.alert('Success', editingAllergy ? 'Allergy updated' : 'Allergy added');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save allergy');
    }
  };

  const handleDeleteAllergy = async (allergyId: string) => {
    Alert.alert(
      'Delete Allergy',
      'Are you sure you want to delete this allergy?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await allergyService.deleteAllergy(patientId, allergyId);
              loadAllergies();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete allergy');
            }
          },
        },
      ]
    );
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'severe':
        return colors.error;
      case 'moderate':
        return colors.warning;
      case 'mild':
        return colors.info;
      default:
        return colors.textTertiary;
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'severe':
        return '🚨';
      case 'moderate':
        return '⚠️';
      case 'mild':
        return 'ℹ️';
      default:
        return '📋';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Allergies" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Allergies"
        subtitle="Critical Safety Information"
        rightAction={
          <TouchableOpacity onPress={handleAddAllergy} activeOpacity={0.7}>
            <Icon name="add" size={24} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {allergies.length > 0 ? (
          allergies.map((allergy) => (
            <GlassCard key={allergy.id} style={styles.allergyCard} padding={spacing.md}>
              <View style={styles.allergyHeader}>
                <View style={styles.allergyContent}>
                  <View style={styles.allergyTitleRow}>
                    <Text style={styles.allergyName}>{allergy.allergen}</Text>
                    <View
                      style={[
                        styles.severityBadge,
                        { backgroundColor: getSeverityColor(allergy.severity) + '20' },
                      ]}
                    >
                      <Text style={styles.severityIcon}>
                        {getSeverityIcon(allergy.severity)}
                      </Text>
                      <Text
                        style={[
                          styles.severityText,
                          { color: getSeverityColor(allergy.severity) },
                        ]}
                      >
                        {allergy.severity?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  </View>
                  {allergy.reaction && (
                    <Text style={styles.allergyReaction}>
                      Reaction: {allergy.reaction}
                    </Text>
                  )}
                  {allergy.notes && (
                    <Text style={styles.allergyNotes}>{allergy.notes}</Text>
                  )}
                  {allergy.onsetDate && (
                    <Text style={styles.allergyDate}>
                      Recorded: {new Date(allergy.onsetDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={styles.allergyActions}>
                  <TouchableOpacity
                    onPress={() => handleEditAllergy(allergy)}
                    style={styles.actionButton}
                  >
                    <Icon name="edit" size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteAllergy(allergy.id!)}
                    style={styles.actionButton}
                  >
                    <Icon name="delete" size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          ))
        ) : (
          <GlassCard style={styles.emptyCard} padding={spacing.xl}>
            <Icon name="allergy" size={48} />
            <Text style={styles.emptyText}>No allergies recorded</Text>
            <Text style={styles.emptySubtext}>
              Tap + to add an allergy. This is critical safety information.
            </Text>
          </GlassCard>
        )}

        <PrimaryButton
          title="Add Allergy"
          onPress={handleAddAllergy}
          icon="add"
        />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalContent} padding={spacing.lg}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAllergy ? 'Edit Allergy' : 'Add Allergy'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Allergen *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter allergen name..."
                placeholderTextColor={colors.textMuted}
                value={allergen}
                onChangeText={setAllergen}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.commonAllergens}>
                {commonAllergens.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.commonAllergenTag}
                    onPress={() => setAllergen(item)}
                  >
                    <Text style={styles.commonAllergenText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Severity *</Text>
              <View style={styles.severityButtons}>
                {(['mild', 'moderate', 'severe'] as const).map((sev) => (
                  <TouchableOpacity
                    key={sev}
                    style={[
                      styles.severityButton,
                      severity === sev && [
                        styles.severityButtonActive,
                        { borderColor: getSeverityColor(sev) },
                      ],
                    ]}
                    onPress={() => setSeverity(sev)}
                  >
                    <Text style={styles.severityButtonIcon}>
                      {getSeverityIcon(sev)}
                    </Text>
                    <Text
                      style={[
                        styles.severityButtonText,
                        severity === sev && { color: getSeverityColor(sev) },
                      ]}
                    >
                      {sev.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Reaction (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Describe the reaction..."
                placeholderTextColor={colors.textMuted}
                value={reaction}
                onChangeText={setReaction}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Additional notes..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                title="Save"
                onPress={handleSaveAllergy}
                icon="check"
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
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
  allergyCard: {
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  allergyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  allergyContent: {
    flex: 1,
  },
  allergyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  allergyName: {
    ...typography.h5,
    flex: 1,
    marginRight: spacing.sm,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  severityIcon: {
    fontSize: 14,
  },
  severityText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  allergyReaction: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  allergyNotes: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  allergyDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  allergyActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.glassCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...typography.h5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formField: {
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  commonAllergens: {
    marginTop: spacing.sm,
  },
  commonAllergenTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.primary,
    marginRight: spacing.sm,
  },
  commonAllergenText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  severityButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  severityButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 2,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    gap: spacing.xs,
  },
  severityButtonActive: {
    backgroundColor: colors.glassCard,
  },
  severityButtonIcon: {
    fontSize: 24,
  },
  severityButtonText: {
    ...typography.labelSmall,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default AllergiesScreen;

