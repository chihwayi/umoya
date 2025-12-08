import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors, typography, spacing } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const VitalsScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [vitals, setVitals] = useState<any[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Get patientId from route params if available
    const params = route.params as { patientId?: string } | undefined;
    if (params?.patientId) {
      setPatientId(params.patientId);
    }
  }, [route.params]);

  if (!patientId) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Vitals" subtitle="Record patient vital signs" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>Select a Patient</Text>
              <Text style={styles.emptySubtitle}>
                Please select a patient to record vital signs
              </Text>
            </GlassCard>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Vitals" subtitle="Record patient vital signs" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {vitals.length === 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>🩺</Text>
              <Text style={styles.emptyTitle}>No Vitals Recorded</Text>
              <Text style={styles.emptySubtitle}>
                Patient vital signs will appear here
              </Text>
            </GlassCard>
          </Animated.View>
        ) : (
          <Text style={styles.comingSoon}>Vitals recording coming soon</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  comingSoon: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

export default VitalsScreen;
