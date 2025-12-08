import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const MedicalRecordDetailScreen: React.FC = () => {
  const route = useRoute();
  const { recordId } = route.params as { recordId: string };
  const { token } = useSelector((state: RootState) => state.auth);
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadRecord();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [recordId]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      if (token && currentTenant?.slug) {
        const response = await ehrApi.get(API_ENDPOINTS.MEDICAL_RECORD.GET(recordId), token, currentTenant.slug);
        setRecord(response.data);
      }
    } catch (error) {
      console.error('Error loading record:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Medical Record" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Medical Record" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Record not found</Text>
        </View>
      </View>
    );
  }

  const recordDate = new Date(record.recordDate);
  const formattedDate = format(recordDate, 'MMM dd, yyyy');
  const formattedTime = format(recordDate, 'hh:mm a');

  return (
    <View style={styles.container}>
      <ScreenHeader title="Medical Record Details" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.section} padding={spacing.lg}>
            <Text style={styles.sectionTitle}>Record Information</Text>
            {record.recordNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Record Number:</Text>
                <Text style={styles.infoValue}>#{record.recordNumber}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type:</Text>
              <Text style={styles.infoValue}>{record.type.replace('_', ' ').toUpperCase()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>{formattedDate} at {formattedTime}</Text>
            </View>
            {record.provider && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Provider:</Text>
                <Text style={styles.infoValue}>
                  Dr. {record.provider.firstName} {record.provider.lastName}
                </Text>
              </View>
            )}
          </GlassCard>

          <GlassCard style={styles.section} padding={spacing.lg}>
            <Text style={styles.sectionTitle}>Chief Complaint</Text>
            <Text style={styles.chiefComplaint}>{record.chiefComplaint}</Text>
          </GlassCard>

          {record.diagnoses && record.diagnoses.length > 0 && (
            <GlassCard style={styles.section} padding={spacing.lg}>
              <Text style={styles.sectionTitle}>Diagnoses</Text>
              {record.diagnoses.map((diagnosis: any, index: number) => (
                <View key={index} style={styles.diagnosisItem}>
                  <Text style={styles.diagnosisCode}>{diagnosis.code}</Text>
                  <Text style={styles.diagnosisDescription}>{diagnosis.description}</Text>
                  <Text style={styles.diagnosisType}>{diagnosis.type}</Text>
                </View>
              ))}
            </GlassCard>
          )}

          {record.notes && (
            <GlassCard style={styles.section} padding={spacing.lg}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notes}>{record.notes}</Text>
            </GlassCard>
          )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.label,
    color: colors.textTertiary,
  },
  infoValue: {
    ...typography.body,
    flex: 1,
    textAlign: 'right',
  },
  chiefComplaint: {
    ...typography.body,
    lineHeight: 24,
  },
  diagnosisItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  diagnosisCode: {
    ...typography.labelSmall,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  diagnosisDescription: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  diagnosisType: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  notes: {
    ...typography.body,
    lineHeight: 24,
  },
});

export default MedicalRecordDetailScreen;
