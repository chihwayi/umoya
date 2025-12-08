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
import labService from '../../services/lab.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import Icon from '../../components/shared/Icon';
import { format, parseISO, subDays } from 'date-fns';

const LabResultsDashboardScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { patientId } = route.params as { patientId: string };

  const [loading, setLoading] = useState(true);
  const [labResults, setLabResults] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'recent' | 'critical'>('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    loadLabResults();
  }, [patientId, timeRange]);

  const loadLabResults = async () => {
    try {
      setLoading(true);
      const data = await labService.getPatientLabResults(patientId);
      setLabResults(data || []);
    } catch (error) {
      console.error('Error loading lab results:', error);
      Alert.alert('Error', 'Failed to load lab results');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredResults = () => {
    let filtered = [...labResults];

    // Filter by time range
    if (timeRange !== 'all') {
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      const cutoffDate = subDays(new Date(), days);
      filtered = filtered.filter((result) => {
        const resultDate = new Date(result.date || result.createdAt || 0);
        return resultDate >= cutoffDate;
      });
    }

    // Filter by critical status
    if (filter === 'critical') {
      filtered = filtered.filter((result) => result.status === 'critical' || result.isCritical);
    }

    // Sort by date, newest first
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const filteredResults = getFilteredResults();
  const criticalResults = labResults.filter((r) => r.status === 'critical' || r.isCritical);

  const getResultColor = (result: any) => {
    if (result.status === 'critical' || result.isCritical) return colors.error;
    if (result.status === 'abnormal') return colors.warning;
    if (result.status === 'normal') return colors.success;
    return colors.textTertiary;
  };

  const getResultIcon = (result: any) => {
    if (result.status === 'critical' || result.isCritical) return '🚨';
    if (result.status === 'abnormal') return '⚠️';
    return '✅';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Lab Results" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Lab Results"
        subtitle="Diagnostic Results Dashboard"
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('LabOrder' as never, { patientId } as never)}
            activeOpacity={0.7}
          >
            <Icon name="add" size={24} />
          </TouchableOpacity>
        }
      />

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <GlassCard style={styles.statCard} padding={spacing.md}>
          <Text style={styles.statNumber}>{filteredResults.length}</Text>
          <Text style={styles.statLabel}>Total Results</Text>
        </GlassCard>
        <GlassCard
          style={[styles.statCard, criticalResults.length > 0 && styles.criticalStatCard]}
          padding={spacing.md}
        >
          <Text style={[styles.statNumber, criticalResults.length > 0 && styles.criticalNumber]}>
            {criticalResults.length}
          </Text>
          <Text style={styles.statLabel}>Critical</Text>
        </GlassCard>
      </View>

      {/* Time Range Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['24h', '7d', '30d', 'all'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.filterButton,
                timeRange === range && styles.filterButtonActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  timeRange === range && styles.filterButtonTextActive,
                ]}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Critical Alerts */}
      {criticalResults.length > 0 && filter !== 'critical' && (
        <GlassCard style={styles.alertCard} padding={spacing.md}>
          <View style={styles.alertHeader}>
            <Icon name="alert" size={24} />
            <Text style={styles.alertTitle}>Critical Results</Text>
            <TouchableOpacity
              onPress={() => setFilter('critical')}
              style={styles.alertButton}
            >
              <Text style={styles.alertButtonText}>View All</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.alertText}>
            {criticalResults.length} critical result{criticalResults.length > 1 ? 's' : ''} require immediate attention
          </Text>
        </GlassCard>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'recent', 'critical'] as const).map((filterType) => (
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
        {filteredResults.length > 0 ? (
          filteredResults.map((result, index) => (
            <GlassCard
              key={result.id || index}
              style={[
                styles.resultCard,
                (result.status === 'critical' || result.isCritical) && styles.criticalResultCard,
              ]}
              padding={spacing.md}
            >
              <View style={styles.resultHeader}>
                <View style={styles.resultContent}>
                  <View style={styles.resultTitleRow}>
                    <Text style={styles.testName}>{result.testName || result.name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getResultColor(result) + '20' },
                      ]}
                    >
                      <Text style={styles.statusIcon}>{getResultIcon(result)}</Text>
                      <Text
                        style={[
                          styles.statusText,
                          { color: getResultColor(result) },
                        ]}
                      >
                        {result.status?.toUpperCase() || 'PENDING'}
                      </Text>
                    </View>
                  </View>
                  {result.value && (
                    <Text style={styles.resultValue}>
                      {result.value} {result.unit || ''}
                    </Text>
                  )}
                  {result.referenceRange && (
                    <Text style={styles.referenceRange}>
                      Reference: {result.referenceRange}
                    </Text>
                  )}
                  {result.date && (
                    <Text style={styles.resultDate}>
                      {format(parseISO(result.date), 'MMM dd, yyyy HH:mm')}
                    </Text>
                  )}
                  {result.notes && (
                    <Text style={styles.resultNotes}>{result.notes}</Text>
                  )}
                </View>
              </View>
            </GlassCard>
          ))
        ) : (
          <GlassCard style={styles.emptyCard} padding={spacing.xl}>
            <Icon name="lab" size={48} />
            <Text style={styles.emptyText}>No lab results found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'No lab results available for this patient'
                : `No ${filter} results found`}
            </Text>
          </GlassCard>
        )}

        <PrimaryButton
          title="Order Lab Test"
          onPress={() => navigation.navigate('LabOrder' as never, { patientId } as never)}
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
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  criticalStatCard: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  statNumber: {
    ...typography.h2,
    color: colors.primary,
  },
  criticalNumber: {
    color: colors.error,
  },
  statLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginTop: spacing.xs,
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
  alertCard: {
    margin: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.error + '20',
    borderWidth: 2,
    borderColor: colors.error,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  alertTitle: {
    ...typography.h5,
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.error,
  },
  alertButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.error,
  },
  alertButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  alertText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  resultCard: {
    marginBottom: spacing.md,
  },
  criticalResultCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultContent: {
    flex: 1,
  },
  resultTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  testName: {
    ...typography.h5,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  statusIcon: {
    fontSize: 14,
  },
  statusText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  resultValue: {
    ...typography.h4,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  referenceRange: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  resultDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  resultNotes: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
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

export default LabResultsDashboardScreen;

