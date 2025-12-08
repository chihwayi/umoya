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
import telemedicineService, { TelemedicineConsultation } from '../../services/telemedicine.service';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const TelemedicineScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [consultations, setConsultations] = useState<TelemedicineConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed'>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadConsultations();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [filter]);

  const loadConsultations = async () => {
    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      if (patientId) {
        const filters: any = { patientId };
        if (filter !== 'all') {
          filters.status = filter;
        }
        const data = await telemedicineService.getConsultations(filters);
        setConsultations(data);
      }
    } catch (error) {
      console.error('Error loading consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConsultations();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return colors.info;
      case 'in_progress': return colors.success;
      case 'completed': return colors.textTertiary;
      case 'cancelled': return colors.error;
      case 'no_show': return colors.warning;
      default: return colors.textTertiary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return '📅';
      case 'in_progress': return '🔴';
      case 'completed': return '✅';
      case 'cancelled': return '❌';
      case 'no_show': return '⏰';
      default: return '📋';
    }
  };

  const canJoin = (consultation: TelemedicineConsultation) => {
    return consultation.status === 'scheduled' || consultation.status === 'in_progress';
  };

  const renderConsultation = ({ item, index }: { item: TelemedicineConsultation; index: number }) => {
    const scheduledDate = new Date(item.scheduledStartTime);
    const formattedDate = format(scheduledDate, 'MMM dd, yyyy');
    const formattedTime = format(scheduledDate, 'hh:mm a');
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

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
        <GlassCard style={styles.consultationCard} padding={spacing.lg}>
          <View style={styles.consultationHeader}>
            <View style={styles.statusRow}>
              <Text style={styles.statusIcon}>{statusIcon}</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
            {item.doctorName && (
              <Text style={styles.doctorName}>Dr. {item.doctorName}</Text>
            )}
            <Text style={styles.consultationType}>
              {item.consultationType.toUpperCase()} Consultation
            </Text>
          </View>
          <View style={styles.consultationMeta}>
            <Text style={styles.metaText}>
              📅 {formattedDate} at {formattedTime}
            </Text>
            {item.durationMinutes && (
              <Text style={styles.metaText}>
                ⏱️ Duration: {item.durationMinutes} minutes
              </Text>
            )}
          </View>
          {canJoin(item) && (
            <PrimaryButton
              title={item.status === 'in_progress' ? 'Join Call' : 'Start Consultation'}
              onPress={() => (navigation as any).navigate('VideoCall', { consultationId: item.id })}
              icon="📹"
            />
          )}
        </GlassCard>
      </Animated.View>
    );
  };

  if (loading && consultations.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Telemedicine" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading consultations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Telemedicine"
        subtitle="Virtual consultations"
        rightAction={
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => (navigation as any).navigate('ScheduleConsultation')}
            activeOpacity={0.7}
          >
            <Text style={styles.newButtonText}>+ New</Text>
          </TouchableOpacity>
        }
      />
      <View style={styles.content}>
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
            <TouchableOpacity
              style={[styles.filterButton, filter === 'scheduled' && styles.filterButtonActive]}
              onPress={() => setFilter('scheduled')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === 'scheduled' && styles.filterTextActive]}>
                Scheduled
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'in_progress' && styles.filterButtonActive]}
              onPress={() => setFilter('in_progress')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === 'in_progress' && styles.filterTextActive]}>
                Active
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
              onPress={() => setFilter('completed')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
                Completed
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {consultations.length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>📹</Text>
              <Text style={styles.emptyTitle}>No Consultations</Text>
              <Text style={styles.emptySubtext}>
                {filter !== 'all' ? `No ${filter} consultations` : 'Schedule your first telemedicine consultation'}
              </Text>
            </GlassCard>
          </Animated.View>
        ) : (
          <FlatList
            data={consultations}
            renderItem={renderConsultation}
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
  newButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  newButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
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
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
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
  consultationCard: {
    marginBottom: spacing.md,
  },
  consultationHeader: {
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  statusIcon: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.labelSmall,
    fontSize: 10,
  },
  doctorName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  consultationType: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  consultationMeta: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    marginBottom: spacing.md,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
});

export default TelemedicineScreen;
