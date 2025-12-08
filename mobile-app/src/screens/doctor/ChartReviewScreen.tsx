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
import clinicalNotesService from '../../services/clinical-notes.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import Icon from '../../components/shared/Icon';
import { format, parseISO } from 'date-fns';

const ChartReviewScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'notes' | 'vitals' | 'labs' | 'prescriptions'>('all');

  useEffect(() => {
    loadRecords();
  }, [patientId]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await clinicalNotesService.getPatientMedicalRecords(patientId);
      // Sort by date, newest first
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.recordDate || a.createdAt || 0);
        const dateB = new Date(b.recordDate || b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setRecords(sorted);
    } catch (error) {
      console.error('Error loading records:', error);
      Alert.alert('Error', 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    if (filter === 'all') return true;
    return record.type === filter;
  });

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'consultation':
      case 'notes':
        return 'notes';
      case 'vitals':
        return 'vitals';
      case 'lab':
        return 'lab';
      case 'prescription':
        return 'prescription';
      default:
        return 'record';
    }
  };

  const getRecordTypeLabel = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'Consultation';
      case 'vitals':
        return 'Vital Signs';
      case 'lab':
        return 'Lab Results';
      case 'prescription':
        return 'Prescription';
      case 'vaccination':
        return 'Vaccination';
      case 'discharge':
        return 'Discharge';
      default:
        return 'Medical Record';
    }
  };

  const formatRecordDate = (date: string) => {
    try {
      return format(parseISO(date), 'MMM dd, yyyy HH:mm');
    } catch {
      return date;
    }
  };

  const handleViewRecord = (record: any) => {
    navigation.navigate('MedicalRecordDetail' as never, { recordId: record.id } as never);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Chart Review" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Chart Review" subtitle="Medical Records Timeline" />
      
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'notes', 'vitals', 'labs', 'prescriptions'] as const).map((filterType) => (
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
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record, index) => (
            <TouchableOpacity
              key={record.id || index}
              onPress={() => handleViewRecord(record)}
              activeOpacity={0.7}
            >
              <GlassCard style={styles.recordCard} padding={spacing.md}>
                <View style={styles.recordHeader}>
                  <View style={styles.recordIconContainer}>
                    <Icon name={getRecordIcon(record.type)} size={24} />
                  </View>
                  <View style={styles.recordContent}>
                    <View style={styles.recordTitleRow}>
                      <Text style={styles.recordType}>
                        {getRecordTypeLabel(record.type)}
                      </Text>
                      <Text style={styles.recordDate}>
                        {formatRecordDate(record.recordDate || record.createdAt)}
                      </Text>
                    </View>
                    {record.provider && (
                      <Text style={styles.recordProvider}>
                        Provider: {record.provider.firstName} {record.provider.lastName}
                      </Text>
                    )}
                    {record.chiefComplaint && (
                      <Text style={styles.recordPreview} numberOfLines={2}>
                        CC: {record.chiefComplaint}
                      </Text>
                    )}
                    {record.assessment && (
                      <Text style={styles.recordPreview} numberOfLines={2}>
                        Assessment: {record.assessment}
                      </Text>
                    )}
                  </View>
                  <Icon name="arrowRight" size={20} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))
        ) : (
          <GlassCard style={styles.emptyCard} padding={spacing.xl}>
            <Icon name="chart" size={48} />
            <Text style={styles.emptyText}>No records found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'No medical records available for this patient'
                : `No ${filter} records found`}
            </Text>
          </GlassCard>
        )}
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
  recordCard: {
    marginBottom: spacing.md,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  recordContent: {
    flex: 1,
  },
  recordTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  recordType: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  recordDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  recordProvider: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  recordPreview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: spacing.xl,
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

export default ChartReviewScreen;

