import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import prescriptionService from '../../services/prescription.service';
import cdssService from '../../services/cdss.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';
import { format, parseISO } from 'date-fns';

const PrescriptionHistoryScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'discontinued'>('all');
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'discontinue' | 'modify' | 'renew'>('discontinue');

  useEffect(() => {
    loadPrescriptions();
  }, [patientId]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      // Get all prescriptions (not just active)
      const allPrescriptions = await (prescriptionService as any).getAllPrescriptions?.(patientId);
      if (allPrescriptions) {
        setPrescriptions(allPrescriptions);
      } else {
        // Fallback to active prescriptions
        const data = await prescriptionService.getActivePrescriptions(patientId);
        setPrescriptions(data || []);
      }
    } catch (error) {
      console.error('Error loading prescriptions:', error);
      // Fallback to active prescriptions
      try {
        const data = await prescriptionService.getActivePrescriptions(patientId);
        setPrescriptions(data || []);
      } catch (e) {
        Alert.alert('Error', 'Failed to load prescriptions');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter((prescription) => {
    if (filter === 'all') return true;
    if (filter === 'active') return prescription.status === 'active';
    if (filter === 'completed') return prescription.status === 'completed';
    if (filter === 'discontinued') return prescription.status === 'discontinued';
    return true;
  });

  const handleCheckInteractions = async (prescription: any) => {
    try {
      const allActive = prescriptions.filter((p) => p.status === 'active');
      const medications = allActive.map((p) => ({
        name: p.medication,
        dosage: p.dosage,
        frequency: p.frequency,
      }));

      const interactions = await cdssService.checkDrugInteractions({ medications });
      
      if (interactions.hasInteractions) {
        Alert.alert(
          'Drug Interactions Found',
          interactions.interactions
            .map((i) => `${i.severity.toUpperCase()}: ${i.description}`)
            .join('\n\n'),
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('No Interactions', 'No drug interactions detected');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check drug interactions');
    }
  };

  const handleDiscontinue = async (prescription: any) => {
    Alert.alert(
      'Discontinue Prescription',
      `Are you sure you want to discontinue ${prescription.medication}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discontinue',
          onPress: async () => {
            try {
              // Update prescription status to discontinued
              await (prescriptionService as any).updatePrescription(prescription.id, {
                status: 'discontinued',
                endDate: new Date().toISOString(),
              });
              loadPrescriptions();
              setShowActionModal(false);
              Alert.alert('Success', 'Prescription discontinued');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to discontinue prescription');
            }
          },
        },
      ]
    );
  };

  const handleModify = (prescription: any) => {
    navigation.navigate('CreatePrescription' as never, {
      patientId,
      prescriptionId: prescription.id,
      ...prescription,
    } as never);
  };

  const handleRenew = (prescription: any) => {
    navigation.navigate('CreatePrescription' as never, {
      patientId,
      renewFrom: prescription.id,
      medication: prescription.medication,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
    } as never);
  };

  const openActionModal = (prescription: any, type: 'discontinue' | 'modify' | 'renew') => {
    setSelectedPrescription(prescription);
    setActionType(type);
    setShowActionModal(true);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return colors.success;
      case 'completed':
        return colors.info;
      case 'discontinued':
        return colors.error;
      default:
        return colors.textTertiary;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Prescription History" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Prescription History"
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
            activeOpacity={0.7}
          >
            <Icon name="add" size={24} />
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'active', 'completed', 'discontinued'] as const).map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterButton,
                filter === filterType && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(filterType)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === filterType && styles.filterButtonTextActive,
                ]}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredPrescriptions.length > 0 ? (
          filteredPrescriptions.map((prescription) => (
            <GlassCard key={prescription.id} style={styles.prescriptionCard} padding={spacing.md}>
              <View style={styles.prescriptionHeader}>
                <View style={styles.prescriptionContent}>
                  <View style={styles.prescriptionTitleRow}>
                    <Text style={styles.medicationName}>{prescription.medication}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(prescription.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(prescription.status) },
                        ]}
                      >
                        {prescription.status?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.prescriptionDetails}>
                    {prescription.dosage} - {prescription.frequency}
                  </Text>
                  {prescription.duration && (
                    <Text style={styles.prescriptionDuration}>
                      Duration: {prescription.duration}
                    </Text>
                  )}
                  {prescription.startDate && (
                    <Text style={styles.prescriptionDate}>
                      Started: {format(parseISO(prescription.startDate), 'MMM dd, yyyy')}
                    </Text>
                  )}
                  {prescription.instructions && (
                    <Text style={styles.prescriptionInstructions}>
                      {prescription.instructions}
                    </Text>
                  )}
                </View>
              </View>

              {prescription.status === 'active' && (
                <View style={styles.prescriptionActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleCheckInteractions(prescription)}
                  >
                    <Icon name="alert" size={18} />
                    <Text style={styles.actionButtonText}>Check Interactions</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleModify(prescription)}
                  >
                    <Icon name="edit" size={18} />
                    <Text style={styles.actionButtonText}>Modify</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleRenew(prescription)}
                  >
                    <Icon name="refresh" size={18} />
                    <Text style={styles.actionButtonText}>Renew</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.dangerButton]}
                    onPress={() => handleDiscontinue(prescription)}
                  >
                    <Icon name="delete" size={18} />
                    <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
                      Discontinue
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>
          ))
        ) : (
          <GlassCard style={styles.emptyCard} padding={spacing.xl}>
            <Icon name="prescription" size={48} />
            <Text style={styles.emptyText}>No prescriptions found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'No prescriptions recorded for this patient'
                : `No ${filter} prescriptions found`}
            </Text>
          </GlassCard>
        )}

        <PrimaryButton
          title="New Prescription"
          onPress={() => navigation.navigate('CreatePrescription' as never, { patientId } as never)}
          icon="add"
        />
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
  filterContainer: {
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginRight: spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: colors.textOnPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  prescriptionCard: {
    marginBottom: spacing.md,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prescriptionContent: {
    flex: 1,
  },
  prescriptionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  medicationName: {
    ...typography.h5,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  prescriptionDetails: {
    ...typography.body,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  prescriptionDuration: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  prescriptionDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  prescriptionInstructions: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  prescriptionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.xs,
  },
  dangerButton: {
    borderColor: colors.error,
  },
  actionButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dangerButtonText: {
    color: colors.error,
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
});

export default PrescriptionHistoryScreen;

