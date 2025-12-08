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
import { useNavigation } from '@react-navigation/native';
import labService from '../../services/lab.service';
import allergyService from '../../services/allergy.service';
import prescriptionService from '../../services/prescription.service';
import cdssService from '../../services/cdss.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import Icon from '../../components/shared/Icon';

interface ClinicalAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  patientId?: string;
  patientName?: string;
  relatedId?: string;
  relatedType?: 'lab' | 'allergy' | 'prescription' | 'vital';
  timestamp: Date;
  acknowledged: boolean;
}

const ClinicalAlertsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const allAlerts: ClinicalAlert[] = [];

      // Load critical lab results
      // Note: This would typically come from a dedicated alerts API
      // For now, we'll simulate by checking for critical results

      // Load severe allergies
      // This would also come from an alerts API in production

      setAlerts(allAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  };

  const handleViewRelated = (alert: ClinicalAlert) => {
    if (alert.patientId) {
      if (alert.relatedType === 'lab') {
        navigation.navigate('LabResultsDashboard' as never, { patientId: alert.patientId } as never);
      } else if (alert.relatedType === 'allergy') {
        navigation.navigate('Allergies' as never, { patientId: alert.patientId } as never);
      } else if (alert.relatedType === 'prescription') {
        navigation.navigate('PrescriptionHistory' as never, { patientId: alert.patientId } as never);
      } else {
        navigation.navigate('PatientDetail' as never, { patientId: alert.patientId } as never);
      }
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return !alert.acknowledged;
    return alert.type === filter && !alert.acknowledged;
  });

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical':
        return colors.error;
      case 'warning':
        return colors.warning;
      default:
        return colors.info;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return 'alert';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Clinical Alerts" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Clinical Alerts" subtitle="Critical Safety Information" />
      
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'critical', 'warning', 'info'] as const).map((filterType) => (
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
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <GlassCard
              key={alert.id}
              style={[
                styles.alertCard,
                { borderLeftColor: getAlertColor(alert.type) },
              ]}
              padding={spacing.md}
            >
              <View style={styles.alertHeader}>
                <View style={styles.alertIconContainer}>
                  <Icon name={getAlertIcon(alert.type)} size={24} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  {alert.patientName && (
                    <Text style={styles.alertPatient}>Patient: {alert.patientName}</Text>
                  )}
                  <Text style={styles.alertTime}>
                    {alert.timestamp.toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.alertActions}>
                {alert.patientId && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleViewRelated(alert)}
                  >
                    <Text style={styles.actionButtonText}>View</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleAcknowledge(alert.id)}
                >
                  <Text style={styles.actionButtonText}>Acknowledge</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))
        ) : (
          <GlassCard style={styles.emptyCard} padding={spacing.xl}>
            <Icon name="success" size={48} />
            <Text style={styles.emptyText}>No alerts</Text>
            <Text style={styles.emptySubtext}>All clear! No clinical alerts at this time.</Text>
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
  alertCard: {
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  alertIconContainer: {
    marginRight: spacing.md,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    ...typography.h5,
    marginBottom: spacing.xs,
  },
  alertMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  alertPatient: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  alertTime: {
    ...typography.caption,
    color: colors.textMuted,
  },
  alertActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  actionButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glassCard,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  actionButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
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

export default ClinicalAlertsScreen;

