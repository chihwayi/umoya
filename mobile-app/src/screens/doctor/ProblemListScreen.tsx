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
import problemService, { Problem } from '../../services/problem.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';

const ProblemListScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  
  // Form state
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'resolved'>('active');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadProblems();
  }, [patientId]);

  const loadProblems = async () => {
    try {
      setLoading(true);
      const data = await problemService.getPatientProblems(patientId);
      setProblems(data);
    } catch (error) {
      console.error('Error loading problems:', error);
      Alert.alert('Error', 'Failed to load problems');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProblem = () => {
    setEditingProblem(null);
    setDescription('');
    setStatus('active');
    setNotes('');
    setShowAddModal(true);
  };

  const handleEditProblem = (problem: Problem) => {
    setEditingProblem(problem);
    setDescription(problem.description);
    setStatus(problem.status);
    setNotes(problem.notes || '');
    setShowAddModal(true);
  };

  const handleSaveProblem = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a problem description');
      return;
    }

    try {
      if (editingProblem) {
        await problemService.updateProblem(patientId, editingProblem.id!, {
          description,
          status,
          notes,
        });
      } else {
        await problemService.addProblem(patientId, {
          description,
          status,
          notes,
          onsetDate: new Date().toISOString().split('T')[0],
        });
      }
      
      setShowAddModal(false);
      loadProblems();
      Alert.alert('Success', editingProblem ? 'Problem updated' : 'Problem added');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save problem');
    }
  };

  const handleResolveProblem = async (problemId: string) => {
    Alert.alert(
      'Resolve Problem',
      'Mark this problem as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            try {
              await problemService.resolveProblem(patientId, problemId);
              loadProblems();
            } catch (error) {
              Alert.alert('Error', 'Failed to resolve problem');
            }
          },
        },
      ]
    );
  };

  const handleDeleteProblem = async (problemId: string) => {
    Alert.alert(
      'Delete Problem',
      'Are you sure you want to delete this problem?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await problemService.deleteProblem(patientId, problemId);
              loadProblems();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete problem');
            }
          },
        },
      ]
    );
  };

  const activeProblems = problems.filter((p) => p.status === 'active');
  const resolvedProblems = problems.filter((p) => p.status === 'resolved');

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Problem List" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Problem List"
        rightAction={
          <TouchableOpacity onPress={handleAddProblem} activeOpacity={0.7}>
            <Icon name="add" size={24} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsContainer}>
          <GlassCard style={styles.statCard} padding={spacing.md}>
            <Text style={styles.statNumber}>{activeProblems.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </GlassCard>
          <GlassCard style={styles.statCard} padding={spacing.md}>
            <Text style={styles.statNumber}>{resolvedProblems.length}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </GlassCard>
        </View>

        {activeProblems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Problems</Text>
            {activeProblems.map((problem) => (
              <GlassCard key={problem.id} style={styles.problemCard} padding={spacing.md}>
                <View style={styles.problemHeader}>
                  <View style={styles.problemContent}>
                    <Text style={styles.problemDescription}>{problem.description}</Text>
                    {problem.notes && (
                      <Text style={styles.problemNotes}>{problem.notes}</Text>
                    )}
                    {problem.onsetDate && (
                      <Text style={styles.problemDate}>
                        Onset: {new Date(problem.onsetDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.problemActions}>
                    <TouchableOpacity
                      onPress={() => handleResolveProblem(problem.id!)}
                      style={styles.actionButton}
                    >
                      <Icon name="check" size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleEditProblem(problem)}
                      style={styles.actionButton}
                    >
                      <Icon name="edit" size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteProblem(problem.id!)}
                      style={styles.actionButton}
                    >
                      <Icon name="delete" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {resolvedProblems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resolved Problems</Text>
            {resolvedProblems.map((problem) => (
              <GlassCard key={problem.id} style={styles.problemCard} padding={spacing.md}>
                <View style={styles.problemHeader}>
                  <View style={styles.problemContent}>
                    <Text style={[styles.problemDescription, styles.resolvedText]}>
                      {problem.description}
                    </Text>
                    {problem.resolvedDate && (
                      <Text style={styles.problemDate}>
                        Resolved: {new Date(problem.resolvedDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteProblem(problem.id!)}
                    style={styles.actionButton}
                  >
                    <Icon name="delete" size={18} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {problems.length === 0 && (
          <GlassCard style={styles.emptyCard} padding={spacing.xl}>
            <Icon name="problem" size={48} />
            <Text style={styles.emptyText}>No problems recorded</Text>
            <Text style={styles.emptySubtext}>Tap + to add a problem</Text>
          </GlassCard>
        )}

        <PrimaryButton
          title="Add Problem"
          onPress={handleAddProblem}
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
                {editingProblem ? 'Edit Problem' : 'Add Problem'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter problem description..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusButtons}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    status === 'active' && styles.statusButtonActive,
                  ]}
                  onPress={() => setStatus('active')}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === 'active' && styles.statusButtonTextActive,
                    ]}
                  >
                    Active
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    status === 'resolved' && styles.statusButtonActive,
                  ]}
                  onPress={() => setStatus('resolved')}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === 'resolved' && styles.statusButtonTextActive,
                    ]}
                  >
                    Resolved
                  </Text>
                </TouchableOpacity>
              </View>
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
                numberOfLines={4}
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
                onPress={handleSaveProblem}
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
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  problemCard: {
    marginBottom: spacing.md,
  },
  problemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  problemContent: {
    flex: 1,
  },
  problemDescription: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  resolvedText: {
    textDecorationLine: 'line-through',
    color: colors.textTertiary,
  },
  problemNotes: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  problemDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  problemActions: {
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusButtonTextActive: {
    color: colors.textOnPrimary,
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

export default ProblemListScreen;

