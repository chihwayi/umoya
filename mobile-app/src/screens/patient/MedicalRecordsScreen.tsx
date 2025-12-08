import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

interface MedicalRecord {
  id: string;
  recordNumber?: string;
  type: string;
  recordDate: string;
  chiefComplaint: string;
  provider?: {
    firstName: string;
    lastName: string;
  };
  diagnoses?: Array<{
    code: string;
    description: string;
    type: string;
  }>;
}

const MedicalRecordsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadRecords();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [filter]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      if (patientId && currentTenant) {
        const response = await ehrApi.get(API_ENDPOINTS.MEDICAL_RECORD.PATIENT(patientId));
        let data = response.data.records || response.data || [];
        
        if (filter !== 'all') {
          data = data.filter((record: MedicalRecord) => record.type === filter);
        }
        
        setRecords(data);
      }
    } catch (error) {
      console.error('Error loading medical records:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const getTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      consultation: '🩺',
      diagnosis: '🔍',
      treatment: '💊',
      procedure: '⚕️',
      lab_result: '🔬',
      imaging: '📷',
      prescription: '📋',
      vaccination: '💉',
      discharge: '🏥',
    };
    return icons[type] || '📄';
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      consultation: '#3b82f6',
      diagnosis: '#8b5cf6',
      treatment: '#10b981',
      procedure: '#f59e0b',
      lab_result: '#06b6d4',
      imaging: '#ec4899',
    };
    return colors[type] || '#6b7280';
  };

  const renderRecord = ({ item, index }: { item: MedicalRecord; index: number }) => {
    const recordDate = new Date(item.recordDate);
    const formattedDate = format(recordDate, 'MMM dd, yyyy');
    const formattedTime = format(recordDate, 'hh:mm a');
    const typeIcon = getTypeIcon(item.type);
    const typeColor = getTypeColor(item.type);

    return (
      <Animated.View
        style={[
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('MedicalRecordDetail', { recordId: item.id })}
          activeOpacity={0.8}
        >
          <GlassCard style={styles.recordCard} padding={spacing.lg}>
            <View style={styles.recordHeader}>
              <View style={[styles.typeIcon, { backgroundColor: `${typeColor}20` }]}>
                <Text style={styles.typeIconText}>{typeIcon}</Text>
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordType}>{item.type.replace('_', ' ').toUpperCase()}</Text>
                {item.recordNumber && (
                  <Text style={styles.recordNumber}>#{item.recordNumber}</Text>
                )}
              </View>
            </View>
            <Text style={styles.chiefComplaint} numberOfLines={2}>
              {item.chiefComplaint}
            </Text>
            {item.diagnoses && item.diagnoses.length > 0 && (
              <View style={styles.diagnosesContainer}>
                <Text style={styles.diagnosesLabel}>Diagnosis:</Text>
                <Text style={styles.diagnosesText} numberOfLines={1}>
                  {item.diagnoses.map(d => d.description).join(', ')}
                </Text>
              </View>
            )}
            <View style={styles.recordMeta}>
              <Text style={styles.metaText}>
                {formattedDate} at {formattedTime}
              </Text>
              {item.provider && (
                <Text style={styles.metaText}>
                  Dr. {item.provider.firstName} {item.provider.lastName}
                </Text>
              )}
            </View>
          </GlassCard>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const recordTypes = Array.from(new Set(records.map(r => r.type)));

  if (loading && records.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Medical Records" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading medical records...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Medical Records" subtitle="View your medical history" />
      <View style={styles.content}>
        {recordTypes.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                onPress={() => setFilter('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {recordTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterButton, filter === type && styles.filterButtonActive]}
                  onPress={() => setFilter(type)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
                    {type.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {records.length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Medical Records</Text>
              <Text style={styles.emptySubtext}>
                {filter !== 'all' ? `No ${filter} records` : 'You have no medical records at this time'}
              </Text>
            </GlassCard>
          </Animated.View>
        ) : (
          <FlatList
            data={records}
            renderItem={renderRecord}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  filterContainer: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glassCard,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.lg,
  },
  recordCard: {
    marginBottom: spacing.md,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  typeIconText: {
    fontSize: 24,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  recordNumber: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  chiefComplaint: {
    ...typography.body,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  diagnosesContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  diagnosesLabel: {
    ...typography.labelSmall,
    marginRight: spacing.xs,
  },
  diagnosesText: {
    ...typography.bodySmall,
    flex: 1,
  },
  recordMeta: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
});

export default MedicalRecordsScreen;
