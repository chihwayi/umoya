import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const PrescriptionsScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Prescriptions" subtitle="View your medications" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {prescriptions.length === 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyTitle}>No Prescriptions</Text>
              <Text style={styles.emptySubtitle}>
                Your current and past prescriptions will appear here
              </Text>
            </GlassCard>
          </Animated.View>
        ) : (
          <Text style={styles.comingSoon}>Prescriptions list coming soon</Text>
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

export default PrescriptionsScreen;
